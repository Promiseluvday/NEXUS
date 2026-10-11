// Stores search (WF-I1) and part detail (WF-I2).
//
// D-070: engineers search stores and see live quantity before walking over.
// D-141, D-152: quantity per store, only for the stores the user holds; the
//   database leaves the others out.
// D-072, D-148: expired and uncertified stock is counted separately and
//   flagged; "available" never includes it.
// Cost is not shown here (D-077, D-121): the procurement slice adds
// "Last purchase price" behind "View cost".
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatPlainDate } from '../../lib/format';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import { Empty, StockFlags, StoresTabs, qtyText, useSupplyRights } from './common';

export type SearchRow = {
  part_id: string; part_number: string; description: string; part_class: string; unit: string;
  shelf_life_tracked: boolean; serialised: boolean;
  stores: { store: string; name: string; available: number; reserved: number }[];
  available: number; reserved: number; on_hand: number;
  expired_qty: number; uncertified_qty: number; quarantine_qty: number;
  next_expiry: string | null; certificate: 'valid' | 'missing' | 'mixed' | 'none';
};

const CERT: Record<string, { label: string; tone: string }> = {
  valid:   { label: 'Valid', tone: 'green' },
  missing: { label: 'Missing', tone: 'red' },
  mixed:   { label: 'Some missing', tone: 'amber' },
  none:    { label: 'No stock', tone: 'grey' },
};

function daysUntil(date: string): number {
  return Math.round((new Date(`${date}T12:00:00Z`).getTime() - Date.now()) / 86400000);
}

export function ShelfLife({ row }: { row: Pick<SearchRow, 'next_expiry' | 'expired_qty' | 'shelf_life_tracked'> }) {
  const { display } = useAuth();
  if (Number(row.expired_qty) > 0) return <span className="chip tone-red">Ended · {qtyText(row.expired_qty)} expired</span>;
  if (!row.next_expiry) return <span className="muted">{row.shelf_life_tracked ? 'No date' : '—'}</span>;
  const d = daysUntil(row.next_expiry);
  if (d <= 30) return <span className="chip tone-amber">Caution: ends in {d} day{d === 1 ? '' : 's'}</span>;
  return <span>Ends {formatPlainDate(row.next_expiry, display)}</span>;
}

function StoreQty({ row }: { row: SearchRow }) {
  if (row.stores.length === 0) return <span className="muted">No store granted</span>;
  return (
    <span className="mono">
      {row.stores.map((s, i) => (
        <span key={s.store}>{i > 0 && ' · '}{s.name.replace(' Store', '')} {qtyText(s.available)}</span>
      ))}
    </span>
  );
}

// WF-I1
export function StoresSearch() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [error, setError] = useState('');
  const q = params.get('q') ?? '';
  const { isSupply } = useSupplyRights();

  useEffect(() => {
    let live = true;
    const load = () => anyActions.rpc('search_stores', { p_text: q, p_limit: 200 }).then(
      ({ data, error: err }: { data: SearchRow[] | null; error: { message: string } | null }) => {
        if (!live) return;
        setError(err ? errorText(err) : '');
        setRows(data ?? []);
      });
    load();
    const t = setInterval(load, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [q]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (text.trim()) next.set('q', text.trim()); else next.delete('q');
    setParams(next, { replace: true });
  }
  const open = (id: string) => navigate(`/stores/parts/${id}`);

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search' }]} />
      <BackButton to="/" label="All aircraft" />
      {isSupply && <StoresTabs />}
      <PageHead title="Stores search" sub="Live stock · shows only the stores you hold" />

      <form className="st-search" onSubmit={submit} role="search">
        <input type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Part number or description" aria-label="Part number or description" />
        <button type="submit">Search</button>
      </form>
      <div className="small muted">Enter also searches.</div>

      {error && <div className="error">{error}</div>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && (
        <div className="box"><div className="box-body">
          <Empty>{q ? <>No parts match <span className="mono">{q}</span>. Check the part number or search by description.</> : 'The catalogue is empty.'}</Empty>
        </div></div>
      )}
      {rows && rows.length > 0 && (
        <>
          <div className="small muted">Results: {rows.length} part{rows.length === 1 ? '' : 's'}</div>
          <table className="board st-table">
            <thead>
              <tr><th>Part number</th><th>Description</th><th>Available by store</th><th>Reserved</th><th>Certificate</th><th>Shelf life</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.part_id} tabIndex={0} onClick={() => open(r.part_id)} onKeyDown={(e) => e.key === 'Enter' && open(r.part_id)}>
                  <td><Link className="mono" to={`/stores/parts/${r.part_id}`} onClick={(e) => e.stopPropagation()}>{r.part_number}</Link></td>
                  <td>{r.description}{Number(r.quarantine_qty) > 0 && <div className="small muted">{qtyText(r.quarantine_qty)} in quarantine / U/S</div>}</td>
                  <td><StoreQty row={r} /></td>
                  <td className="mono">{qtyText(r.reserved)}</td>
                  <td><span className={`chip tone-${CERT[r.certificate].tone}`}>{CERT[r.certificate].label}</span>
                    {Number(r.uncertified_qty) > 0 && r.certificate !== 'missing' && <div className="small muted">{qtyText(r.uncertified_qty)} without</div>}</td>
                  <td><ShelfLife row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cards">
            {rows.map((r) => (
              <button key={r.part_id} type="button" className="card tail-card" onClick={() => open(r.part_id)}>
                <div className="top"><span className="mono">{r.part_number}</span>
                  <span className={`chip tone-${CERT[r.certificate].tone}`}>Cert: {CERT[r.certificate].label}</span></div>
                <div style={{ margin: '6px 0' }}>{r.description}</div>
                <div className="small"><StoreQty row={r} /> · {qtyText(r.reserved)} reserved</div>
                <div className="small" style={{ marginTop: 6 }}><ShelfLife row={r} /></div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Lot = {
  id: string; store_code: string; serial_no: string | null; batch_no: string | null; bin: string | null;
  qty_on_hand: number; qty_reserved: number; condition: string; condition_reason: string | null;
  certificate_status: string; certificate_type: string | null; certificate_ref: string | null;
  shelf_life_expires_on: string | null;
};

// WF-I2
export function PartDetail() {
  const { id } = useParams();
  const { display, me } = useAuth();
  const [row, setRow] = useState<SearchRow | null | undefined>(undefined);
  const [lots, setLots] = useState<Lot[]>([]);
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  useEffect(() => {
    (async () => {
      const { data: p } = await anyDb.from('part').select('part_number').eq('id', id).maybeSingle();
      if (!p) return setRow(null);
      const [s, l] = await Promise.all([
        anyActions.rpc('search_stores', { p_text: p.part_number, p_limit: 20 }),
        anyDb.from('stock_lot').select(`id, store_code, serial_no, batch_no, bin, qty_on_hand, qty_reserved, condition,
              condition_reason, certificate_status, certificate_type, certificate_ref, shelf_life_expires_on`)
          .eq('part_id', id).gt('qty_on_hand', 0).order('store_code').order('shelf_life_expires_on'),
      ]);
      setRow(((s.data ?? []) as SearchRow[]).find((x) => x.part_id === id) ?? null);
      setLots((l.data ?? []) as Lot[]);
    })();
  }, [id]);

  if (row === undefined) return <div className="page muted">Loading…</div>;
  if (row === null) return <div className="page"><p>This part is not in the catalogue.</p></div>;

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'Part detail' }]} />
      <BackButton to="/stores" label="Stores search" />
      <PageHead title={<><span className="mono">{row.part_number}</span> · {row.description}</>}
        sub={`Part detail · ${row.part_class === 'component' ? 'Component' : 'Consumable'}${row.serialised ? ' · serialised' : ''}${row.shelf_life_tracked ? ' · shelf life tracked' : ''}`}>
        {isEngineer && <Link className="button" to={`/part-requests/new?part=${row.part_id}`}>Request this part</Link>}
      </PageHead>

      <Section title="Stock">
        <dl className="facts">
          <dt>Available</dt><dd><StoreQty row={row} /> · <span className="mono">{qtyText(row.reserved)}</span> reserved</dd>
          <dt>Certificate</dt><dd>{CERT[row.certificate].label}</dd>
          <dt>Shelf life</dt><dd><ShelfLife row={row} /></dd>
        </dl>
      </Section>

      <Section title="Batches and serial numbers">
        {lots.length === 0 && <Empty>No stock in the stores you hold.</Empty>}
        {lots.length > 0 && (
          <ul className="st-lots">
            {lots.map((l) => (
              <li key={l.id}>
                <div className="st-lot-top">
                  <span className="dept-tag">{l.store_code}</span>
                  <span className="mono">{l.serial_no ? `SN ${l.serial_no}` : l.batch_no ? `Batch ${l.batch_no}` : 'No batch'}</span>
                  {l.bin && <span className="small muted">Bin <span className="mono">{l.bin}</span></span>}
                  <span className="mono">{qtyText(l.qty_on_hand)} on hand · {qtyText(l.qty_reserved)} reserved</span>
                </div>
                <div className="st-lot-sub small">
                  <StockFlags condition={l.condition} certificate={l.certificate_status} expiresOn={l.shelf_life_expires_on} />
                  {l.certificate_status === 'valid' && <span>{l.certificate_type} · <span className="mono">{l.certificate_ref}</span></span>}
                  {l.shelf_life_expires_on && <span>Shelf life ends {formatPlainDate(l.shelf_life_expires_on, display)}</span>}
                  {l.condition !== 'serviceable' && l.condition_reason && <span>Reason: {l.condition_reason}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="action-row">
        {isEngineer && <Link className="button" to={`/part-requests/new?part=${row.part_id}`}>Request this part</Link>}
        <Link className="button outline-button" to="/stores">Back to search</Link>
      </div>
    </div>
  );
}
