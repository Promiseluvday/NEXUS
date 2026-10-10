// Approvals inbox (D-063, D-079, D-146), laid out as the Claude Design
// wireframes WF-L1 (inbox), WF-WQA (Quality pre-approval) and WF-WCO (CO
// final approval).
//
//   /approvals               the inbox: what is waiting for YOU, grouped by
//                            kind, oldest first, and what was returned to you
//   /approvals?request=<id>  one decision page: what is being approved, the
//                            earlier steps, then Approve / Reject with PIN
//
// The inbox shows requests at a step you hold (your department, or your
// appointment, including as acting deputy), that you did not raise and have
// not already decided. The database works this out (app.my_pending_approvals)
// so the screen cannot show more than it should.
//
// Each decision is signed with the PIN (D-094). A rejection needs a reason,
// which the requester sees (D-079). Nobody approves two steps of the same
// request (D-146); the database refuses it and the message says so.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime, heldFor } from '../lib/format';
import { PinField } from '../components/PinField';
import { SnagStateChip } from '../components/StatusChip';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';
import { WorkOrderChip, WorkOrderSteps } from './WorkOrders';

export type Pending = {
  id: string; action_type: string; chain_name: string; record_table: string; record_id: string;
  summary: string; step_no: number; step_name: string; raised_by: string; raised_at: string; waiting_since: string;
};

// Shared with the top bar badge.
export function usePendingApprovals() {
  const [items, setItems] = useState<Pending[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await actions.rpc('my_pending_approvals');
    setItems((data ?? []) as unknown as Pending[]);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { items, load };
}

// Inbox groups, in the order of the wireframe. Kinds not built yet
// (requisitions, authorizations, chain changes) join later.
const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Work orders', types: ['work_order'] },
  { title: 'DDLS and MEL extensions', types: ['ddls_extension'] },
  { title: 'NADD extensions', types: ['nadd_extension'] },
];

type WoBrief = { id: string; number: string; scope: string; aircraft: { tail: string } | null; snag: { number: string } | null };

export function Approvals() {
  const [params] = useSearchParams();
  const request = params.get('request');
  const { items, load } = usePendingApprovals();
  const refresh = () => { load(); window.dispatchEvent(new Event('nexus:approvals')); };
  return request
    ? <DecisionPage key={request} requestId={request} items={items} onDecided={refresh} />
    : <Inbox items={items} />;
}

// ----------------------------------------------------------------- WF-L1
function Inbox({ items }: { items: Pending[] | null }) {
  const { display, me } = useAuth();
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message ?? '';
  const [wos, setWos] = useState<Map<string, WoBrief>>(new Map());
  const [returned, setReturned] = useState<Returned[]>([]);
  const now = new Date();

  // The work order behind each waiting work-order approval, in one read.
  useEffect(() => {
    const ids = (items ?? []).filter((p) => p.record_table === 'work_order').map((p) => p.record_id);
    if (!ids.length) return;
    db.from('work_order').select('id, number, scope, aircraft:aircraft_id (tail), snag:snag_id (number)').in('id', ids)
      .then(({ data }) => setWos(new Map(((data ?? []) as unknown as WoBrief[]).map((w) => [w.id, w]))));
  }, [items]);

  // Returned to you: your requests that were rejected, with the reason (D-079).
  useEffect(() => {
    if (!me) return;
    loadReturned(me.personId).then(setReturned);
  }, [me]);

  const known = GROUPS.flatMap((g) => g.types);
  const groups = [
    ...GROUPS.map((g) => ({ title: g.title, rows: (items ?? []).filter((p) => g.types.includes(p.action_type)) })),
    { title: 'Other', rows: (items ?? []).filter((p) => !known.includes(p.action_type)) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="page ap-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Approvals inbox' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="Approvals inbox" sub="Waiting for your decision, oldest first. Each decision is signed with your PIN (D-094)." />
      {message && <div className={/provisional|queued/.test(message) ? 'offline-banner' : 'success'} role="status">{message}</div>}

      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && (
        <Section title="Waiting for you"><p className="muted" style={{ margin: 0 }}>Nothing is waiting for you.</p></Section>
      )}
      {groups.map((g) => (
        <Section key={g.title} title={<>{g.title} <span className="ap-count">{g.rows.length}</span></>}>
          <ul className="ap-list">
            {g.rows.map((p) => {
              const w = p.record_table === 'work_order' ? wos.get(p.record_id) : undefined;
              return (
                <li key={p.id}>
                  <Link to={`/approvals?request=${p.id}`} className="ap-row">
                    <span className="ap-main">
                      {w ? <><span className="mono">{w.number}</span> · <span className="mono">{w.aircraft?.tail}</span></> : p.summary}
                      {' · '}<strong>{p.step_name}</strong>
                    </span>
                    {w && <span className="ap-sub">{w.snag && <><span className="mono">{w.snag.number}</span> · </>}{w.scope}</span>}
                    <span className="ap-meta">
                      Raised by <span className="mono">{p.raised_by}</span> · {formatDateTime(p.raised_at, display)} ·{' '}
                      <span className="ap-wait">pending {heldFor(p.waiting_since, now)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}

      {returned.length > 0 && (
        <Section title="Returned to you">
          <ul className="ap-list">
            {returned.map((r) => (
              <li key={r.id}>
                <Link to={r.record_table === 'work_order' ? `/work-orders/${r.record_id}` : '/approvals'} className="ap-row">
                  <span className="ap-main"><span className="chip tone-red">Rejected</span> {r.summary}</span>
                  <span className="ap-sub">Reason: {r.reason ?? '—'}</span>
                  <span className="ap-meta">
                    <span className="mono">{r.decider ?? '—'}</span> · {formatDateTime(r.decided_at, display)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="panel-note">
        Requisitions, authorizations and approval-chain changes join this inbox when they are built <span className="rail-tag">Soon</span>
      </p>
    </div>
  );
}

type Returned = {
  id: string; record_table: string; record_id: string; summary: string; decided_at: string | null;
  reason: string | null; decider: string | null;
};

// My requests rejected in the last 30 days, newest first, with the reason.
async function loadReturned(personId: string): Promise<Returned[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db.from('approval_request')
    .select('id, record_table, record_id, summary, decided_at')
    .eq('raised_by', personId).eq('status', 'rejected').gte('decided_at', since)
    .order('decided_at', { ascending: false }).limit(10);
  const reqs = (data ?? []) as { id: string; record_table: string; record_id: string; summary: string; decided_at: string | null }[];
  if (!reqs.length) return [];
  const { data: dec } = await db.from('approval_decision')
    .select('request_id, reason, decider:decided_by (three_letter_code)')
    .in('request_id', reqs.map((r) => r.id)).eq('decision', 'reject');
  const byReq = new Map(((dec ?? []) as unknown as { request_id: string; reason: string | null; decider: { three_letter_code: string } | null }[])
    .map((d) => [d.request_id, d]));
  return reqs.map((r) => ({ ...r, reason: byReq.get(r.id)?.reason ?? null, decider: byReq.get(r.id)?.decider?.three_letter_code ?? null }));
}

// ------------------------------------------------- WF-WQA and WF-WCO
type WorkOrderInfo = {
  id: string; number: string; scope: string; est_man_hours: number | null; status: string; created_at: string;
  aircraft_id: string;
  aircraft: { tail: string; aircraft_type_code: string } | null;
  snag: { id: string; number: string; description: string; ata: string | null; status: string; disposition: string | null } | null;
  requester: { three_letter_code: string } | null;
};
type Decision = { step_no: number; decision: string; reason: string | null; created_at: string; decided_by: string; decider: { three_letter_code: string } | null };
type Step = { step_no: number; name: string };

// Who may decide at each work order step, as shown under the title.
const WHO_DECIDES: Record<number, string> = {
  1: 'Quality only · online + PIN',
  2: 'CO or acting deputy (D-067) · online + PIN · no verbal approval',
};

function DecisionPage({ requestId, items, onDecided }: { requestId: string; items: Pending[] | null; onDecided: () => void }) {
  const { display, me } = useAuth();
  const navigate = useNavigate();
  const p = items?.find((x) => x.id === requestId);
  const [wo, setWo] = useState<WorkOrderInfo | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'approve' | 'reject'>('');

  useEffect(() => {
    if (!p) return;
    db.from('approval_chain_step').select('step_no, name').eq('action_type', p.action_type).order('step_no')
      .then(({ data }) => setSteps((data ?? []) as Step[]));
    db.from('approval_decision').select('step_no, decision, reason, created_at, decided_by, decider:decided_by (three_letter_code)')
      .eq('request_id', p.id).order('created_at')
      .then(({ data }) => setDecisions((data ?? []) as unknown as Decision[]));
    if (p.record_table !== 'work_order') return;
    db.from('work_order')
      .select(`id, number, scope, est_man_hours, status, created_at, aircraft_id, aircraft:aircraft_id (tail, aircraft_type_code),
               snag:snag_id (id, number, description, ata, status, disposition), requester:requested_by (three_letter_code)`)
      .eq('id', p.record_id).maybeSingle()
      .then(({ data }) => setWo(data as unknown as WorkOrderInfo | null));
  }, [p]);

  const crumbs = [{ label: 'All aircraft', to: '/' }, { label: 'Approvals inbox', to: '/approvals' }, { label: p?.step_name ?? 'Decision' }];

  if (items === null) return <div className="page muted">Loading…</div>;
  if (!p) {
    return (
      <div className="page ap-page">
        <Crumbs items={crumbs} />
        <BackButton to="/approvals" label="Approvals inbox" />
        <Section title="Not waiting for you">
          <p style={{ margin: 0 }}>
            This request is not waiting for your decision. It may already be decided, or it is at a step you do not hold.
          </p>
        </Section>
      </div>
    );
  }

  const isWo = p.record_table === 'work_order';
  const last = steps.length > 0 && p.step_no === steps[steps.length - 1].step_no;
  const next = steps.find((s) => s.step_no === p.step_no + 1);
  const iDecidedBefore = Boolean(me && decisions.some((d) => d.decided_by === me.personId));

  async function decide(decision: 'approve' | 'reject', e?: FormEvent) {
    e?.preventDefault();
    setError('');
    if (decision === 'reject' && !reason.trim()) return setError('A rejection needs a reason; the requester sees it (D-079).');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(decision);
    const { data, error: err } = await actions.rpc('decide_approval', {
      p_request: p!.id, p_decision: decision, p_pin: pin, p_reason: reason.trim() || undefined,
    });
    setBusy('');
    if (err) return setError(errorText(err));
    const finalText = isWo ? 'approved: work can start' : 'approved: the new limit applies';
    const outcome = data === 'approved' ? finalText
      : data === 'rejected' ? 'rejected; the requester sees your reason'
      : 'approved at your step; it moves to the next approver';
    onDecided();
    navigate('/approvals', { state: { message: `${wo?.number ?? p!.summary} ${outcome}.` } });
  }

  return (
    <div className="page ap-page">
      <Crumbs items={crumbs} />
      <BackButton to="/approvals" label="Approvals inbox" />
      <PageHead
        title={<>{p.step_name} · {isWo ? <span className="mono">{wo?.number ?? '…'}</span> : p.summary}</>}
        sub={<>
          {wo?.aircraft && <><span className="mono">{wo.aircraft.tail}</span> · </>}
          requested by <span className="mono">{p.raised_by}</span> · {formatDateTime(p.raised_at, display)}
          {isWo && WHO_DECIDES[p.step_no] ? ` · ${WHO_DECIDES[p.step_no]}` : ' · online + PIN'}
        </>}>
        <span className="chip tone-amber">Pending {heldFor(p.waiting_since)}</span>
      </PageHead>

      {isWo && <WorkOrderSteps status={p.step_no === 1 ? 'requested' : 'pre_approved'} />}

      {/* Earlier steps of this request, with who and when (WF-WCO). */}
      {decisions.length > 0 && (
        <div className="ap-earlier">
          {decisions.map((d) => (
            <div key={d.step_no}>
              {steps.find((s) => s.step_no === d.step_no)?.name ?? `Step ${d.step_no}`}:{' '}
              <span className="chip tone-green">✓ Approved</span> <span className="mono">{d.decider?.three_letter_code}</span> · {formatDateTime(d.created_at, display)}
              {d.reason && <span className="small muted"> · Note: {d.reason}</span>}
            </div>
          ))}
        </div>
      )}

      <Section title="Request">
        {isWo && wo ? (
          <>
            <p className="wo-scope">{wo.scope}</p>
            <dl className="facts">
              <dt>Estimate</dt><dd>{wo.est_man_hours !== null ? `${wo.est_man_hours} man-hours` : <span className="muted">not given</span>}</dd>
              <dt>Aircraft</dt><dd><Link className="mono" to={`/aircraft/${wo.aircraft_id}`}>{wo.aircraft?.tail}</Link> · {wo.aircraft?.aircraft_type_code}</dd>
              {wo.snag && (
                <>
                  <dt>Raised from</dt>
                  <dd>
                    <Link className="mono" to={`/snags/${wo.snag.id}`}>{wo.snag.number}</Link> {wo.snag.description}
                    {wo.snag.ata && <span className="small muted"> · ATA {wo.snag.ata}</span>}{' '}
                    <SnagStateChip status={wo.snag.status} disposition={wo.snag.disposition} />
                  </dd>
                </>
              )}
              <dt>Requested</dt><dd><span className="mono">{wo.requester?.three_letter_code}</span> · {formatDateTime(wo.created_at, display)}</dd>
              <dt>State</dt><dd><WorkOrderChip status={wo.status} /></dd>
            </dl>
            <div className="action-row">
              <Link to={`/work-orders/${wo.id}`}>Open work order</Link>
              {wo.snag && <Link to={`/snags/${wo.snag.id}`}>Source snag <span className="mono">{wo.snag.number}</span></Link>}
            </div>
            <p className="panel-note">Parts reserved for this work order show here once part requests are built <span className="rail-tag">Soon</span></p>
          </>
        ) : isWo ? <p className="muted" style={{ margin: 0 }}>Loading…</p> : <p style={{ margin: 0 }}>{p.summary}</p>}
        {!isWo && <p className="small muted" style={{ margin: 0 }}>{p.chain_name} · step {p.step_no}</p>}
      </Section>

      <form onSubmit={(e) => decide('approve', e)}>
        <Section title="Your decision" tone="strong">
          {iDecidedBefore && (
            <div className="notice">You decided an earlier step of this request. Nobody approves two steps of the same request (D-146); the database will refuse.</div>
          )}
          <label htmlFor="ap-reason" style={{ marginTop: 0 }}>Reason <span className="hint">(needed to reject; the requester sees it, D-079. Optional note when approving)</span></label>
          <textarea id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <PinField id="ap-pin" value={pin} onChange={setPin} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row">
            <button type="submit" disabled={busy !== ''}>{busy === 'approve' ? 'Signing…' : 'Sign and approve'}</button>
            <button type="button" className="ap-reject" disabled={busy !== ''} onClick={() => decide('reject')}>
              {busy === 'reject' ? 'Signing…' : 'Reject (reason required)'}
            </button>
          </div>
          <p className="panel-note">
            After approval: {last ? (isWo ? 'the work order opens and work can start (D-063).' : 'the new limit applies.') : `${next?.name ?? 'the next step'}.`}
          </p>
        </Section>
      </form>
    </div>
  );
}
