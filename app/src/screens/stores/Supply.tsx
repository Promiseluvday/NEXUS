// Supply screens: Supply board (DeptSupply), Issue parts (WF-J1),
// Quarantine (WF-J3) and U/S returns (WF-J4).
//
//   D-074  only Supply makes stock available; D-148 expired or uncertified
//          stock is never issued, Supply moves it to quarantine.
//   D-068  a reserved line on a work order still awaiting approval shows
//          "issue after WO approval"; the database refuses the issue.
//   D-152  every list holds only the stores the user may see.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate, heldFor } from '../../lib/format';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import {
  Empty, StoresTabs, qtyText, usePartRequestLines, useSupplyRights, type RequestLine,
} from './common';
import { RequestLinesTable } from './Requests';
import { RaiseRepairRequisitionLink } from '../Procurement';

// The accepted certificate list Quality keeps (D-148).
export function useCertificateTypes(): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    anyDb.from('operator_setting_current').select('value').eq('key', 'stores.accepted_certificate_types').maybeSingle()
      .then(({ data }: { data: { value: unknown } | null }) => {
        const v = data?.value;
        if (Array.isArray(v)) setList(v.filter((x): x is string => typeof x === 'string'));
      });
  }, []);
  return list;
}

// Issue one reserved line, signed with PIN (D-094).
function IssueButton({ line, onDone }: { line: RequestLine; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const waitingApproval = line.work_order_status === 'requested' || line.work_order_status === 'pre_approved';
  if (waitingApproval) return <span className="small muted">After WO approval (D-068)</span>;
  if (line.lot_problem) return <span className="small danger-text">Cannot issue: {line.lot_problem}</span>;
  if (!open) return <button type="button" onClick={() => setOpen(true)}>Issue</button>;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, error: err } = await anyActions.rpc('issue_part', { p_line: line.line_id, p_pin: pin });
    if (err) return setError(errorText(err));
    setOpen(false);
    onDone(`${line.request_number}: issued, voucher ${data as string}`);
  }
  return (
    <form className="st-inline" onSubmit={submit}>
      <PinField value={pin} onChange={setPin} id={`pin-${line.line_id}`} />
      {error && <div className="error">{error}</div>}
      <div className="action-row">
        <button type="submit">Sign and issue</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ WF-J1
export function IssueParts() {
  const { lines, error, reload } = usePartRequestLines({});
  const { canIssue } = useSupplyRights();
  const [message, setMessage] = useState('');
  const reserved = (lines ?? []).filter((l) => l.state === 'reserved');
  const waiting = (lines ?? []).filter((l) => l.state === 'submitted' || l.state === 'needs_requisition');
  const returning = (lines ?? []).filter((l) => l.state === 'returning');
  const done = (m: string) => { setMessage(m); reload(); };

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'Issue parts' }]} />
      <BackButton to="/stores" label="Stores search" />
      <StoresTabs />
      <PageHead title="Issue parts" sub="Approved and reserved requests · AOG first" />
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error">{error}</div>}
      {lines === null && <p className="muted">Loading…</p>}

      <Section title={`Reserved, awaiting issue (${reserved.length})`}>
        {reserved.length === 0 ? <Empty>Nothing reserved.</Empty> : (
          <RequestLinesTable lines={reserved} showStore
            action={canIssue ? (l) => <IssueButton line={l} onDone={done} /> : undefined} />
        )}
      </Section>
      <Section title={`Waiting for Supply (${waiting.length})`}>
        {waiting.length === 0 ? <Empty>No requests waiting.</Empty> : (
          <>
            <RequestLinesTable lines={waiting} showStore action={(l) => (
              <button type="button" className="secondary" onClick={async () => {
                const { data, error: err } = await anyActions.rpc('reserve_line', { p_line: l.line_id });
                done(err ? errorText(err) : `${l.request_number}: ${data === 'reserved' ? 'reserved' : 'still not in stock'}`);
              }}>Check stock</button>
            )} />
            <p className="small muted">Not in stock: a requisition is raised for Procurement (D-073, D-145).</p>
          </>
        )}
      </Section>
      <Section title={`Being returned unused (${returning.length})`}>
        {returning.length === 0 ? <Empty>No returns waiting.</Empty> : (
          <RequestLinesTable lines={returning} showStore action={(l) => <Link to={`/part-requests/${l.request_id}`}>Take back</Link>} />
        )}
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ WF-J3
type QLot = {
  id: string; store_code: string; serial_no: string | null; batch_no: string | null; qty_on_hand: number;
  condition: string; condition_reason: string | null; condition_set_at: string | null; certificate_status: string;
  shelf_life_expires_on: string | null; receipt_id: string | null;
  part: { part_number: string; description: string } | null; setter: { three_letter_code: string } | null;
  receipt: { id: string; number: string } | null;
};

export function Quarantine() {
  const { display } = useAuth();
  const { canReceive } = useSupplyRights();
  const certs = useCertificateTypes();
  const [rows, setRows] = useState<QLot[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ type: '', ref: '', reason: '', pin: '' });

  const load = useCallback(async () => {
    const { data, error: err } = await anyDb.from('stock_lot')
      .select(`id, store_code, serial_no, batch_no, qty_on_hand, condition, condition_reason, condition_set_at,
               certificate_status, shelf_life_expires_on, receipt_id,
               part:part_id (part_number, description), setter:condition_set_by (three_letter_code),
               receipt:receipt_id (id, number)`)
      .in('condition', ['quarantine', 'unserviceable']).gt('qty_on_hand', 0).order('condition_set_at', { ascending: false });
    if (err) setError(errorText(err));
    setRows((data ?? []) as QLot[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function release(e: FormEvent, lot: QLot) {
    e.preventDefault();
    setError('');
    const { error: err } = await anyActions.rpc('release_from_quarantine', {
      p_lot: lot.id, p_reason: form.reason, p_certificate_type: form.type, p_certificate_ref: form.ref, p_pin: form.pin,
    });
    if (err) return setError(errorText(err));
    setOpen(null);
    setForm({ type: '', ref: '', reason: '', pin: '' });
    setMessage(`${lot.part?.part_number}: released to stock`);
    load();
  }

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'Quarantine' }]} />
      <BackButton to="/stores/issue" label="Issue parts" />
      <StoresTabs />
      <PageHead title="Quarantine" sub="Not available for issue. Unserviceable parts wait for repair (procurement)." />
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <div className="box"><div className="box-body"><Empty>Nothing in quarantine.</Empty></div></div>}
      {rows && rows.length > 0 && (
        <ul className="st-cards">
          {rows.map((r) => (
            <li key={r.id} className="box">
              <div className="box-body">
                <div className="st-lot-top">
                  <strong>{r.part?.description}</strong> <span className="mono">{r.part?.part_number}</span>
                  <span className="dept-tag">{r.store_code}</span>
                  <span className={`chip tone-${r.condition === 'unserviceable' ? 'red' : 'amber'}`}>{r.condition === 'unserviceable' ? 'U/S' : 'Quarantine'}</span>
                  {r.certificate_status !== 'valid' && <span className="chip tone-red">No certificate</span>}
                </div>
                <div className="small">
                  <span className="mono">{qtyText(r.qty_on_hand)}</span> · {r.serial_no ? `SN ${r.serial_no}` : r.batch_no ? `Batch ${r.batch_no}` : ''}
                  {r.shelf_life_expires_on && <> · shelf life ends {formatPlainDate(r.shelf_life_expires_on, display)}</>}
                  {r.receipt && <> · receipt <Link className="mono" to={`/stores/receiving/${r.receipt.id}`}>{r.receipt.number}</Link></>}
                </div>
                <div className="small">Reason: {r.condition_reason ?? '—'} · placed by <span className="mono">{r.setter?.three_letter_code ?? '—'}</span>
                  {r.condition_set_at && <> · {formatDateTime(r.condition_set_at, display)}</>}</div>
                {canReceive && r.condition === 'quarantine' && open !== r.id && (
                  <div className="action-row"><button type="button" className="secondary" onClick={() => setOpen(r.id)}>Release to stock</button></div>
                )}
                {open === r.id && (
                  <form className="st-inline" onSubmit={(e) => release(e, r)}>
                    <p className="small">Release documents must be on the receipt (D-153); the certificate type must be on Quality's list (D-148).</p>
                    <div className="row st-row">
                      <div>
                        <label htmlFor={`ct-${r.id}`}>Certificate type</label>
                        <select id={`ct-${r.id}`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                          <option value="">Choose</option>
                          {certs.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`cr-${r.id}`}>Certificate reference</label>
                        <input id={`cr-${r.id}`} value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} required />
                      </div>
                    </div>
                    <label htmlFor={`rr-${r.id}`}>Reason for release</label>
                    <input id={`rr-${r.id}`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
                    <PinField value={form.pin} onChange={(pin) => setForm({ ...form, pin })} id={`pin-${r.id}`} />
                    <div className="action-row">
                      <button type="submit">Sign and release</button>
                      <button type="button" className="secondary" onClick={() => setOpen(null)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ WF-J4
type UsRow = {
  id: string; number: string; serial_no: string | null; part_number_text: string | null; reason: string;
  store_code: string; removed_at: string; return_due_on: string | null; status: string; tag_ref: string | null;
  received_at: string | null; part_id: string | null;
  part: { part_number: string; description: string } | null; aircraft: { tail: string } | null;
  remover: { three_letter_code: string } | null;
};

export function UsReturns() {
  const { display } = useAuth();
  const { isSupply } = useSupplyRights();
  const [rows, setRows] = useState<UsRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = anyDb.from('us_return')
      .select(`id, number, serial_no, part_number_text, reason, store_code, removed_at, return_due_on, status, tag_ref,
               received_at, part_id, part:part_id (part_number, description), aircraft:aircraft_id (tail),
               remover:removed_by (three_letter_code)`)
      .order('removed_at', { ascending: false }).limit(200);
    if (!showAll) q = q.eq('status', 'expected');
    const { data } = await q;
    setRows((data ?? []) as UsRow[]);
  }, [showAll]);
  useEffect(() => { load(); }, [load]);

  async function receive(e: FormEvent, r: UsRow) {
    e.preventDefault();
    setError('');
    const { error: err } = await anyActions.rpc('receive_us_return', { p_return: r.id, p_tag_ref: tag });
    if (err) return setError(errorText(err));
    setOpen(null); setTag('');
    setMessage(`${r.number}: received and tagged U/S, in quarantine`);
    load();
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Stores search', to: '/stores' }, { label: 'U/S returns' }]} />
      <BackButton to="/stores/issue" label="Issue parts" />
      {isSupply && <StoresTabs />}
      <PageHead title="U/S returns" sub="Removed unserviceable parts on their way to stores" />
      <label className="check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show received too</label>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <div className="box"><div className="box-body"><Empty>No U/S returns expected.</Empty></div></div>}
      {rows && rows.length > 0 && (
        <ul className="st-cards">
          {rows.map((r) => (
            <li key={r.id} className="box">
              <div className="box-body">
                <div className="st-lot-top">
                  <span className="mono">{r.number}</span>
                  <strong>{r.part?.description ?? ''}</strong> <span className="mono">{r.part?.part_number ?? r.part_number_text}</span>
                  {r.serial_no && <span className="mono small">SN {r.serial_no}</span>}
                  <span className="tail">{r.aircraft?.tail}</span>
                  {r.status === 'expected'
                    ? <span className={`chip tone-${r.return_due_on && r.return_due_on < today ? 'red' : 'amber'}`}>{r.return_due_on && r.return_due_on < today ? 'Overdue' : 'Expected'}</span>
                    : <span className="chip tone-grey">Received · tag {r.tag_ref}</span>}
                </div>
                <div className="small">Removed U/S {formatDateTime(r.removed_at, display)} by <span className="mono">{r.remover?.three_letter_code}</span>
                  {r.return_due_on && <> · due at {r.store_code} {formatPlainDate(r.return_due_on, display)}</>}</div>
                <div className="small">Reason: {r.reason}</div>
                {/* A received U/S part can go for repair through a requisition (procurement). */}
                {isSupply && r.status === 'received' && (
                  <div className="action-row"><RaiseRepairRequisitionLink usReturnId={r.id} received /></div>
                )}
                {isSupply && r.status === 'expected' && open !== r.id && (
                  <div className="action-row">
                    <button type="button" onClick={() => setOpen(r.id)}>Process return</button>
                    <RaiseRepairRequisitionLink usReturnId={r.id} received={false} />
                  </div>
                )}
                {open === r.id && (
                  <form className="st-inline" onSubmit={(e) => receive(e, r)}>
                    {!r.part_id && <p className="small danger-text">Catalogue {r.part_number_text} first (Receiving › Register part).</p>}
                    <label htmlFor={`tag-${r.id}`}>Unserviceable tag reference</label>
                    <input id={`tag-${r.id}`} value={tag} onChange={(e) => setTag(e.target.value)} required />
                    <div className="action-row">
                      <button type="submit">Receive into quarantine</button>
                      <button type="button" className="secondary" onClick={() => setOpen(null)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------- Supply board
type Alert = {
  lot_id: string; part_id: string; part_number: string; description: string; store_code: string;
  qty: number; alert: string; level: 'stop' | 'caution'; expires_on: string | null; condition: string;
};
const ALERT_TEXT: Record<string, string> = {
  expired: 'Shelf life ended: cannot be issued',
  uncertified: 'No release certificate: cannot be issued',
  expiring: 'Shelf life ends soon',
  quarantine_no_certificate: 'Certificate missing, in quarantine',
};

export function SupplyBoard() {
  const { display } = useAuth();
  const { lines, reload } = usePartRequestLines({});
  const { canIssue } = useSupplyRights();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [usDue, setUsDue] = useState(0);
  const [message, setMessage] = useState('');

  const loadAlerts = useCallback(async () => {
    const [a, u] = await Promise.all([
      anyActions.rpc('stock_alerts'),
      anyDb.from('us_return').select('id', { count: 'exact', head: true }).eq('status', 'expected'),
    ]);
    setAlerts((a.data ?? []) as Alert[]);
    setUsDue(u.count ?? 0);
  }, []);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function quarantine(a: Alert) {
    const reason = ALERT_TEXT[a.alert];
    const { error } = await anyActions.rpc('quarantine_lot', { p_lot: a.lot_id, p_reason: reason });
    setMessage(error ? errorText(error) : `${a.part_number}: moved to quarantine (D-148)`);
    loadAlerts(); reload();
  }

  const all = lines ?? [];
  const aog = all.filter((l) => l.priority === 'AOG');
  const reserved = all.filter((l) => l.state === 'reserved');
  const now = new Date();

  return (
    <div className="page st-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Supply board' }]} />
      <PageHead title="Supply board" sub={`${formatDateTime(now, display)} · AOG requests first`}>
        <Link className="button" to="/stores/receiving">Receive goods</Link>
        <Link className="button outline-button" to="/stores/issue">Issue part</Link>
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}

      <div className="tiles st-tiles">
        <Link className="tile" to="/stores/issue"><span className={`tile-n${aog.length ? ' warn' : ''}`}>{aog.length}</span><span className="tile-l">AOG requests</span></Link>
        <Link className="tile" to="/stores/issue"><span className="tile-n">{reserved.length}</span><span className="tile-l">Reserved, awaiting issue</span></Link>
        <Link className="tile" to="/stores/us-returns"><span className="tile-n">{usDue}</span><span className="tile-l">U/S returns due</span></Link>
        <a className="tile" href="#alerts"><span className={`tile-n${alerts.some((x) => x.level === 'stop') ? ' warn' : ''}`}>{alerts.length}</span><span className="tile-l">Shelf-life and certificate alerts</span></a>
      </div>

      <Section title="Part requests by aircraft · AOG first" actions={<Link to="/stores/issue">Issue parts</Link>}>
        {lines === null ? <p className="muted">Loading…</p> : all.length === 0 ? <Empty>No open part requests.</Empty>
          : <RequestLinesTable lines={all} showStore />}
      </Section>

      <Section title="Reserved, awaiting issue">
        {reserved.length === 0 ? <Empty>Nothing reserved.</Empty> : (
          <ul className="open-list">
            {reserved.map((l) => (
              <li key={l.line_id}>
                <Link className="mono" to={`/part-requests/${l.request_id}`}>{l.request_number}</Link>
                <span className="tail">{l.tail ?? '—'}</span>
                <span>{qtyText(l.qty)} × {l.description} <span className="mono small">{l.part_number}</span></span>
                {l.bin && <span className="small">Bin <span className="mono">{l.bin}</span></span>}
                <span className="small muted">for <span className="mono">{l.requested_by_code}</span> · {heldFor(l.held_since)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Shelf-life and certificate alerts" id="alerts">
        {alerts.length === 0 ? <Empty>No alerts.</Empty> : (
          <ul className="open-list">
            {alerts.map((a) => (
              <li key={a.lot_id}>
                <span className={`chip tone-${a.level === 'stop' ? 'red' : 'amber'}`}>{a.level === 'stop' ? 'Stop' : 'Caution'}</span>
                <span>{ALERT_TEXT[a.alert]}</span>
                <Link to={`/stores/parts/${a.part_id}`}>{a.description} <span className="mono small">{a.part_number}</span></Link>
                <span className="small muted">{a.store_code} · {qtyText(a.qty)}{a.expires_on && ` · ends ${formatPlainDate(a.expires_on, display)}`}</span>
                {canIssue && a.condition === 'serviceable' && a.level === 'stop' && (
                  <button type="button" className="secondary" onClick={() => quarantine(a)}>Move to quarantine</button>
                )}
                {a.condition !== 'serviceable' && <Link to="/stores/quarantine">Quarantine</Link>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
