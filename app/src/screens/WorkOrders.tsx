// Work orders (D-063 to D-069, D-214).
//
// The life of a work order:
//   requested ─ Quality pre-approves ─► pre_approved ─ CO approves ─► open
//   open ─ entries recorded ─ "work complete" ─► work_complete
//   work_complete ─ scans attached (sign-off card…) ─ certify with PIN ─► certified
//   (a rejection at either step sends the snag back to the engineer)
//
// Certifying closes the snag. It does NOT change the tail status (D-046); the
// page offers "Set tail status" right after, signed with the PIN (D-215).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { TailStatusChip } from '../components/StatusChip';
import { Attachments, KIND_LABEL } from '../components/Attachments';
import { PinField } from '../components/PinField';
import { SetTailStatus } from '../components/SetTailStatus';

const WO_STATE: Record<string, { label: string; tone: string }> = {
  requested:     { label: 'Awaiting Quality', tone: 'amber' },
  pre_approved:  { label: 'Awaiting CO', tone: 'amber' },
  open:          { label: 'Open for work', tone: 'blue' },
  work_complete: { label: 'Awaiting certification', tone: 'amber' },
  certified:     { label: 'Certified', tone: 'green' },
  rejected:      { label: 'Rejected', tone: 'red' },
  cancelled:     { label: 'Cancelled', tone: 'grey' },
};

export function WorkOrderChip({ status }: { status: string }) {
  const s = WO_STATE[status] ?? { label: status, tone: 'grey' };
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  active:   { label: 'Not finished', statuses: ['requested', 'pre_approved', 'open', 'work_complete'] },
  approval: { label: 'Awaiting approval', statuses: ['requested', 'pre_approved'] },
  open:     { label: 'Open for work', statuses: ['open'] },
  certify:  { label: 'Awaiting certification', statuses: ['work_complete'] },
  certified:{ label: 'Certified', statuses: ['certified'] },
  rejected: { label: 'Rejected', statuses: ['rejected'] },
  all:      { label: 'All', statuses: null },
};

type ListRow = {
  id: string; number: string; status: string; scope: string; created_at: string;
  aircraft: { tail: string } | null; snag: { number: string } | null;
};

export function WorkOrderList() {
  const { display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'active';
  const tail = params.get('aircraft') ?? '';
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let q = db.from('work_order')
      .select('id, number, status, scope, created_at, aircraft:aircraft_id (tail), snag:snag_id (number)')
      .order('created_at', { ascending: false }).limit(200);
    const st = VIEWS[view]?.statuses;
    if (st) q = q.in('status', st);
    if (tail) q = q.eq('aircraft_id', tail);
    q.then(({ data, error: err }) => {
      if (err) setError(errorText(err));
      setRows((data ?? []) as unknown as ListRow[]);
    });
  }, [view, tail]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Engineering › Work orders</div>
      <div className="page-head">
        <h1>Work orders</h1>
        <div className="row filter-row">
          <select aria-label="Which work orders" value={view} onChange={(e) => set('view', e.target.value)}>
            {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>Show: {v.label}</option>)}
          </select>
          <AircraftPicker aircraft={aircraft} value={tail} onChange={(id) => set('aircraft', id)} placeholder="All tails" />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {rows?.length === 0 && <p className="muted">No work orders match.</p>}
      {rows && rows.length > 0 && (
        <>
          <table className="board">
            <thead><tr><th>Work order</th><th>Tail</th><th>State</th><th>Work</th><th>Raised</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} tabIndex={0} onClick={() => navigate(`/work-orders/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/work-orders/${r.id}`)}>
                  <td className="mono">{r.number}{r.snag && <div className="small muted">{r.snag.number}</div>}</td>
                  <td className="tail">{r.aircraft?.tail}</td>
                  <td><WorkOrderChip status={r.status} /></td>
                  <td>{r.scope}</td>
                  <td className="small">{formatDateTime(r.created_at, display)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cards">
            {rows.map((r) => (
              <button key={r.id} type="button" className="card tail-card" onClick={() => navigate(`/work-orders/${r.id}`)}>
                <div className="top">
                  <span><span className="mono">{r.number}</span> · <span className="tail">{r.aircraft?.tail}</span></span>
                  <WorkOrderChip status={r.status} />
                </div>
                <div style={{ margin: '6px 0' }}>{r.scope}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type WO = {
  id: string; number: string; status: string; scope: string; est_man_hours: number | null;
  created_at: string; work_completed_at: string | null; certified_at: string | null; certification_note: string | null;
  approval_request_id: string | null; aircraft_id: string;
  aircraft: { tail: string; aircraft_type_code: string } | null;
  snag: { id: string; number: string; description: string } | null;
  requester: { three_letter_code: string } | null;
  completer: { three_letter_code: string } | null;
  certifier: { three_letter_code: string } | null;
};
type Decision = { step_no: number; decision: string; reason: string | null; created_at: string; decider: { three_letter_code: string } | null };
type Step = { step_no: number; name: string };
type Entry = { id: string; entry: string; created_at: string; author: { three_letter_code: string } | null };

export function WorkOrderPage() {
  const { id } = useParams();
  const { me, display } = useAuth();
  const [wo, setWo] = useState<WO | null | undefined>(undefined);
  const [steps, setSteps] = useState<Step[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [tailStatus, setTailStatus] = useState<string | null>(null);
  const [canCertify, setCanCertify] = useState(false);
  const [message, setMessage] = useState('');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const checkMissing = useCallback(async () => {
    const { data } = await actions.rpc('work_order_missing_scans', { p_wo: id! });
    setMissing((data ?? []) as string[]);
  }, [id]);

  const load = useCallback(async () => {
    const { data } = await db.from('work_order')
      .select(`id, number, status, scope, est_man_hours, created_at, work_completed_at, certified_at,
               certification_note, approval_request_id, aircraft_id,
               aircraft:aircraft_id (tail, aircraft_type_code), snag:snag_id (id, number, description),
               requester:requested_by (three_letter_code), completer:work_completed_by (three_letter_code),
               certifier:certified_by (three_letter_code)`)
      .eq('id', id!).maybeSingle();
    const w = data as unknown as WO | null;
    setWo(w);
    if (!w) return;
    const [st, dec, en, ts] = await Promise.all([
      db.from('approval_chain_step').select('step_no, name').eq('action_type', 'work_order').order('step_no'),
      w.approval_request_id
        ? db.from('approval_decision').select('step_no, decision, reason, created_at, decider:decided_by (three_letter_code)')
            .eq('request_id', w.approval_request_id).order('created_at')
        : Promise.resolve({ data: [] }),
      db.from('work_order_entry').select('id, entry, created_at, author:entered_by (three_letter_code)')
        .eq('work_order_id', w.id).order('created_at'),
      db.from('aircraft_current_status').select('status').eq('aircraft_id', w.aircraft_id).maybeSingle(),
    ]);
    setSteps((st.data ?? []) as Step[]);
    setDecisions((dec.data ?? []) as unknown as Decision[]);
    setEntries((en.data ?? []) as unknown as Entry[]);
    setTailStatus((ts.data as { status: string } | null)?.status ?? null);
    await checkMissing();
    if (me && w.aircraft) {
      const { data: c } = await actions.rpc('is_certifying', { p_person: me.personId, p_aircraft_type: w.aircraft.aircraft_type_code });
      setCanCertify(c === true);
    }
  }, [id, me, checkMissing]);

  useEffect(() => { load(); }, [load]);

  if (wo === undefined) return <div className="page muted">Loading…</div>;
  if (wo === null) return <div className="page"><p>This work order does not exist or is outside what you may see.</p></div>;

  const tail = wo.aircraft?.tail ?? '';
  const done = (m: string) => { setMessage(m); load(); };
  const decided = new Map(decisions.map((d) => [d.step_no, d]));
  const canUpload = isEngineer && (wo.status === 'open' || wo.status === 'work_complete');

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">All aircraft</Link> › <Link className="mono" to={`/aircraft/${wo.aircraft_id}`}>{tail}</Link> ›{' '}
        <Link to="/work-orders">Work orders</Link> › <span className="mono">{wo.number}</span>
      </div>
      <div className="page-head">
        <div>
          <h1><span className="mono">{wo.number}</span> · <span className="tail">{tail}</span></h1>
          <div className="chip-row">
            <WorkOrderChip status={wo.status} />
            <span className="small muted">Tail status:</span>
            <TailStatusChip status={tailStatus} />
          </div>
        </div>
      </div>
      {message && <div className="success" role="status">{message}</div>}

      <div className="detail-grid">
        <section className="card">
          <h2>Work</h2>
          <p className="report-text">{wo.scope}</p>
          <dl className="facts">
            {wo.snag && <><dt>For snag</dt><dd><Link className="mono" to={`/snags/${wo.snag.id}`}>{wo.snag.number}</Link> {wo.snag.description}</dd></>}
            {wo.est_man_hours !== null && <><dt>Estimate</dt><dd>{wo.est_man_hours} man-hours</dd></>}
            <dt>Requested</dt><dd>{formatDateTime(wo.created_at, display)} by <span className="mono">{wo.requester?.three_letter_code}</span></dd>
          </dl>
        </section>
        <section className="card">
          <h2>Approvals</h2>
          <ol className="timeline">
            {steps.map((s) => {
              const d = decided.get(s.step_no);
              return (
                <li key={s.step_no}>
                  <strong>{s.name}</strong>{' '}
                  {d ? (
                    <>
                      <span className={`chip tone-${d.decision === 'approve' ? 'green' : 'red'}`}>{d.decision === 'approve' ? 'Approved' : 'Rejected'}</span>{' '}
                      by <span className="mono">{d.decider?.three_letter_code}</span> · {formatDateTime(d.created_at, display)}
                      {d.reason && <div className="small">{d.reason}</div>}
                    </>
                  ) : wo.status === 'rejected' ? <span className="muted">not reached</span> : <span className="muted">waiting</span>}
                </li>
              );
            })}
          </ol>
          {(wo.status === 'requested' || wo.status === 'pre_approved') && (
            <p className="small muted">Locked: no work can be recorded until Quality and the CO approve (D-063).</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Work record</h2>
        {entries.length === 0 && <p className="small muted">No entries yet.</p>}
        <ol className="timeline">
          {entries.map((e) => (
            <li key={e.id}>{e.entry}<div className="small muted"><span className="mono">{e.author?.three_letter_code}</span> · {formatDateTime(e.created_at, display)}</div></li>
          ))}
        </ol>
        {isEngineer && wo.status === 'open' && <EntryForm woId={wo.id} onDone={done} />}
      </section>

      <section className="card">
        <h2>Scans and files</h2>
        {(wo.status === 'open' || wo.status === 'work_complete') && (
          <p className="small">
            Required before certifying:{' '}
            {missing.length === 0
              ? <span className="chip tone-green">All attached</span>
              : missing.map((k) => <span key={k} className="chip tone-amber">{KIND_LABEL[k] ?? k} missing</span>)}
          </p>
        )}
        <Attachments recordTable="work_order" recordId={wo.id} canUpload={canUpload} onChange={checkMissing}
          kinds={['sign_off_card', 'tech_log_page', 'aircraft_logbook', 'engine_logbook', 'photo', 'document']} />
      </section>

      {isEngineer && wo.status === 'open' && <CompleteForm woId={wo.id} onDone={done} />}
      {isEngineer && wo.status === 'work_complete' && (
        <CertifyForm wo={wo} missing={missing} canCertify={canCertify} onDone={done} />
      )}

      {wo.status === 'certified' && (
        <section className="card">
          <h2>Certified</h2>
          <p>By <span className="mono">{wo.certifier?.three_letter_code}</span> · {formatDateTime(wo.certified_at, display)}</p>
          {wo.certification_note && <p>{wo.certification_note}</p>}
          {isEngineer && (
            <>
              <p className="small muted">The snag is closed. The tail status is unchanged until you set it (D-046).</p>
              <SetTailStatus aircraftId={wo.aircraft_id} tail={tail} current={tailStatus} onDone={() => done(`Status of ${tail} recorded.`)} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function EntryForm({ woId, onDone }: { woId: string; onDone: (m: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError('Write what was done.');
    setBusy(true);
    const { error: err } = await actions.rpc('add_work_order_entry', { p_wo: woId, p_entry: text.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    setText('');
    setError('');
    onDone('Entry recorded.');
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="wo-entry">Add an entry</label>
      <textarea id="wo-entry" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record entry'}</button></p>
    </form>
  );
}

function CompleteForm({ woId, onDone }: { woId: string; onDone: (m: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return setError('Summarise the work done.');
    setBusy(true);
    const { error: err } = await actions.rpc('complete_work_order', { p_wo: woId, p_note: note.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone('Work marked complete. Attach the required scans, then a certifying engineer certifies.');
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Work complete</h2>
      <label htmlFor="wo-complete">Summary of work done</label>
      <textarea id="wo-complete" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark work complete'}</button></p>
    </form>
  );
}

function CertifyForm({ wo, missing, canCertify, onDone }: {
  wo: WO; missing: string[]; canCertify: boolean; onDone: (m: string) => void;
}) {
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!note.trim()) return setError('Write the certification statement.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(true);
    const { error: err } = await actions.rpc('certify_work_order', { p_wo: wo.id, p_pin: pin, p_note: note.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone(`${wo.number} certified. ${wo.snag?.number ?? 'The snag'} is closed. Set the tail status below if it changes.`);
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Certify</h2>
      {!canCertify && (
        <div className="notice">This needs a certifying engineer for the {wo.aircraft?.aircraft_type_code} (D-043). The database will refuse your signature.</div>
      )}
      {missing.length > 0 && (
        <div className="notice">Attach first: {missing.map((k) => KIND_LABEL[k] ?? k).join(', ')} (D-065).</div>
      )}
      <label htmlFor="wo-cert">Certification statement</label>
      <textarea id="wo-cert" value={note} onChange={(e) => setNote(e.target.value)} />
      <PinField id="cert-pin" value={pin} onChange={setPin} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy || missing.length > 0}>{busy ? 'Signing…' : 'Sign and certify'}</button></p>
    </form>
  );
}
