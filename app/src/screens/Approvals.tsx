// Approvals inbox (D-063, D-079, D-146).
//
// Shows what is waiting for YOU: requests at a step you hold (your
// department, or your appointment, including as acting deputy), that you did
// not raise and have not already decided. The database works this out
// (app.my_pending_approvals) so the screen cannot show more than it should.
//
// Each decision is signed with the PIN (D-094). A rejection needs a reason,
// which the requester sees (D-079). Oldest first, so nothing waits unseen.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime, heldFor } from '../lib/format';
import { PinField } from '../components/PinField';

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

export function Approvals() {
  const { items, load } = usePendingApprovals();
  const [message, setMessage] = useState('');
  const now = new Date();

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Approvals</div>
      <div className="page-head">
        <div>
          <h1>Approvals waiting for you</h1>
          <div className="small muted">Oldest first. Each decision is signed with your PIN.</div>
        </div>
      </div>
      {message && <div className={/provisional|queued/.test(message) ? 'offline-banner' : 'success'} role="status">{message}</div>}
      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && <div className="card"><p className="muted">Nothing is waiting for you.</p></div>}
      {items?.map((p) => (
        <ApprovalCard key={p.id} p={p} now={now} onDone={(m) => { setMessage(m); load(); window.dispatchEvent(new Event('nexus:approvals')); }} />
      ))}
    </div>
  );
}

type WorkOrderInfo = {
  number: string; scope: string; est_man_hours: number | null; status: string; created_at: string;
  aircraft: { tail: string } | null;
  snag: { id: string; number: string; description: string; ata: string | null } | null;
  requester: { three_letter_code: string } | null;
};

function ApprovalCard({ p, now, onDone }: { p: Pending; now: Date; onDone: (m: string) => void }) {
  const { display } = useAuth();
  const [wo, setWo] = useState<WorkOrderInfo | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | ''>('');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (p.record_table !== 'work_order') return;
    db.from('work_order')
      .select(`number, scope, est_man_hours, status, created_at, aircraft:aircraft_id (tail),
               snag:snag_id (id, number, description, ata), requester:requested_by (three_letter_code)`)
      .eq('id', p.record_id).maybeSingle()
      .then(({ data }) => setWo(data as unknown as WorkOrderInfo | null));
  }, [p.record_table, p.record_id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!decision) return setError('Choose approve or reject.');
    if (decision === 'reject' && !reason.trim()) return setError('A rejection needs a reason (D-079).');
    if (!/^[0-9]{4,8}$/.test(pin)) return setError('Enter your PIN (4 to 8 digits) to sign.');
    setBusy(true);
    const { data, error: err } = await actions.rpc('decide_approval', {
      p_request: p.id, p_decision: decision, p_pin: pin, p_reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    const finalText = p.action_type === 'work_order' ? 'approved: work can start' : 'approved: the new limit applies';
    const outcome = data === 'approved' ? finalText
      : data === 'rejected' ? 'rejected; the requester sees your reason'
      : 'approved at your step; it moves to the next approver';
    onDone(`${wo?.number ?? p.summary} ${outcome}.`);
  }

  return (
    <form className="card approval" onSubmit={submit}>
      <div className="approval-head">
        <div>
          <div className="small muted">{p.chain_name} · step {p.step_no}: {p.step_name}</div>
          <h2>
            {p.record_table === 'work_order'
              ? <Link className="mono" to={`/work-orders/${p.record_id}`}>{wo?.number ?? '…'}</Link>
              : p.summary}
            {wo?.aircraft && <> · <span className="tail">{wo.aircraft.tail}</span></>}
          </h2>
        </div>
        <div className="small muted" style={{ textAlign: 'right' }}>
          Raised by <span className="mono">{p.raised_by}</span> · {formatDateTime(p.raised_at, display)}
          <div>Waiting {heldFor(p.waiting_since, now)}</div>
        </div>
      </div>

      {wo && (
        <dl className="facts">
          <dt>Work</dt><dd>{wo.scope}</dd>
          {wo.est_man_hours !== null && <><dt>Estimate</dt><dd>{wo.est_man_hours} man-hours</dd></>}
          {wo.snag && (
            <>
              <dt>For snag</dt>
              <dd><Link className="mono" to={`/snags/${wo.snag.id}`}>{wo.snag.number}</Link> {wo.snag.description}
                {wo.snag.ata && <span className="small muted"> · ATA {wo.snag.ata}</span>}</dd>
            </>
          )}
        </dl>
      )}
      {!wo && p.record_table !== 'work_order' && <p>{p.summary}</p>}

      <div className="row decision-row" role="radiogroup" aria-label="Decision">
        <label className="check"><input type="radio" name={`d-${p.id}`} checked={decision === 'approve'} onChange={() => setDecision('approve')} /> Approve</label>
        <label className="check"><input type="radio" name={`d-${p.id}`} checked={decision === 'reject'} onChange={() => setDecision('reject')} /> Reject</label>
      </div>
      {decision && (
        <>
          <label htmlFor={`r-${p.id}`}>{decision === 'reject' ? 'Reason for rejecting (the requester sees this)' : 'Note (optional)'}</label>
          <textarea id={`r-${p.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          <PinField id={`pin-${p.id}`} value={pin} onChange={setPin} />
          {error && <div className="error" role="alert">{error}</div>}
          <p><button type="submit" disabled={busy}>{busy ? 'Signing…' : decision === 'approve' ? 'Sign and approve' : 'Sign and reject'}</button></p>
        </>
      )}
    </form>
  );
}
