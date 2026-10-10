// Work orders (D-063 to D-069, D-214, D-218), laid out as the Claude Design
// wireframes WF-G1 (list), WF-G2 (detail) and WF-WOE (completion evidence).
//
// The life of a work order:
//   requested ─ Quality pre-approves ─► pre_approved ─ CO approves ─► open
//   open ─ entries recorded ─ "work complete" ─► work_complete
//   work_complete ─ scans attached (sign-off card…) ─ certify with PIN ─► certified
//   (a rejection at either step sends the snag back to the engineer)
//
// Certifying closes the snag and, for a deferred snag, clears its DDLS entry
// or rectifies its NADD with the same signature (D-218). It does NOT change
// the tail status (D-046); the page offers "Set tail status" right after,
// signed with the PIN (D-215).
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { perform, queuedText } from '../lib/perform';
import { cached } from '../lib/offline/cache';
import { usePendingFor } from '../lib/offline/hooks';
import { formatDateTime, heldFor } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { SnagStateChip } from '../components/StatusChip';
import { Attachments, KIND_LABEL } from '../components/Attachments';
import { PinField } from '../components/PinField';
import { SetTailStatus } from '../components/SetTailStatus';
import { Queries } from '../components/Queries';
import { BackButton, Crumbs, PageHead, Section, TailHeader, TailTabs, type Crumb } from '../components/PageFrame';
import { useFleetBoard } from './FleetBoard';

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

// Who the work order is waiting on, so nobody has to guess (D-094
// "what's blocking this?"). Blank once it is finished.
const HOLDER: Record<string, string> = {
  requested: 'Quality', pre_approved: 'CO', open: 'Engineering', work_complete: 'Engineering',
};

// The six steps of every work order, as the wireframes' step line:
//   ✓ Requested → ✓ Quality pre-approval → ● CO final approval → ○ Open → …
// ✓ done, ● where it is now, ○ still to come, ✕ where it was rejected.
const STEPS = ['Requested', 'Quality pre-approval', 'CO final approval', 'Open', 'Work complete', 'Certified'];
const STEP_AT: Record<string, number> = { requested: 1, pre_approved: 2, open: 3, work_complete: 4, certified: 6 };

export function WorkOrderSteps({ status, rejectedStep }: { status: string; rejectedStep?: number }) {
  // A rejected work order stops at the approval step that rejected it (1 = Quality, 2 = CO).
  const at = status === 'rejected' ? (rejectedStep ?? 1) : (STEP_AT[status] ?? 0);
  return (
    <ol className="wo-steps" aria-label="Work order steps">
      {STEPS.map((name, i) => {
        const rejected = status === 'rejected' && i === at;
        const state = rejected ? 'rejected' : i < at ? 'done' : i === at ? 'now' : 'todo';
        const mark = { done: '✓', now: '●', todo: '○', rejected: '✕' }[state];
        return (
          <li key={name} className={`wo-step ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span aria-hidden>{mark}</span> {name}{rejected && ': rejected'}
            {state === 'done' && <span className="visually-hidden"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
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
  aircraft: { tail: string } | null; snag: { id: string; number: string; description: string } | null;
  requester: { three_letter_code: string } | null;
};

// The tail's header and section tabs, shown when the list is for one tail.
function TailFrame({ aircraftId }: { aircraftId: string }) {
  const { rows } = useFleetBoard();
  const r = rows.find((x) => x.aircraft_id === aircraftId);
  return (
    <>
      {r && <TailHeader row={r} />}
      <TailTabs aircraftId={aircraftId} />
    </>
  );
}

// WF-G1. Fleet-wide, or one tail when opened from the tail's tabs (?aircraft=).
export function WorkOrderList() {
  const { display, me } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'active';
  const tail = params.get('aircraft') ?? '';
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState('');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const tailName = aircraft.find((a) => a.id === tail)?.tail ?? '';

  useEffect(() => {
    let q = db.from('work_order')
      .select(`id, number, status, scope, created_at, aircraft:aircraft_id (tail),
               snag:snag_id (id, number, description), requester:requested_by (three_letter_code)`)
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

  const crumbs: Crumb[] = tail
    ? [{ label: 'All aircraft', to: '/' }, { label: <span className="mono">{tailName || '…'}</span>, to: `/aircraft/${tail}` }, { label: 'Work orders' }]
    : [{ label: 'All aircraft', to: '/' }, { label: 'Work orders' }];
  const open = (id: string) => navigate(`/work-orders/${id}`);

  return (
    <div className="page wo-page">
      <Crumbs items={crumbs} />
      {tail
        ? <BackButton to={`/aircraft/${tail}`} label={`${tailName || 'aircraft'} overview`} />
        : <BackButton to="/" label="All aircraft" />}
      {tail && <TailFrame aircraftId={tail} />}
      <PageHead title="Work orders" sub={tail ? `${tailName} · numbers run in one fleet-wide sequence (D-064)` : 'One fleet-wide sequence (D-064)'}>
        {isEngineer && (
          <Link className="button" to={tail ? `/request-work-order?aircraft=${tail}` : '/request-work-order'}>Request work order</Link>
        )}
      </PageHead>

      <div className="wo-filters">
        <select aria-label="Which work orders" value={view} onChange={(e) => set('view', e.target.value)}>
          {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>Show: {v.label}</option>)}
        </select>
        {!tail && <AircraftPicker aircraft={aircraft} value={tail} onChange={(id) => set('aircraft', id)} placeholder="All tails" />}
      </div>

      {error && <div className="error">{error}</div>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <div className="box"><div className="box-body"><p className="muted" style={{ margin: 0 }}>No work orders match.</p></div></div>}
      {rows && rows.length > 0 && (
        <>
          <table className="board wo-table">
            <thead>
              <tr>
                <th>Work order</th>{!tail && <th>Tail</th>}<th>Source</th><th>Work</th><th>State</th><th>With</th><th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => e.key === 'Enter' && open(r.id)}>
                  <td><Link className="mono" to={`/work-orders/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.number}</Link></td>
                  {!tail && <td className="tail">{r.aircraft?.tail}</td>}
                  <td>
                    {r.snag
                      ? <Link className="mono" to={`/snags/${r.snag.id}`} onClick={(e) => e.stopPropagation()}>{r.snag.number}</Link>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="wo-scope-cell">{r.scope}</td>
                  <td><WorkOrderChip status={r.status} /></td>
                  <td>{HOLDER[r.status] ? <span className="dept-tag">{HOLDER[r.status]}</span> : <span className="muted">—</span>}</td>
                  <td className="small">
                    <span className="mono">{r.requester?.three_letter_code}</span> · {formatDateTime(r.created_at, display)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Phones: the same rows as cards. */}
          <div className="cards">
            {rows.map((r) => (
              <button key={r.id} type="button" className="card tail-card" onClick={() => open(r.id)}>
                <div className="top">
                  <span><span className="mono">{r.number}</span>{!tail && <> · <span className="tail">{r.aircraft?.tail}</span></>}</span>
                  <WorkOrderChip status={r.status} />
                </div>
                <div style={{ margin: '6px 0' }}>{r.scope}</div>
                <div className="small muted">
                  {r.snag && <><span className="mono">{r.snag.number}</span> · </>}
                  {HOLDER[r.status] && <>With {HOLDER[r.status]} · </>}
                  {formatDateTime(r.created_at, display)}
                </div>
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
  snag: { id: string; number: string; description: string; status: string; disposition: string | null; ata: string | null } | null;
  requester: { three_letter_code: string } | null;
  completer: { three_letter_code: string } | null;
  certifier: { three_letter_code: string } | null;
};
type Decision = { step_no: number; decision: string; reason: string | null; created_at: string; decider: { three_letter_code: string } | null };
type Step = { step_no: number; name: string };
type Entry = { id: string; entry: string; created_at: string; author: { three_letter_code: string } | null };

// The scans the completion evidence step lists (WF-WOE). Which of them are
// required is the operator setting "work_order.required_scans" (D-065, D-069).
const EVIDENCE = ['sign_off_card', 'tech_log_page', 'aircraft_logbook', 'engine_logbook'];

// The tail's header for a record page; nothing if the tail is not loaded yet.
function TailHead({ aircraftId }: { aircraftId: string }) {
  const { rows } = useFleetBoard();
  const r = rows.find((x) => x.aircraft_id === aircraftId);
  return r ? <TailHeader row={r} /> : null;
}

// WF-G2 with WF-WOE as its "Completion evidence" section.
export function WorkOrderPage() {
  const { id } = useParams();
  const { me, display } = useAuth();
  const [wo, setWo] = useState<WO | null | undefined>(undefined);
  const [steps, setSteps] = useState<Step[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>(['sign_off_card']);
  const [tailStatus, setTailStatus] = useState<string | null>(null);
  const [canCertify, setCanCertify] = useState(false);
  const [mine, setMine] = useState(false);   // is the pending approval waiting for me?
  const [message, setMessage] = useState('');
  const [params] = useSearchParams();
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const checkMissing = useCallback(async () => {
    const { data } = await actions.rpc('work_order_missing_scans', { p_wo: id! });
    setMissing((data ?? []) as string[]);
  }, [id]);

  const load = useCallback(async () => {
    const { data } = await cached(`wo:${id}`, () => db.from('work_order')
      .select(`id, number, status, scope, est_man_hours, created_at, work_completed_at, certified_at,
               certification_note, approval_request_id, aircraft_id,
               aircraft:aircraft_id (tail, aircraft_type_code),
               snag:snag_id (id, number, description, status, disposition, ata),
               requester:requested_by (three_letter_code), completer:work_completed_by (three_letter_code),
               certifier:certified_by (three_letter_code)`)
      .eq('id', id!).maybeSingle());
    const w = data as unknown as WO | null;
    setWo(w);
    if (!w) return;
    const [st, dec, en, ts, req, pend] = await Promise.all([
      db.from('approval_chain_step').select('step_no, name').eq('action_type', 'work_order').order('step_no'),
      w.approval_request_id
        ? db.from('approval_decision').select('step_no, decision, reason, created_at, decider:decided_by (three_letter_code)')
            .eq('request_id', w.approval_request_id).order('created_at')
        : Promise.resolve({ data: [] }),
      db.from('work_order_entry').select('id, entry, created_at, author:entered_by (three_letter_code)')
        .eq('work_order_id', w.id).order('created_at'),
      db.from('aircraft_current_status').select('status').eq('aircraft_id', w.aircraft_id).maybeSingle(),
      cached('setting:work_order.required_scans', () => db.from('operator_setting_current').select('value')
        .eq('key', 'work_order.required_scans').maybeSingle()),
      w.status === 'requested' || w.status === 'pre_approved' ? actions.rpc('my_pending_approvals') : Promise.resolve({ data: [] }),
    ]);
    setSteps((st.data ?? []) as Step[]);
    setDecisions((dec.data ?? []) as unknown as Decision[]);
    setEntries((en.data ?? []) as unknown as Entry[]);
    setTailStatus((ts.data as { status: string } | null)?.status ?? null);
    const v = (req.data as { value?: unknown } | null)?.value;
    if (Array.isArray(v)) setRequired(v.filter((k): k is string => typeof k === 'string'));
    setMine(((pend.data ?? []) as { id: string }[]).some((p) => p.id === w.approval_request_id));
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
  const rejection = decisions.find((d) => d.decision !== 'approve');
  const locked = wo.status === 'requested' || wo.status === 'pre_approved';
  const canUpload = isEngineer && (wo.status === 'open' || wo.status === 'work_complete');
  const listLink = `/work-orders?aircraft=${wo.aircraft_id}`;
  const deferred = wo.snag?.status === 'deferred';
  // When the step now waiting started: the last decision, or the request itself.
  const waitingSince = decisions.length ? decisions[decisions.length - 1].created_at : wo.created_at;

  return (
    <div className="page wo-page">
      <Crumbs items={[
        { label: 'All aircraft', to: '/' },
        { label: <span className="mono">{tail}</span>, to: `/aircraft/${wo.aircraft_id}` },
        { label: 'Work orders', to: listLink },
        { label: <span className="mono">{wo.number}</span> },
      ]} />
      <BackButton to={listLink} label="Work orders" />
      <TailHead aircraftId={wo.aircraft_id} />
      <PageHead
        title={<>Work order <span className="mono">{wo.number}</span> · <span className="mono">{tail}</span></>}
        sub={<>One sequence for the fleet · raised{wo.snag && <> from <span className="mono">{wo.snag.number}</span></>} by{' '}
          <span className="mono">{wo.requester?.three_letter_code}</span> · {formatDateTime(wo.created_at, display)}</>}>
        <WorkOrderChip status={wo.status} />
        {HOLDER[wo.status] && <span className="dept-tag">With {HOLDER[wo.status]}</span>}
      </PageHead>

      <WorkOrderSteps status={wo.status} rejectedStep={rejection?.step_no} />

      {message && <div className={/provisional|queued/.test(message) ? 'offline-banner' : 'success'} role="status">{message}</div>}
      <PendingOnTablet path={`/work-orders/${wo.id}`} />

      {/* Approvals with who and when (D-063). */}
      <Section title="Approvals">
        <ul className="wo-trail">
          {steps.map((s) => {
            const d = decided.get(s.step_no);
            const waiting = !d && !rejection && ((s.step_no === 1 && wo.status === 'requested') || (s.step_no === 2 && wo.status === 'pre_approved'));
            return (
              <li key={s.step_no}>
                <span className="wo-trail-name">{s.name}</span>
                {d ? (
                  <span>
                    <span className={`chip tone-${d.decision === 'approve' ? 'green' : 'red'}`}>{d.decision === 'approve' ? '✓ Approved' : '✕ Rejected'}</span>{' '}
                    <span className="mono">{d.decider?.three_letter_code}</span> · {formatDateTime(d.created_at, display)}
                    {d.reason && <span className="wo-reason">{d.decision === 'approve' ? 'Note' : 'Reason'}: {d.reason}</span>}
                  </span>
                ) : waiting ? (
                  <span>
                    <strong>pending since {formatDateTime(waitingSince, display)} ({heldFor(waitingSince)})</strong>
                    {mine && <> · <Link to={`/approvals?request=${wo.approval_request_id}`}>Open {s.step_no === 1 ? 'Quality' : 'CO'} approval</Link></>}
                  </span>
                ) : (
                  <span className="muted">{rejection || wo.status === 'cancelled' ? 'not reached' : 'waiting'}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {locked && <div className="wo-locked">Locked until Quality and the CO approve: no entries, scans or certification yet (D-063).</div>}
      {wo.status === 'rejected' && (
        <div className="wo-locked wo-locked-red">
          Rejected{rejection?.reason && <>: {rejection.reason}</>}. The snag goes back to the engineer, who may request a new
          work order (D-079).
        </div>
      )}

      <div className="wo-grid">
        <Section title="Scope">
          <p className="wo-scope">{wo.scope}</p>
          <dl className="facts">
            <dt>Estimate</dt><dd>{wo.est_man_hours !== null ? `${wo.est_man_hours} man-hours` : <span className="muted">not given</span>}</dd>
            <dt>Requested</dt><dd><span className="mono">{wo.requester?.three_letter_code}</span> · {formatDateTime(wo.created_at, display)}</dd>
          </dl>
        </Section>
        <Section title="Raised from">
          {wo.snag ? (
            <>
              <div className="chip-row" style={{ marginTop: 0 }}>
                <Link className="mono" to={`/snags/${wo.snag.id}`}>{wo.snag.number}</Link>
                <SnagStateChip status={wo.snag.status} disposition={wo.snag.disposition} />
                {wo.snag.ata && <span className="small muted">ATA {wo.snag.ata}</span>}
              </div>
              <p style={{ margin: 0 }}>{wo.snag.description}</p>
              {deferred && (
                <p className="panel-note">
                  Deferred: the deferral stays in force until this work order is certified. Certifying clears its DDLS entry
                  or rectifies its NADD with the same signature (D-218).
                </p>
              )}
            </>
          ) : <p className="muted" style={{ margin: 0 }}>No snag linked.</p>}
        </Section>
      </div>

      <Section title="Task entries and updates">
        {entries.length === 0 && <p className="small muted" style={{ margin: 0 }}>No entries yet.</p>}
        {entries.length > 0 && (
          <ol className="wo-entries">
            {entries.map((e) => (
              <li key={e.id}>
                <div>{e.entry}</div>
                <div className="small muted"><span className="mono">{e.author?.three_letter_code}</span> · {formatDateTime(e.created_at, display)}</div>
              </li>
            ))}
          </ol>
        )}
        {locked && <p className="small muted" style={{ margin: 0 }}>Entries open once Quality and the CO have approved.</p>}
        {wo.work_completed_at && (
          <p className="small" style={{ margin: 0 }}>
            <strong>Work complete</strong> · <span className="mono">{wo.completer?.three_letter_code}</span> · {formatDateTime(wo.work_completed_at, display)}
          </p>
        )}
        {isEngineer && wo.status === 'open' && <EntryForm woId={wo.id} onDone={done} />}
      </Section>

      <Section title={<>Parts <span className="rail-tag">Soon</span></>}>
        <p className="panel-note">Part requests for a work order (reserved before approval, issued after, D-068) come with stores in Phase 2.</p>
      </Section>

      <Section id="evidence" title="Completion evidence" tone={wo.status === 'work_complete' ? 'strong' : undefined}>
        {locked || wo.status === 'rejected' || wo.status === 'cancelled' ? (
          <p className="small muted" style={{ margin: 0 }}>Scans are attached once the work is under way, before certifying (D-065).</p>
        ) : (
          <>
            <ul className="wo-evidence">
              {EVIDENCE.map((k) => {
                const req = required.includes(k);
                const have = req && !missing.includes(k);
                return (
                  <li key={k} className={req ? (have ? 'have' : 'need') : 'optional'}>
                    <span className="wo-ev-mark" aria-hidden>{req ? (have ? '✓' : '!') : '–'}</span>
                    <span className="wo-ev-name">{KIND_LABEL[k] ?? k}</span>
                    {req
                      ? (have ? <span className="chip tone-green">Attached</span> : <span className="chip tone-amber">Required · not attached</span>)
                      : <span className="small muted">Not required for this work order</span>}
                  </li>
                );
              })}
            </ul>
            <p className="panel-note">Which scans are required is set in operator settings (D-065, D-069). Accepted: PDF or image (D-026).</p>
          </>
        )}
        <Attachments recordTable="work_order" recordId={wo.id} canUpload={canUpload} onChange={checkMissing}
          kinds={['sign_off_card', 'tech_log_page', 'aircraft_logbook', 'engine_logbook', 'photo', 'document']} />
      </Section>

      {isEngineer && wo.status === 'open' && <CompleteForm woId={wo.id} onDone={done} />}
      {isEngineer && wo.status === 'work_complete' && (
        <CertifyForm wo={wo} missing={missing} canCertify={canCertify} onDone={done} />
      )}

      {wo.status === 'certified' && (
        <Section title="Certified">
          <p style={{ margin: 0 }}>By <span className="mono">{wo.certifier?.three_letter_code}</span> · {formatDateTime(wo.certified_at, display)}</p>
          {wo.certification_note && <p style={{ margin: 0 }}>{wo.certification_note}</p>}
          {isEngineer && (
            <>
              <p className="small muted" style={{ margin: 0 }}>The snag is closed. The tail status is unchanged until you set it (D-046).</p>
              <SetTailStatus aircraftId={wo.aircraft_id} tail={tail} current={tailStatus} onDone={(m) => done(m ?? `Status of ${tail} recorded.`)} />
            </>
          )}
        </Section>
      )}

      <Queries recordTable="work_order" recordId={wo.id} startOpen={params.get('query') === 'new'} />
    </div>
  );
}

// What this tablet has done here but not yet sent (D-102, D-217).
function PendingOnTablet({ path }: { path: string }) {
  const pending = usePendingFor(path);
  if (pending.length === 0) return null;
  return (
    <div className="offline-banner" role="status">
      <strong>Waiting on this tablet, provisional:</strong>
      <ul style={{ margin: '4px 0 0' }}>
        {pending.map((p) => <li key={p.id}>{p.label}{p.kind === 'signed' && ' · signed offline'}
          {p.status === 'failed' && <> · <span style={{ color: 'var(--red)' }}>refused: {p.error}</span></>}</li>)}
      </ul>
      <Link to="/sync">Send queue</Link>
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
    const o = await perform('add_work_order_entry', { p_wo: woId, p_entry: text.trim() },
      { label: `Work entry: ${text.trim().slice(0, 60)}`, recordPath: `/work-orders/${woId}` });
    setBusy(false);
    if (o.error) return setError(errorText(o.error));
    setText('');
    setError('');
    onDone(o.queued ? queuedText(o, 'Work entry') : 'Entry recorded.');
  }
  return (
    <form onSubmit={submit} className="wo-form">
      <label htmlFor="wo-entry">Add task entry</label>
      <textarea id="wo-entry" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row"><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record entry'}</button></div>
    </form>
  );
}

// A form shown as a titled box, like the other sections.
function FormBox({ title, onSubmit, tone, children }: { title: string; onSubmit: (e: FormEvent) => void; tone?: 'strong'; children: ReactNode }) {
  return (
    <form onSubmit={onSubmit}>
      <Section title={title} tone={tone}>{children}</Section>
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
    <FormBox title="Work complete" onSubmit={submit}>
      <label htmlFor="wo-complete" style={{ marginTop: 0 }}>Summary of work done</label>
      <textarea id="wo-complete" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row"><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark work complete'}</button></div>
    </FormBox>
  );
}

function CertifyForm({ wo, missing, canCertify, onDone }: {
  wo: WO; missing: string[]; canCertify: boolean; onDone: (m: string) => void;
}) {
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [nff, setNff] = useState(false);
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!note.trim()) return setError(nff ? 'Record what was checked and the result.' : 'Write the certification statement.');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(true);
    const label = `Certify ${wo.number}`;
    const o = await perform('certify_work_order', {
      p_wo: wo.id, p_pin: pin, p_note: note.trim(), p_no_fault_found: nff,
      p_tlb_book: book.trim() || undefined, p_tlb_page: page.trim() || undefined,
    },
      { label, recordPath: `/work-orders/${wo.id}`, aircraftId: wo.aircraft_id });
    setBusy(false);
    if (o.error) return setError(errorText(o.error));
    if (o.queued) return onDone(queuedText(o, label));
    onDone(`${wo.number} certified${nff ? ' as no fault found' : ''}. ${wo.snag?.number ?? 'The snag'} is closed and any DDLS entry or NADD for it is cleared. Set the tail status if it changes.`);
  }
  return (
    <FormBox title="Certify and close" onSubmit={submit} tone="strong">
      {!canCertify && (
        <div className="notice">This needs a certifying engineer for the {wo.aircraft?.aircraft_type_code} (D-043). The database will refuse your signature.</div>
      )}
      {missing.length > 0 && (
        <div className="notice">Attach the required scans first: {missing.map((k) => KIND_LABEL[k] ?? k).join(', ')} (D-065).</div>
      )}
      <label className="check" style={{ marginTop: 0 }}>
        <input type="checkbox" checked={nff} onChange={(e) => setNff(e.target.checked)} />
        No fault found: the troubleshooting found nothing to rectify (D-218)
      </label>
      <label htmlFor="wo-cert">{nff ? 'What was checked, and the result' : 'Certification statement'}</label>
      <textarea id="wo-cert" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row wo-tlb">
        <div><label htmlFor="cert-book">Tech log book <span className="hint">(optional)</span></label>
          <input id="cert-book" value={book} onChange={(e) => setBook(e.target.value)} /></div>
        <div><label htmlFor="cert-page">Page <span className="hint">(optional)</span></label>
          <input id="cert-page" value={page} onChange={(e) => setPage(e.target.value)} /></div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Certifying closes the snag and, with the same signature, clears its DDLS entry or rectifies its NADD.</p>
      <PinField id="cert-pin" value={pin} onChange={setPin} />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="action-row">
        <button type="submit" disabled={busy || missing.length > 0}>{busy ? 'Signing…' : 'Sign and certify'}</button>
        {missing.length > 0 && <span className="small muted">Attach the required scans first.</span>}
      </div>
    </FormBox>
  );
}
