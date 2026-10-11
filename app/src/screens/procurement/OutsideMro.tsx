// Outside-MRO jobs (WF-MRO1 list, WF-MRO2 detail): Procurement's commercial
// oversight of work sent to an outside MRO (D-144).
//
//   * Procurement ("Manage outside-MRO jobs") records the job, the quotes and
//     negotiation, the agreed cost (PIN), parts the MRO used with their cost,
//     and invoices.
//   * TECHNICAL ACCEPTANCE stays with Engineering and Quality (D-020): the
//     page shows the linked work order and the acceptance note an engineer or
//     Quality person signed. Procurement cannot record it.
//   * Quotes, agreed cost, parts cost and invoices only with "View cost"
//     (D-077, D-121, D-127); Engineering and Quality see the job without them.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate } from '../../lib/format';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import { Empty, Money, MroChip, NoCostNote, ProcurementTabs, qtyText, useProcurementRights } from './common';
import { InvoicesSection, type Invoice } from './Invoices';
import { useSuppliers } from './PurchaseOrders';

export type MroRow = {
  id: string; number: string; title: string; status: string; status_since: string; supplier_name: string;
  aircraft_id: string | null; tail: string | null; work_order_id: string | null; work_order_number: string | null;
  us_return_number: string | null; part_number: string | null; serial_no: string | null; sent_on: string | null;
  expected_back: string | null; returned_on: string | null; overdue: boolean; accepted: boolean;
  agreed_cost: number | null; currency: string | null; raised_by_code: string; created_at: string;
};
type MroDetail = MroRow & {
  scope: string | null; cancel_reason: string | null;
  supplier: { id: string; name: string; code: string; country: string | null; contact: string | null };
  work_order: { id: string; number: string; status: string; certified_by: string | null; certified_at: string | null } | null;
  acceptance: { note: string; by: string; by_name: string; at: string } | null;
  quotes: { id: string; entry: string; amount: number; currency: string; note: string | null; by: string; at: string }[] | null;
  parts: { id: string; part_number: string; description: string | null; qty: number; unit_cost: number; currency: string; by: string }[] | null;
  invoices: Invoice[] | null;
  can: { manage: boolean; accept: boolean; view_cost: boolean };
};

const ENTRY: Record<string, string> = {
  quote: 'Quote received', counter_offer: 'Counter-offer sent', revised_quote: 'Revised quote', agreed: 'Agreed',
};

export function useOutsideMroJobs(openOnly = true) {
  const [rows, setRows] = useState<MroRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await anyActions.rpc('outside_mro_jobs', { p_open_only: openOnly });
    setRows((data ?? []) as MroRow[]);
  }, [openOnly]);
  useEffect(() => { load(); }, [load]);
  return { rows, reload: load };
}

// ------------------------------------------------------------------ list
export function OutsideMroList() {
  const { display } = useAuth();
  const navigate = useNavigate();
  const { rights } = useProcurementRights();
  const [all, setAll] = useState(false);
  const { rows } = useOutsideMroJobs(!all);
  const suppliers = useSuppliers('mro');
  const [aircraft, setAircraft] = useState<{ id: string; tail: string }[]>([]);
  const [usReturns, setUsReturns] = useState<{ id: string; number: string; serial_no: string | null; part: { part_number: string } | null }[]>([]);
  const [f, setF] = useState({ open: false, supplier: '', title: '', scope: '', aircraft: '', us: '', serial: '', sent: '', back: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!f.open) return;
    anyDb.from('aircraft').select('id, tail').eq('status', 'active').order('tail')
      .then(({ data }: { data: { id: string; tail: string }[] | null }) => setAircraft(data ?? []));
    anyDb.from('us_return').select('id, number, serial_no, part:part_id (part_number)').eq('status', 'received')
      .order('received_at', { ascending: false }).limit(50)
      .then(({ data }: { data: typeof usReturns | null }) => setUsReturns(data ?? []));
  }, [f.open]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { data, error: err } = await anyActions.rpc('open_outside_mro_job', {
      p_supplier: f.supplier, p_title: f.title, p_scope: f.scope || null, p_aircraft: f.aircraft || null,
      p_work_order: null, p_us_return: f.us || null, p_part: null, p_serial: f.serial || null,
      p_sent_on: f.sent || null, p_expected_back: f.back || null,
    });
    if (err) return setError(errorText(err));
    navigate(`/procurement/outside-mro/${(data as { id: string }).id}`);
  }

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Outside-MRO jobs' }]} />
      <BackButton to="/" label="All aircraft" />
      <ProcurementTabs />
      <PageHead title="Outside-MRO jobs" sub="Commercial oversight by Procurement; technical acceptance by Engineering and Quality (D-144, D-020)">
        {rights.manage_mro && !f.open && <button type="button" onClick={() => setF({ ...f, open: true })}>New outside-MRO job</button>}
      </PageHead>
      {error && <div className="error" role="alert">{error}</div>}

      {f.open && (
        <Section title="Job sent to an outside MRO">
          <form className="pq-form" onSubmit={create}>
            <div className="row pq-row">
              <div><label htmlFor="mj-sup">Outside MRO (approved list, D-148)</label>
                <select id="mj-sup" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} required>
                  <option value="">Choose</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select></div>
              <div><label htmlFor="mj-title">Job</label><input id="mj-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required placeholder="e.g. Hydraulic pump overhaul" /></div>
            </div>
            <label htmlFor="mj-scope">Scope</label>
            <input id="mj-scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} />
            <div className="row pq-row">
              <div><label htmlFor="mj-us">Component sent (received U/S return)</label>
                <select id="mj-us" value={f.us} onChange={(e) => setF({ ...f, us: e.target.value })}>
                  <option value="">None</option>
                  {usReturns.map((u) => <option key={u.id} value={u.id}>{u.number} · {u.part?.part_number}{u.serial_no ? ` S/N ${u.serial_no}` : ''}</option>)}
                </select>
                <div className="small muted">Its tail and work order come with it.</div></div>
              <div><label htmlFor="mj-ac">Tail (if not from a U/S return)</label>
                <select id="mj-ac" value={f.aircraft} onChange={(e) => setF({ ...f, aircraft: e.target.value })}>
                  <option value="">None</option>
                  {aircraft.map((a) => <option key={a.id} value={a.id}>{a.tail}</option>)}
                </select></div>
              <div><label htmlFor="mj-sn">Serial number</label><input id="mj-sn" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></div>
            </div>
            <div className="row pq-row">
              <div><label htmlFor="mj-sent">Sent on</label><input id="mj-sent" type="date" value={f.sent} onChange={(e) => setF({ ...f, sent: e.target.value })} /></div>
              <div><label htmlFor="mj-back">Expected back (as the MRO states)</label><input id="mj-back" type="date" value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} /></div>
            </div>
            <div className="action-row"><button type="submit">Record job</button>
              <button type="button" className="secondary" onClick={() => setF({ ...f, open: false })}>Cancel</button></div>
          </form>
        </Section>
      )}

      <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show closed and cancelled too</label>
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <div className="box"><div className="box-body"><Empty>No outside-MRO jobs.</Empty></div></div> : (
        <>
          <table className="board pq-table">
            <thead><tr><th>Job</th><th>What</th><th>Outside MRO</th><th>Tail</th><th>Expected back</th><th>State</th><th>Technical acceptance</th>{rights.view_cost && <th>Agreed cost</th>}</tr></thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} tabIndex={0} onClick={() => navigate(`/procurement/outside-mro/${j.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/procurement/outside-mro/${j.id}`)}>
                  <td><Link className="mono" to={`/procurement/outside-mro/${j.id}`} onClick={(e) => e.stopPropagation()}>{j.number}</Link></td>
                  <td>{j.title}{j.part_number && <div className="small mono">{j.part_number}{j.serial_no && ` · S/N ${j.serial_no}`}</div>}</td>
                  <td>{j.supplier_name}</td>
                  <td className="tail">{j.tail ?? <span className="muted">—</span>}</td>
                  <td className="mono small">{j.expected_back ? formatPlainDate(j.expected_back, display) : '—'}{j.overdue && <div className="danger-text">Overdue</div>}</td>
                  <td><MroChip status={j.status} /></td>
                  <td>{j.accepted ? <span className="chip tone-green">Recorded</span> : <span className="muted small">Not yet</span>}</td>
                  {rights.view_cost && <td><Money value={j.agreed_cost} currency={rights.currency} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cards">
            {rows.map((j) => (
              <div key={j.id} className="card tail-card" role="link" tabIndex={0} onClick={() => navigate(`/procurement/outside-mro/${j.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/procurement/outside-mro/${j.id}`)}>
                <div className="top"><span><span className="mono">{j.number}</span>{j.tail && <> · <span className="tail">{j.tail}</span></>}</span><MroChip status={j.status} /></div>
                <div className="pq-card-line">{j.title}</div>
                <div className="small muted">{j.supplier_name}{j.expected_back && ` · back ${formatPlainDate(j.expected_back, display)}`}{j.overdue && ' · overdue'}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {!rights.view_cost && <NoCostNote />}
    </div>
  );
}

// ------------------------------------------------------------------ WF-MRO2
export function OutsideMroPage() {
  const { id } = useParams();
  const { display } = useAuth();
  const { rights } = useProcurementRights();
  const [j, setJ] = useState<MroDetail | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [quote, setQuote] = useState({ entry: 'quote', amount: '', note: '' });
  const [agree, setAgree] = useState({ open: false, amount: '', note: '', pin: '' });
  const [part, setPart] = useState({ open: false, pn: '', desc: '', qty: '1', cost: '' });
  const [status, setStatus] = useState({ to: '', date: '', reason: '' });
  const [acc, setAcc] = useState({ note: '', pin: '' });

  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('outside_mro_job_detail', { p_id: id });
    if (err) { setJ(null); return; }
    setJ(data as MroDetail);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (j === undefined) return <div className="page muted">Loading…</div>;
  if (j === null) return <div className="page"><p>This job does not exist or you may not see it.</p></div>;

  const cur = rights.currency;
  const done = (m: string) => { setMessage(m); setError(''); load(); };
  const call = async (fn: string, args: Record<string, unknown>, m: string) => {
    const { error: err } = await anyActions.rpc(fn, args);
    if (err) { setError(errorText(err)); return false; }
    done(m);
    return true;
  };

  const nextStatuses = ({ quoting: [], agreed: ['in_work'], in_work: ['returned'], returned: ['closed'] } as Record<string, string[]>)[j.status] ?? [];

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Outside-MRO jobs', to: '/procurement/outside-mro' }, { label: <span className="mono">{j.number}</span> }]} />
      <BackButton to="/procurement/outside-mro" label="Outside-MRO jobs" />
      <PageHead title={j.title} sub={<><span className="mono">{j.number}</span> · {j.supplier.name}{j.tail && <> · <span className="tail">{j.tail}</span></>}</>}>
        <MroChip status={j.status} />
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <Section title="Job">
        <dl className="facts">
          {j.scope && <><dt>Scope</dt><dd>{j.scope}</dd></>}
          {j.part_number && <><dt>Component</dt><dd className="mono">{j.part_number}{j.serial_no && ` · S/N ${j.serial_no}`}</dd></>}
          {j.us_return_number && <><dt>U/S return</dt><dd className="mono">{j.us_return_number}</dd></>}
          <dt>Sent</dt><dd>{j.sent_on ? formatPlainDate(j.sent_on, display) : '—'}</dd>
          <dt>Expected back</dt><dd>{j.expected_back ? formatPlainDate(j.expected_back, display) : '—'}{j.overdue && <span className="danger-text"> · overdue</span>}</dd>
          {j.returned_on && <><dt>Returned</dt><dd>{formatPlainDate(j.returned_on, display)}</dd></>}
          <dt>Outside MRO</dt><dd>{j.supplier.name}{j.supplier.contact && <span className="small muted"> · {j.supplier.contact}</span>}</dd>
          <dt>Recorded by</dt><dd><span className="mono">{j.raised_by_code}</span> · {formatDateTime(j.created_at, display)}</dd>
          {j.cancel_reason && <><dt>Cancelled</dt><dd>{j.cancel_reason}</dd></>}
        </dl>
      </Section>

      <Section title="Engineering work order">
        {j.work_order ? (
          <p><Link className="mono" to={`/work-orders/${j.work_order.id}`}>{j.work_order.number}</Link>
            {j.tail && <> · <span className="tail">{j.tail}</span></>} · <span className="dept-tag">Engineering</span> · {j.work_order.status.replace('_', ' ')}
            {j.work_order.certified_at && <span className="small muted"> · certified by <span className="mono">{j.work_order.certified_by}</span> {formatDateTime(j.work_order.certified_at, display)}</span>}</p>
        ) : <p className="small muted">No work order linked.</p>}
      </Section>

      {j.can.view_cost && (
        <Section title="Quotes and negotiation log">
          {(j.quotes ?? []).length === 0 ? <Empty>No quotes yet.</Empty> : (
            <table className="board pq-table pq-plain">
              <thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>By</th></tr></thead>
              <tbody>
                {(j.quotes ?? []).map((q) => (
                  <tr key={q.id}><td className="small">{formatDateTime(q.at, display)}</td>
                    <td>{ENTRY[q.entry] ?? q.entry}{q.note && <div className="small muted">{q.note}</div>}</td>
                    <td><Money value={q.amount} currency={cur} /></td><td className="mono">{q.by}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="pq-mobile-list">
            {(j.quotes ?? []).map((q) => (
              <li key={q.id}><strong>{ENTRY[q.entry] ?? q.entry}</strong> · <Money value={q.amount} currency={cur} />
                <span className="small muted"> · <span className="mono">{q.by}</span> · {formatDateTime(q.at, display)}</span>{q.note && <div className="small">{q.note}</div>}</li>
            ))}
          </ul>
          <p><strong>Agreed cost: </strong><Money value={j.agreed_cost} currency={cur} /></p>
          {j.can.manage && (
            <>
              <form className="pq-inline-row" onSubmit={async (e) => { e.preventDefault(); if (await call('add_mro_quote', { p_job: j.id, p_entry: quote.entry, p_amount: Number(quote.amount), p_note: quote.note || null }, 'Entry added')) setQuote({ entry: 'quote', amount: '', note: '' }); }}>
                <select aria-label="Entry" value={quote.entry} onChange={(e) => setQuote({ ...quote, entry: e.target.value })}>
                  <option value="quote">Quote received</option><option value="counter_offer">Counter-offer sent</option><option value="revised_quote">Revised quote</option>
                </select>
                <input aria-label="Amount" inputMode="decimal" placeholder={`Amount (${cur.code})`} value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value.replace(/[^0-9.]/g, '') })} required />
                <input aria-label="Note" placeholder="Note" value={quote.note} onChange={(e) => setQuote({ ...quote, note: e.target.value })} />
                <button type="submit" className="secondary">Add to log</button>
              </form>
              {!agree.open ? <div className="action-row"><button type="button" onClick={() => setAgree({ ...agree, open: true })}>Record agreed cost</button></div> : (
                <form className="pq-form pq-inline" onSubmit={async (e) => { e.preventDefault(); if (await call('agree_mro_cost', { p_job: j.id, p_amount: Number(agree.amount), p_pin: agree.pin, p_note: agree.note || null }, 'Agreed cost recorded')) setAgree({ open: false, amount: '', note: '', pin: '' }); }}>
                  <div className="row pq-row">
                    <div><label htmlFor="ag-amt">Agreed cost ({cur.code})</label><input id="ag-amt" inputMode="decimal" value={agree.amount} onChange={(e) => setAgree({ ...agree, amount: e.target.value.replace(/[^0-9.]/g, '') })} required /></div>
                    <div><label htmlFor="ag-note">Note</label><input id="ag-note" value={agree.note} onChange={(e) => setAgree({ ...agree, note: e.target.value })} /></div>
                  </div>
                  <PinField value={agree.pin} onChange={(pin) => setAgree({ ...agree, pin })} id="ag-pin" />
                  <div className="action-row"><button type="submit">Sign agreed cost</button>
                    <button type="button" className="secondary" onClick={() => setAgree({ ...agree, open: false })}>Cancel</button></div>
                </form>
              )}
            </>
          )}
        </Section>
      )}

      {j.can.view_cost && (
        <Section title="Parts used by the MRO">
          {(j.parts ?? []).length === 0 ? <Empty>None recorded.</Empty> : (
            <ul className="open-list">
              {(j.parts ?? []).map((p) => (
                <li key={p.id}><span className="mono">{p.part_number}</span><span>{p.description}</span>
                  <span className="mono">{qtyText(p.qty)}</span><span>× <Money value={p.unit_cost} currency={cur} /></span>
                  <span className="small muted">= <Money value={p.qty * p.unit_cost} currency={cur} /></span></li>
              ))}
            </ul>
          )}
          {j.can.manage && (!part.open ? <div className="action-row"><button type="button" className="secondary" onClick={() => setPart({ ...part, open: true })}>Add part used</button></div> : (
            <form className="pq-form pq-inline" onSubmit={async (e) => { e.preventDefault(); if (await call('add_mro_part', { p_job: j.id, p_qty: Number(part.qty), p_unit_cost: Number(part.cost), p_part: null, p_part_number_text: part.pn, p_description: part.desc || null }, 'Part recorded')) setPart({ open: false, pn: '', desc: '', qty: '1', cost: '' }); }}>
              <div className="row pq-row">
                <div><label htmlFor="mp-pn">Part number</label><input id="mp-pn" value={part.pn} onChange={(e) => setPart({ ...part, pn: e.target.value })} required /></div>
                <div><label htmlFor="mp-desc">Description</label><input id="mp-desc" value={part.desc} onChange={(e) => setPart({ ...part, desc: e.target.value })} /></div>
                <div><label htmlFor="mp-qty">Qty</label><input id="mp-qty" inputMode="decimal" value={part.qty} onChange={(e) => setPart({ ...part, qty: e.target.value.replace(/[^0-9.]/g, '') })} required /></div>
                <div><label htmlFor="mp-cost">Unit cost ({cur.code})</label><input id="mp-cost" inputMode="decimal" value={part.cost} onChange={(e) => setPart({ ...part, cost: e.target.value.replace(/[^0-9.]/g, '') })} required /></div>
              </div>
              <div className="action-row"><button type="submit">Add</button><button type="button" className="secondary" onClick={() => setPart({ ...part, open: false })}>Cancel</button></div>
            </form>
          ))}
        </Section>
      )}

      {j.can.view_cost && (
        <Section title="Invoices">
          <InvoicesSection invoices={j.invoices} currency={cur} canRecord={rights.manage_mro && j.status !== 'cancelled'} outsideMroJobId={j.id} onChange={load} />
        </Section>
      )}

      {j.can.manage && (
        <Section title="Progress">
          <form className="pq-form" onSubmit={async (e) => { e.preventDefault(); if (await call('set_outside_mro_status', { p_job: j.id, p_status: status.to, p_date: status.date || null, p_reason: status.reason || null }, 'Job updated')) setStatus({ to: '', date: '', reason: '' }); }}>
            <div className="row pq-row">
              <div><label htmlFor="ms-to">Move to</label>
                <select id="ms-to" value={status.to} onChange={(e) => setStatus({ ...status, to: e.target.value })} required>
                  <option value="">Choose</option>
                  {nextStatuses.map((s) => <option key={s} value={s}>{({ in_work: 'In work at MRO', returned: 'Returned from MRO', closed: 'Closed' } as Record<string, string>)[s]}</option>)}
                  <option value="cancelled">Cancelled</option>
                </select>
                {j.status === 'quoting' && <div className="small muted">Record the agreed cost before work goes ahead (D-144).</div>}</div>
              {(status.to === 'in_work' || status.to === 'returned') && <div><label htmlFor="ms-date">Date</label><input id="ms-date" type="date" value={status.date} onChange={(e) => setStatus({ ...status, date: e.target.value })} /></div>}
              {status.to === 'cancelled' && <div><label htmlFor="ms-r">Reason</label><input id="ms-r" value={status.reason} onChange={(e) => setStatus({ ...status, reason: e.target.value })} required /></div>}
            </div>
            <div className="action-row"><button type="submit">Update</button></div>
          </form>
        </Section>
      )}

      <Section title="Technical acceptance">
        {j.acceptance ? (
          <p>Accepted by <span className="mono">{j.acceptance.by}</span> {j.acceptance.by_name} · {formatDateTime(j.acceptance.at, display)}<br />
            <span className="small">{j.acceptance.note}</span></p>
        ) : <p className="small muted">Not recorded yet.</p>}
        <p className="small muted">Recorded by Engineering or Quality, not by Procurement (D-020, D-144). Nexus records what they state.</p>
        {j.can.accept && (
          <form className="pq-form" onSubmit={async (e) => { e.preventDefault(); if (await call('record_mro_technical_acceptance', { p_job: j.id, p_note: acc.note, p_pin: acc.pin }, 'Technical acceptance recorded')) setAcc({ note: '', pin: '' }); }}>
            <label htmlFor="ta-note">What was accepted, against which record</label>
            <input id="ta-note" value={acc.note} onChange={(e) => setAcc({ ...acc, note: e.target.value })} required placeholder="e.g. Release certificate checked; fitted under WO-000213" />
            <PinField value={acc.pin} onChange={(pin) => setAcc({ ...acc, pin })} id="ta-pin" />
            <div className="action-row"><button type="submit">Sign technical acceptance</button></div>
          </form>
        )}
      </Section>
      {!j.can.view_cost && <NoCostNote />}
    </div>
  );
}
