// Requisitions (WF-K1 list, WF-K2 detail) and raising one.
//
//   D-073  Supply raises a requisition when stock is short; Procurement then
//          sources it after the approval chain.
//   D-145  one part request line = one requisition line. The engineer's line
//          shows "on order" and follows the requisition, without cost.
//   D-146  the chain depends on priority and value band (operator setting);
//          the raiser approves no step; nobody approves two steps.
//   D-079  a rejection needs a reason and returns to the raiser, who may
//          resubmit it as a new version.
//   D-147  AOG only for a part request whose AOG is confirmed.
//   D-077, D-121, D-127  estimated values only for people with "View cost";
//          the server sends no price to anyone else.
// Approving and raising need a connection: nothing here is queued offline (D-104).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime, heldFor } from '../../lib/format';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import {
  Empty, Money, NoCostNote, type Currency, PoChip, ProcurementTabs, ReqPriorityChip, RequisitionChip, qtyText, useProcurementRights,
} from './common';

export type ReqRow = {
  id: string; number: string; version: number; kind: 'part_request' | 'repair' | 'replenishment'; status: string;
  stage: string; holder: string | null; held_since: string | null; priority: 'ROUTINE' | 'AOG';
  part_id: string | null; part_number: string; description: string | null; unit: string | null; qty: number;
  store_code: string; aircraft_id: string | null; tail: string | null; request_id: string | null;
  request_number: string | null; request_line_id: string | null; request_line_state: string | null;
  request_cancelled: boolean; us_return_id: string | null; us_return_number: string | null; purpose: string | null;
  remarks: string | null; required_by: string | null; action_type: string; chain_name: string;
  approval_request_id: string | null; step_no: number | null; step_count: number; step_name: string | null;
  raised_by: string; raised_by_code: string; raised_at: string; rejected_reason: string | null;
  superseded_by: string | null; cancel_reason: string | null; po_id: string | null; po_number: string | null;
  po_status: string | null; po_eta: string | null; supplier_name: string | null;
  estimated_value: number | null; currency: string | null; can_approve: boolean;
};

type Step = {
  step_no: number; name: string; held_by: string | null; decision: 'approve' | 'reject' | null;
  decided_by: string | null; decided_by_name: string | null; decided_at: string | null; reason: string | null; current: boolean;
};
type ReqDetail = ReqRow & {
  steps: Step[];
  versions: { id: string; version: number; status: string; raised_at: string; rejected_reason: string | null }[];
  same_part_recently: { id: string; number: string; qty: number; raised_at: string; status: string }[];
  can: { approve: boolean; manage: boolean; raise_po: boolean; view_cost: boolean };
};

const KIND_LABEL: Record<string, string> = {
  part_request: 'For a part request', repair: 'Repair (U/S part)', replenishment: 'Stock replenishment',
};

// The approvals inbox (lead's Approvals.tsx) can group these action types
// under "Requisitions" and link to /procurement/requisitions/<record_id>.
export const REQUISITION_ACTION_TYPES = ['requisition', 'requisition_high', 'requisition_aog'];

export function useRequisitions(openOnly = true) {
  const [rows, setRows] = useState<ReqRow[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('requisition_list', { p_id: null, p_open_only: openOnly });
    setError(err ? errorText(err) : '');
    setRows((data ?? []) as ReqRow[]);
  }, [openOnly]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { rows, error, reload: load };
}

// ------------------------------------------------------------------ table
export function RequisitionTable({ rows, showCost, currency }: { rows: ReqRow[]; showCost: boolean; currency: Currency }) {
  const navigate = useNavigate();
  const open = (r: ReqRow) => navigate(`/procurement/requisitions/${r.id}`);
  return (
    <>
      <table className="board pq-table">
        <thead>
          <tr>
            <th>Requisition</th><th>Part</th><th>Tail</th><th>Priority</th><th>Where it stands</th><th>Holder</th><th>Held for</th>
            {showCost && <th>Est. value</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} tabIndex={0} onClick={() => open(r)} onKeyDown={(e) => e.key === 'Enter' && open(r)}
              className={r.can_approve ? 'pq-mine' : undefined}>
              <td><Link className="mono" to={`/procurement/requisitions/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.number}</Link>
                {r.version > 1 && <span className="small muted"> v{r.version}</span>}
                <div className="small muted">{KIND_LABEL[r.kind]}</div></td>
              <td>{qtyText(r.qty)} × {r.description ?? ''} <span className="mono small">{r.part_number}</span></td>
              <td className="tail">{r.tail ?? <span className="muted">—</span>}</td>
              <td><ReqPriorityChip priority={r.priority} /></td>
              <td><RequisitionChip status={r.status} stage={r.stage} />
                {r.can_approve && <div className="small pq-yours">Waiting for you</div>}
                {r.request_cancelled && <div className="small danger-text">Part request cancelled</div>}</td>
              <td>{r.holder ? <span className="dept-tag">{r.holder}</span> : <span className="muted">—</span>}</td>
              <td className="mono small">{r.holder ? heldFor(r.held_since) : '—'}</td>
              {showCost && <td><Money value={r.estimated_value} currency={currency} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cards">
        {rows.map((r) => (
          <div key={r.id} className="card tail-card" role="link" tabIndex={0} onClick={() => open(r)}
            onKeyDown={(e) => e.key === 'Enter' && open(r)}>
            <div className="top">
              <span><span className="mono">{r.number}</span>{r.tail && <> · <span className="tail">{r.tail}</span></>}</span>
              <ReqPriorityChip priority={r.priority} />
            </div>
            <div className="pq-card-line">{qtyText(r.qty)} × {r.description ?? ''} <span className="mono small">{r.part_number}</span></div>
            <div className="chip-row"><RequisitionChip status={r.status} stage={r.stage} />
              {r.holder && <span className="small muted">With {r.holder} · {heldFor(r.held_since)}</span>}</div>
            {r.can_approve && <div className="small pq-yours">Waiting for you</div>}
            {showCost && r.estimated_value !== null && <div className="small">Est. <Money value={r.estimated_value} currency={currency} /></div>}
          </div>
        ))}
      </div>
    </>
  );
}

// Part request lines that Supply found short (state "needs requisition").
type ShortLine = {
  line_id: string; request_id: string; request_number: string; line_no: number; tail: string | null;
  part_number: string; description: string | null; qty: number; priority: string; aog_confirmed: boolean;
  state: string; state_reason: string | null; held_since: string; store_code: string;
};

// ------------------------------------------------------------------ WF-K1
// /procurement/requisitions  (Procurement and Supply)
export function RequisitionList() {
  const { rights, label } = useProcurementRights();
  const [view, setView] = useState<'open' | 'mine' | 'all'>('open');
  const { rows, error } = useRequisitions(view !== 'all');
  const [short, setShort] = useState<ShortLine[]>([]);

  // Supply: request lines waiting for a requisition (D-073, D-145).
  useEffect(() => {
    if (!rights.raise_requisition) return;
    anyActions.rpc('part_request_lines', { p_aircraft: null, p_work_order: null, p_request: null, p_open_only: true })
      .then(({ data }: { data: ShortLine[] | null }) => setShort((data ?? []).filter((l) => l.state === 'needs_requisition')));
  }, [rights.raise_requisition]);

  const shown = (rows ?? []).filter((r) => view !== 'mine' || r.can_approve);
  const mineCount = (rows ?? []).filter((r) => r.can_approve).length;

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('requisition', true) }]} />
      <BackButton to="/" label="All aircraft" />
      <ProcurementTabs />
      <PageHead title={label('requisition', true)} sub="AOG first · each step held by the person or office shown (D-076, D-146)">
        {rights.raise_requisition && <Link className="button" to="/procurement/requisitions/new?kind=replenishment">New stock replenishment</Link>}
      </PageHead>
      {error && <div className="error" role="alert">{error}</div>}

      {rights.raise_requisition && (
        <Section title={`Not in stock · requisition needed (${short.length})`}>
          {short.length === 0 ? <Empty>No part request lines are waiting for a requisition.</Empty> : (
            <ul className="open-list">
              {short.map((l) => (
                <li key={l.line_id}>
                  <Link className="mono" to={`/part-requests/${l.request_id}`}>{l.request_number}</Link>
                  <span className="tail">{l.tail ?? '—'}</span>
                  <span>{qtyText(l.qty)} × {l.description ?? ''} <span className="mono small">{l.part_number}</span></span>
                  {l.priority === 'AOG' && <span className={`chip ${l.aog_confirmed ? 'tone-aog' : 'tone-red'}`}>{l.aog_confirmed ? 'AOG' : 'AOG · unconfirmed'}</span>}
                  <span className="small muted">{l.state_reason ?? ''} · {heldFor(l.held_since)}</span>
                  <Link className="button" to={`/procurement/requisitions/new?line=${l.line_id}`}>Raise requisition</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <div className="chips-row" role="group" aria-label="Show">
        <button type="button" className="fchip" aria-pressed={view === 'open'} onClick={() => setView('open')}>Open</button>
        <button type="button" className="fchip" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>Waiting for me ({mineCount})</button>
        <button type="button" className="fchip" aria-pressed={view === 'all'} onClick={() => setView('all')}>All, including closed</button>
      </div>
      {rows === null ? <p className="muted">Loading…</p> : shown.length === 0
        ? <div className="box"><div className="box-body"><Empty>No requisitions to show.</Empty></div></div>
        : <RequisitionTable rows={shown} showCost={rights.view_cost} currency={rights.currency} />}
      {!rights.view_cost && <NoCostNote />}
    </div>
  );
}

// --------------------------------------------------------- raise (form)
// Used by /procurement/requisitions/new and, for the stores screens, as a
// panel: <RaiseRequisitionForm kind="repair" usReturnId={id} onDone={...} />
export type RaiseResult = { id: string; number: string; chain: string; chain_name: string };

type LineBrief = { line_id: string; request_number: string; tail: string | null; description: string | null; part_number: string;
  qty: number; priority: string; aog_confirmed: boolean; store_code: string; state: string };
type UsBrief = { id: string; number: string; serial_no: string | null; status: string; store_code: string;
  part: { part_number: string; description: string } | null; part_number_text: string | null; aircraft: { tail: string } | null };
type PartHit = { part_id: string; part_number: string; description: string; unit: string };

export function RaiseRequisitionForm({ kind, lineId, usReturnId, onDone, onCancel }: {
  kind: 'part_request' | 'repair' | 'replenishment'; lineId?: string; usReturnId?: string;
  onDone: (r: RaiseResult) => void; onCancel?: () => void;
}) {
  const { rights } = useProcurementRights();
  const [line, setLine] = useState<LineBrief | null>(null);
  const [us, setUs] = useState<UsBrief | null>(null);
  const [f, setF] = useState({ priority: 'ROUTINE', value: '', requiredBy: '', remarks: '', qty: '1', purpose: '', store: '' });
  const [partText, setPartText] = useState('');
  const [hits, setHits] = useState<PartHit[]>([]);
  const [part, setPart] = useState<PartHit | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind === 'part_request' && lineId) {
      anyActions.rpc('part_request_lines', { p_aircraft: null, p_work_order: null, p_request: null, p_open_only: true })
        .then(({ data }: { data: LineBrief[] | null }) => {
          const l = (data ?? []).find((x) => x.line_id === lineId) ?? null;
          setLine(l);
          if (l?.priority === 'AOG' && l.aog_confirmed) setF((v) => ({ ...v, priority: 'AOG' }));
        });
    }
    if (kind === 'repair' && usReturnId) {
      anyDb.from('us_return').select('id, number, serial_no, status, store_code, part_number_text, part:part_id (part_number, description), aircraft:aircraft_id (tail)')
        .eq('id', usReturnId).maybeSingle().then(({ data }: { data: UsBrief | null }) => setUs(data));
    }
  }, [kind, lineId, usReturnId]);

  useEffect(() => {
    if (!f.store && rights.stores.length) setF((v) => ({ ...v, store: rights.stores[0] }));
  }, [rights.stores, f.store]);

  useEffect(() => {
    if (kind !== 'replenishment' || part || partText.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => anyActions.rpc('search_stores', { p_text: partText.trim(), p_limit: 8 })
      .then(({ data }: { data: PartHit[] | null }) => setHits(data ?? [])), 250);
    return () => clearTimeout(t);
  }, [kind, partText, part]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const args: Record<string, unknown> = {
      p_kind: kind, p_priority: f.priority,
      p_estimated_value: f.value.trim() === '' ? null : Number(f.value),
      p_required_by: f.requiredBy ? new Date(`${f.requiredBy}T12:00:00`).toISOString() : null,
      p_remarks: f.remarks || null, p_device_time: new Date().toISOString(),
    };
    if (kind === 'part_request') args.p_request_line = lineId;
    if (kind === 'repair') args.p_us_return = usReturnId;
    if (kind === 'replenishment') {
      Object.assign(args, {
        p_store: f.store, p_qty: Number(f.qty), p_purpose: f.purpose,
        p_part: part?.part_id ?? null, p_part_number_text: part ? null : partText.trim() || null,
      });
    }
    const { data, error: err } = await anyActions.rpc('raise_requisition', args);
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(data as RaiseResult);
  }

  const aogAllowed = kind === 'part_request' && line?.priority === 'AOG' && line.aog_confirmed;

  return (
    <form className="pq-form" onSubmit={submit}>
      {kind === 'part_request' && (line ? (
        <div className="mel-chosen">
          For <span className="mono">{line.request_number}</span>{line.tail && <> · <span className="tail">{line.tail}</span></>}:{' '}
          {qtyText(line.qty)} × {line.description ?? ''} <span className="mono">{line.part_number}</span> · {line.store_code}
          <div className="small muted">One request line, one requisition (D-145). Quantity and part come from the request.</div>
        </div>
      ) : lineId ? <p className="muted">Loading the request line…</p> : <p className="danger-text">Open this from a part request line.</p>)}
      {kind === 'repair' && (us ? (
        <div className="mel-chosen">
          Repair of <span className="mono">{us.part?.part_number ?? us.part_number_text}</span> {us.part?.description}
          {us.serial_no && <> · S/N <span className="mono">{us.serial_no}</span></>} · {us.number}
          {us.aircraft && <> · removed from <span className="tail">{us.aircraft.tail}</span></>}
          {us.status !== 'received' && <div className="small danger-text">Receive and tag the part first.</div>}
        </div>
      ) : <p className="muted">Loading the U/S return…</p>)}
      {kind === 'replenishment' && (
        <>
          {part ? (
            <div className="mel-chosen"><span className="mono">{part.part_number}</span> · {part.description}
              <button type="button" className="link-button" onClick={() => setPart(null)}>Change</button></div>
          ) : (
            <>
              <label htmlFor="rq-part">Part number or description</label>
              <input id="rq-part" value={partText} onChange={(e) => setPartText(e.target.value)} autoComplete="off" required />
              {hits.length > 0 && (
                <ul className="pick-list">
                  {hits.map((h) => (
                    <li key={h.part_id}><button type="button" onClick={() => setPart(h)}>
                      <span className="mono">{h.part_number}</span><span>{h.description}</span></button></li>
                  ))}
                </ul>
              )}
              <div className="small muted">Not in the catalogue? Leave the typed part number; Supply catalogues it on receipt.</div>
            </>
          )}
          <div className="row pq-row">
            <div><label htmlFor="rq-store">Store</label>
              <select id="rq-store" value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })}>
                {rights.stores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label htmlFor="rq-qty">Quantity</label>
              <input id="rq-qty" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^0-9.]/g, '') })} required /></div>
          </div>
          <label htmlFor="rq-purpose">Purpose (required for stock replenishment)</label>
          <input id="rq-purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} required
            placeholder="e.g. Minimum stock for the A-check season" />
        </>
      )}

      <div className="row pq-row">
        <div>
          <label htmlFor="rq-prio">Priority</label>
          <select id="rq-prio" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option value="ROUTINE">Routine</option>
            {aogAllowed && <option value="AOG">AOG (confirmed on the request, D-147)</option>}
          </select>
          {kind === 'part_request' && line?.priority === 'AOG' && !line.aog_confirmed &&
            <div className="small muted">The request's AOG is not confirmed yet, so this goes as Routine (D-147).</div>}
        </div>
        <div>
          <label htmlFor="rq-val">Estimated value ({rights.currency.code})</label>
          <input id="rq-val" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, '') })} />
          <div className="small muted">Chooses the approval chain (D-146). Left empty, the strictest chain applies.
            {!rights.view_cost && ' You will not see it again without “View cost”.'}</div>
        </div>
        <div>
          <label htmlFor="rq-by">Required by</label>
          <input id="rq-by" type="date" value={f.requiredBy} onChange={(e) => setF({ ...f, requiredBy: e.target.value })} />
        </div>
      </div>
      <label htmlFor="rq-rem">Remarks</label>
      <input id="rq-rem" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} placeholder="e.g. Supplier quote reference" />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Raising…' : 'Raise requisition'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
      <p className="small muted">It goes straight into the approval chain. You cannot approve any step of a requisition you raised (D-146).</p>
    </form>
  );
}

// /procurement/requisitions/new?line=<line id> | ?us_return=<id> | ?kind=replenishment
export function NewRequisition() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { label } = useProcurementRights();
  const lineId = params.get('line') ?? undefined;
  const usReturnId = params.get('us_return') ?? undefined;
  const kind = lineId ? 'part_request' : usReturnId ? 'repair' : 'replenishment';
  const title = { part_request: 'Raise requisition for a part request', repair: 'Raise repair requisition', replenishment: 'Stock replenishment requisition' }[kind];
  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('requisition', true), to: '/procurement/requisitions' }, { label: 'New' }]} />
      <BackButton to="/procurement/requisitions" label={label('requisition', true)} />
      <PageHead title={title} sub="Supply raises; the approval chain decides; Procurement then orders (D-073)" />
      <Section title="Requisition">
        <RaiseRequisitionForm kind={kind} lineId={lineId} usReturnId={usReturnId}
          onDone={(r) => navigate(`/procurement/requisitions/${r.id}`, { state: { message: `${r.number} raised · ${r.chain_name}` } })}
          onCancel={() => navigate(-1)} />
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ WF-K2
export function RequisitionPage() {
  const { id } = useParams();
  const { display } = useAuth();
  const navigate = useNavigate();
  const { rights, label } = useProcurementRights();
  const [r, setR] = useState<ReqDetail | null | undefined>(undefined);
  const [error, setError] = useState('');
  const location = useLocation();
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage((location.state as { message?: string } | null)?.message ?? ''); }, [location.state]);
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [resub, setResub] = useState<{ open: boolean; value: string; priority: string; remarks: string }>({ open: false, value: '', priority: 'ROUTINE', remarks: '' });

  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('requisition_detail', { p_id: id });
    if (err) { setR(null); return; }
    setR(data as ReqDetail);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (r === undefined) return <div className="page muted">Loading…</div>;
  if (r === null) return <div className="page"><p>This requisition does not exist or you may not see it (D-125, D-127).</p></div>;

  async function decide(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { data, error: err } = await anyActions.rpc('decide_approval', {
      p_request: r!.approval_request_id, p_decision: mode, p_pin: pin, p_reason: mode === 'reject' ? reason : null,
    });
    if (err) return setError(errorText(err));
    setPin(''); setReason('');
    setMessage(mode === 'reject' ? 'Rejected · returned to the raiser with your reason (D-079)'
      : data === 'approved' ? 'Approved · all steps done; Procurement sources it' : `Approved · now at ${String(data)}`);
    window.dispatchEvent(new Event('nexus:approvals'));
    load();
  }
  async function cancel(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await anyActions.rpc('cancel_requisition', { p_req: r!.id, p_reason: cancelReason });
    if (err) return setError(errorText(err));
    setCancelOpen(false);
    setMessage('Cancelled.');
    load();
  }
  async function resubmit(e: FormEvent) {
    e.preventDefault();
    const { data, error: err } = await anyActions.rpc('resubmit_requisition', {
      p_req: r!.id, p_estimated_value: resub.value.trim() === '' ? null : Number(resub.value),
      p_priority: resub.priority, p_qty: null, p_required_by: null, p_remarks: resub.remarks || null,
    });
    if (err) return setError(errorText(err));
    const v = data as { id: string; number: string; version: number };
    navigate(`/procurement/requisitions/${v.id}`, { state: { message: `${v.number} v${v.version} resubmitted` } });
  }

  const latest = !r.superseded_by;
  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('requisition', true), to: '/procurement/requisitions' },
        { label: <span className="mono">{r.number}{r.version > 1 ? ` v${r.version}` : ''}</span> }]} />
      <BackButton to="/procurement/requisitions" label={label('requisition', true)} />
      <PageHead title={<><span className="mono">{r.number}</span>{r.version > 1 && <span className="small muted"> v{r.version}</span>}{r.tail && <> · <span className="tail">{r.tail}</span></>}</>}
        sub={`${label('requisition')} detail · ${KIND_LABEL[r.kind]}`}>
        <ReqPriorityChip priority={r.priority} />
        <RequisitionChip status={r.status} stage={r.stage} />
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {!latest && <div className="note warn">A newer version exists. <Link to={`/procurement/requisitions/${r.superseded_by}`}>Open the latest version</Link>.</div>}
      {r.request_cancelled && <div className="note warn">The part request was cancelled. Procurement decides whether to cancel the order or receive the part into stock; it is never silently dropped (part-request.md §8.5).</div>}

      <Section title="What is needed">
        <dl className="facts">
          <dt>Part</dt><dd>{qtyText(r.qty)} {r.unit ?? ''} × {r.description ?? ''} <span className="mono">{r.part_number}</span></dd>
          <dt>Store</dt><dd><span className="dept-tag">{r.store_code}</span></dd>
          {r.request_number && <><dt>{label('part_request')}</dt><dd><Link className="mono" to={`/part-requests/${r.request_id}`}>{r.request_number}</Link>
            {r.request_line_state && <span className="small muted"> · line {r.request_line_state.replace('_', ' ')}</span>}</dd></>}
          {r.us_return_number && <><dt>U/S return</dt><dd className="mono">{r.us_return_number}</dd></>}
          {r.purpose && <><dt>Purpose</dt><dd>{r.purpose}</dd></>}
          {r.required_by && <><dt>Required by</dt><dd>{formatDateTime(r.required_by, display)}</dd></>}
          {r.remarks && <><dt>Remarks</dt><dd>{r.remarks}</dd></>}
          <dt>Raised</dt><dd><span className="mono">{r.raised_by_code}</span> · {formatDateTime(r.raised_at, display)}</dd>
          <dt>Estimated value</dt><dd>{r.can.view_cost ? <Money value={r.estimated_value} currency={rights.currency} /> : <span className="muted">Hidden · needs “View cost”</span>}</dd>
          {r.po_number && <><dt>{label('purchase_order')}</dt><dd>
            {rights.see_purchase_orders ? <Link className="mono" to={`/procurement/purchase-orders/${r.po_id}`}>{r.po_number}</Link> : <span className="mono">{r.po_number}</span>}
            {' '}{r.po_status && <PoChip status={r.po_status} />}{r.supplier_name && <span className="small muted"> · {r.supplier_name}</span>}
            {r.po_eta && <span className="small muted"> · ETA {r.po_eta}</span>}</dd></>}
          {r.cancel_reason && <><dt>Cancelled</dt><dd>{r.cancel_reason}</dd></>}
        </dl>
      </Section>

      <Section title={<>Approval chain <span className="small muted">· {r.chain_name} · set up per operator (D-076)</span></>}>
        <ol className="pq-chain">
          {r.steps.map((s) => {
            const state = s.decision === 'approve' ? 'done' : s.decision === 'reject' ? 'rejected' : s.current ? 'now' : 'todo';
            return (
              <li key={s.step_no} className={`pq-step ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                <span className="pq-step-mark" aria-hidden>{{ done: '✓', rejected: '✕', now: '●', todo: '○' }[state]}</span>
                <span className="pq-step-name">{s.name} <span className="small muted">({s.held_by})</span></span>
                <span className="small">
                  {s.decision === 'approve' && <>Approved · <span className="mono">{s.decided_by}</span> · {formatDateTime(s.decided_at, display)}</>}
                  {s.decision === 'reject' && <>Rejected · <span className="mono">{s.decided_by}</span> · {formatDateTime(s.decided_at, display)} · “{s.reason}”</>}
                  {state === 'now' && <>Pending since {formatDateTime(r.held_since, display)} · {heldFor(r.held_since)}</>}
                </span>
              </li>
            );
          })}
        </ol>
        {r.status === 'rejected' && r.rejected_reason && <div className="note warn">Rejected: {r.rejected_reason} (D-079)</div>}

        {r.can.approve && (
          <form className="pq-form pq-decide" onSubmit={decide}>
            <div className="chips-row">
              <button type="button" className="fchip" aria-pressed={mode === 'approve'} onClick={() => setMode('approve')}>Approve</button>
              <button type="button" className="fchip" aria-pressed={mode === 'reject'} onClick={() => setMode('reject')}>Reject</button>
            </div>
            {mode === 'reject' && (
              <>
                <label htmlFor="rq-reason">Reason (the raiser sees it, D-079)</label>
                <input id="rq-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
              </>
            )}
            <PinField value={pin} onChange={setPin} id="rq-pin" />
            <div className="action-row">
              <button type="submit" className={mode === 'reject' ? 'danger-button' : undefined}>
                {mode === 'approve' ? `Approve step ${r.step_no}` : 'Reject and return to raiser'}</button>
            </div>
          </form>
        )}
        {!r.can.approve && r.status === 'in_approval' && (
          <p className="small muted">Waiting for {r.step_name}. The raiser cannot approve, and nobody approves two steps (D-146).</p>
        )}
      </Section>

      {r.same_part_recently.length > 0 && (
        <Section title="Same part requisitioned recently" tone="warn">
          <p className="small">Shown to spot split purchases (part-request.md R-3). Nexus only shows it; people decide.</p>
          <ul className="open-list">
            {r.same_part_recently.map((o) => (
              <li key={o.id}><Link className="mono" to={`/procurement/requisitions/${o.id}`}>{o.number}</Link>
                <span>{qtyText(o.qty)}</span><span className="small muted">{o.status.replace('_', ' ')} · {formatDateTime(o.raised_at, display)}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {r.versions.length > 1 && (
        <Section title="Versions">
          <ul className="open-list">
            {r.versions.map((v) => (
              <li key={v.id}><Link className="mono" to={`/procurement/requisitions/${v.id}`}>v{v.version}</Link>
                <RequisitionChip status={v.status} /><span className="small muted">{formatDateTime(v.raised_at, display)}</span>
                {v.rejected_reason && <span className="small">“{v.rejected_reason}”</span>}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="action-row">
        {r.can.raise_po && !r.po_id && <Link className="button" to={`/procurement/purchase-orders/new?req=${r.id}`}>Raise purchase order</Link>}
        {r.request_id && <Link className="button outline-button" to={`/part-requests/${r.request_id}`}>Open part request</Link>}
        {r.can.manage && latest && r.status === 'rejected' && !resub.open &&
          <button type="button" onClick={() => setResub({ ...resub, open: true, priority: r.priority })}>Resubmit as new version</button>}
        {r.can.manage && latest && ['in_approval', 'approved', 'rejected'].includes(r.status) && !r.po_id && !cancelOpen &&
          <button type="button" className="secondary" onClick={() => setCancelOpen(true)}>Cancel requisition</button>}
      </div>

      {resub.open && (
        <Section title="Resubmit (new version, D-079)">
          <form className="pq-form" onSubmit={resubmit}>
            <div className="row pq-row">
              <div><label htmlFor="rs-val">Estimated value ({rights.currency.code})</label>
                <input id="rs-val" inputMode="decimal" value={resub.value} onChange={(e) => setResub({ ...resub, value: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              <div><label htmlFor="rs-prio">Priority</label>
                <select id="rs-prio" value={resub.priority} onChange={(e) => setResub({ ...resub, priority: e.target.value })}>
                  <option value="ROUTINE">Routine</option><option value="AOG">AOG (confirmed request only, D-147)</option>
                </select></div>
            </div>
            <label htmlFor="rs-rem">What changed</label>
            <input id="rs-rem" value={resub.remarks} onChange={(e) => setResub({ ...resub, remarks: e.target.value })} placeholder="e.g. Second quote from Supplier A attached to file" />
            <div className="action-row"><button type="submit">Resubmit</button>
              <button type="button" className="secondary" onClick={() => setResub({ ...resub, open: false })}>Cancel</button></div>
          </form>
        </Section>
      )}
      {cancelOpen && (
        <Section title="Cancel requisition">
          <form className="pq-form" onSubmit={cancel}>
            <label htmlFor="rq-cancel">Reason (kept on record, D-023)</label>
            <input id="rq-cancel" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
            <div className="action-row"><button type="submit" className="danger-button">Cancel requisition</button>
              <button type="button" className="secondary" onClick={() => setCancelOpen(false)}>Keep it</button></div>
          </form>
        </Section>
      )}
      {!r.can.view_cost && <NoCostNote />}
    </div>
  );
}
