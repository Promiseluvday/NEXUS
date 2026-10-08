// One snag (D-040 to D-044, D-200, D-208).
//
// Top: the snag's state AND the tail's engineer-set status, always visible.
// Then the report as written, the history (who did what, when), records it
// led to (work order, DDLS entry, NADD), and a repeat-defect alert if the
// tail has had several in the same ATA sub-chapter (alert only, D-208).
//
// Engineers act here:
//   Snag open     → "Attend this snag" (turns the tail chip amber, D-200)
//   Snag attended → choose one of five dispositions (Disposition.tsx)
//   Any time      → set the tail status (D-046)
// Everyone else (pilots, Quality, Command) reads only.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import { SnagStateChip, TailStatusChip } from '../components/StatusChip';
import { SetTailStatus } from '../components/SetTailStatus';
import type { AircraftOption } from '../components/AircraftPicker';
import { Disposition } from './Disposition';

type Person = { three_letter_code: string; full_name?: string } | null;
type Snag = {
  id: string; number: string; status: string; disposition: string | null;
  description: string; ata: string | null; is_soft_observation: boolean; reporter_kind: string;
  tlb_book: string | null; tlb_page: string | null; tlb_item: string | null;
  created_at: string; attended_at: string | null; assessment: string | null;
  dispositioned_at: string | null; closed_at: string | null; closure_note: string | null;
  aircraft_id: string;
  aircraft: { tail: string; aircraft_type_code: string } | null;
  reporter: Person; attender: Person; dispositioner: Person; closer: Person;
};
type Linked = {
  workOrders: { id: string; number: string; status: string }[];
  ddls: { id: string; page_no: number; entry_no: number; kind: string; mel_ref: string | null; due_at: string | null; limit_text: string | null; status: string }[];
  nadds: { id: string; number: string; status: string; due_at: string | null }[];
};
type Repeat = { is_repeat: boolean; reports_in_window: number; ata_sub_chapter: string; window_days: number };
type Similar = { id: string; number: string; tail: string; ata: string | null; description: string; status: string; reported_at: string };

const WO_STATE: Record<string, string> = {
  requested: 'awaiting Quality', pre_approved: 'awaiting CO', open: 'open for work',
  work_complete: 'awaiting certification', certified: 'certified', rejected: 'rejected', cancelled: 'cancelled',
};

export function SnagDetail() {
  const { id } = useParams();
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [snag, setSnag] = useState<Snag | null | undefined>(undefined);
  const [linked, setLinked] = useState<Linked>({ workOrders: [], ddls: [], nadds: [] });
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [similar, setSimilar] = useState<Similar[] | null>(null);
  const [canCertify, setCanCertify] = useState(false);
  const [tailStatus, setTailStatus] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const load = useCallback(async () => {
    const { data } = await db.from('snag')
      .select(`id, number, status, disposition, description, ata, is_soft_observation, reporter_kind,
               tlb_book, tlb_page, tlb_item, created_at, attended_at, assessment, dispositioned_at,
               closed_at, closure_note, aircraft_id,
               aircraft:aircraft_id (tail, aircraft_type_code),
               reporter:reported_by (three_letter_code, full_name),
               attender:attended_by (three_letter_code),
               dispositioner:dispositioned_by (three_letter_code),
               closer:closed_by (three_letter_code)`)
      .eq('id', id!)
      .maybeSingle();
    const s = data as unknown as Snag | null;
    setSnag(s);
    if (!s) return;
    const [wo, dd, na, rep, st] = await Promise.all([
      db.from('work_order').select('id, number, status').eq('snag_id', s.id),
      db.from('ddls_entry').select('id, page_no, entry_no, kind, mel_ref, due_at, limit_text, status').eq('snag_id', s.id),
      db.from('nadd').select('id, number, status, due_at').eq('snag_id', s.id),
      actions.rpc('repeat_defect', { p_snag: s.id }),
      db.from('aircraft_current_status').select('status').eq('aircraft_id', s.aircraft_id).maybeSingle(),
    ]);
    setLinked({
      workOrders: (wo.data ?? []) as Linked['workOrders'],
      ddls: (dd.data ?? []) as Linked['ddls'],
      nadds: (na.data ?? []) as Linked['nadds'],
    });
    setRepeat(((rep.data ?? []) as unknown as Repeat[])[0] ?? null);
    setTailStatus((st.data as { status: string } | null)?.status ?? null);
    if (me && s.aircraft) {
      const { data: c } = await actions.rpc('is_certifying', {
        p_person: me.personId, p_aircraft_type: s.aircraft.aircraft_type_code,
      });
      setCanCertify(c === true);
    }
  }, [id, me]);

  useEffect(() => { load(); }, [load]);

  async function showSimilar() {
    const { data } = await actions.rpc('similar_snags', { p_snag: id!, p_limit: 10 });
    setSimilar((data ?? []) as unknown as Similar[]);
  }

  if (snag === undefined) return <div className="page muted">Loading…</div>;
  if (snag === null) return <div className="page"><p>This snag does not exist or is outside what you may see.</p></div>;

  const tail = snag.aircraft?.tail ?? '';
  const who = (p: Person) => <span className="mono">{p?.three_letter_code ?? '—'}</span>;
  const done = (m: string) => { setMessage(m); load(); };
  const fleetEntry = aircraft.find((a) => a.id === snag.aircraft_id);

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">All aircraft</Link> › <Link className="mono" to={`/aircraft/${snag.aircraft_id}`}>{tail}</Link> ›{' '}
        <Link to="/snags">Snags</Link> › <span className="mono">{snag.number}</span>
      </div>
      <div className="page-head">
        <div>
          <h1><span className="mono">{snag.number}</span> · <span className="tail">{tail}</span></h1>
          <div className="chip-row">
            <SnagStateChip status={snag.status} disposition={snag.disposition} />
            <span className="small muted">Tail status:</span>
            <TailStatusChip status={tailStatus ?? fleetEntry?.status ?? null} />
          </div>
        </div>
      </div>

      {message && <div className="success" role="status">{message}</div>}

      {repeat?.is_repeat && (
        <div className="notice">
          <strong>Repeat defect alert:</strong> {repeat.reports_in_window} reports on {tail} in ATA {repeat.ata_sub_chapter} within{' '}
          {repeat.window_days} days. This is an alert only; the engineer decides what it means (D-208).
        </div>
      )}

      <div className="detail-grid">
        <section className="card">
          <h2>Report</h2>
          <p className="report-text">{snag.description}</p>
          <dl className="facts">
            {snag.is_soft_observation && <><dt>Type</dt><dd>Soft observation</dd></>}
            <dt>ATA</dt><dd className="mono">{snag.ata ?? '—'}</dd>
            <dt>Tech log</dt>
            <dd className="mono">{[snag.tlb_book && `Book ${snag.tlb_book}`, snag.tlb_page && `p.${snag.tlb_page}`, snag.tlb_item && `item ${snag.tlb_item}`].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Reported</dt>
            <dd>{formatDateTime(snag.created_at, display)} by {who(snag.reporter)} ({snag.reporter_kind})</dd>
          </dl>
          <button type="button" className="link-button" onClick={showSimilar}>Similar defects on the {snag.aircraft?.aircraft_type_code} ▸</button>
          {similar && (
            similar.length === 0 ? <p className="small muted">No similar defects found.</p> : (
              <ul className="open-list">
                {similar.map((x) => (
                  <li key={x.id}>
                    <Link className="mono" to={`/snags/${x.id}`}>{x.number}</Link>
                    <span className="tail">{x.tail}</span>
                    <span className="small mono">{x.ata ?? ''}</span>
                    <span>{x.description}</span>
                    <span className="small muted">{formatDateTime(x.reported_at, display)}</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>

        <section className="card">
          <h2>History</h2>
          <ol className="timeline">
            <li><strong>Reported</strong> by {who(snag.reporter)} · {formatDateTime(snag.created_at, display)}</li>
            {snag.attended_at && (
              <li><strong>Attended</strong> by {who(snag.attender)} · {formatDateTime(snag.attended_at, display)}
                {snag.assessment && <div className="small">{snag.assessment}</div>}</li>
            )}
            {snag.dispositioned_at && (
              <li><strong>Dispositioned</strong> by {who(snag.dispositioner)} · {formatDateTime(snag.dispositioned_at, display)}</li>
            )}
            {snag.closed_at && (
              <li><strong>Closed</strong> by {who(snag.closer)} · {formatDateTime(snag.closed_at, display)}
                {snag.closure_note && <div className="small">{snag.closure_note}</div>}</li>
            )}
          </ol>
          {(linked.workOrders.length > 0 || linked.ddls.length > 0 || linked.nadds.length > 0) && (
            <>
              <h2>Records</h2>
              <ul className="open-list">
                {linked.workOrders.map((w) => (
                  <li key={w.id}><span className="mono">{w.number}</span> Work order · {WO_STATE[w.status] ?? w.status}</li>
                ))}
                {linked.ddls.map((d) => (
                  <li key={d.id}>
                    DDLS page {d.page_no} entry {d.entry_no} · {d.kind === 'mel' ? `MEL ${d.mel_ref}` : 'non-MEL'} · {d.status}
                    {d.due_at && <span className="small"> · due {formatDateTime(d.due_at, display)}</span>}
                    {d.limit_text && <span className="small"> · {d.limit_text}</span>}
                  </li>
                ))}
                {linked.nadds.map((n) => (
                  <li key={n.id}><span className="mono">{n.number}</span> NADD · {n.status}
                    {n.due_at && <span className="small"> · due {formatDateTime(n.due_at, display)}</span>}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {isEngineer && snag.status === 'reported' && <AttendForm snagId={snag.id} onDone={done} />}

      {isEngineer && snag.status === 'attended' && snag.aircraft && (
        <Disposition
          snag={{ ...snag, aircraft_type: snag.aircraft.aircraft_type_code }}
          canCertify={canCertify}
          onDone={done}
          onChoose={() => setMessage('')}
        />
      )}

      {isEngineer && (
        <div className="card">
          <h2>Tail status</h2>
          <p className="small muted">
            The status is the engineer's decision (D-046). Reporting or deferring a snag does not change it.
          </p>
          <SetTailStatus aircraftId={snag.aircraft_id} tail={tail} current={tailStatus} onDone={() => done(`Status of ${tail} recorded.`)} />
        </div>
      )}

      {!isEngineer && snag.status !== 'closed' && (
        <p className="small muted">An engineer assesses and dispositions this snag. A pilot cannot close an entry (D-042).</p>
      )}
    </div>
  );
}

function AttendForm({ snagId, onDone }: { snagId: string; onDone: (m: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await actions.rpc('attend_snag', { p_snag: snagId, p_note: note.trim() || undefined });
    setBusy(false);
    if (err) return setError(errorText(err));
    onDone('Snag attended. The tail now shows amber "Snag attended" (D-200). Choose a disposition below.');
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Attend this snag</h2>
      <p className="small muted">Starts your assessment. The tail chip turns from blue "Snag open" to amber "Snag attended".</p>
      <label htmlFor="attend-note">First assessment note <span className="hint">(optional)</span></label>
      <textarea id="attend-note" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Attend snag'}</button></p>
    </form>
  );
}
