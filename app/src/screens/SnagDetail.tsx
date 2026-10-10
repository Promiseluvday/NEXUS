// One snag (D-040 to D-044, D-200, D-208, D-218), laid out as the Claude
// Design wireframes WF-D2 (snag detail), WF-D3 (assess), WF-D4 (disposition)
// and WF-D6 (snag closed).
//
// Every view starts with the breadcrumb, a Back button, the tail header
// (status an engineer set, always visible, D-094) and the tail's tabs.
// The three views share one address, /snags/<id>; the step is in the
// address after "?", so Back and the breadcrumb work as usual:
//   /snags/<id>                    the snag: state, the reporter's words,
//                                  attachments, work order, queries, history
//   /snags/<id>?step=assess        engineer starts the assessment (attend)
//   /snags/<id>?step=disposition   request a work order, or defer (D-218)
//
// Engineers act here:
//   Snag open     → "Assess" (turns the tail chip amber, D-200)
//   Snag attended → request a work order or defer (Disposition.tsx, D-218)
//   Snag deferred → request a work order to rectify it later (D-218)
//   Any time      → set the tail status (D-046, PIN D-215)
// Certifying (WF-D5) is done on the work order: certifying it closes the
// snag and, in the same signature, clears its DDLS entry (D-218).
// Everyone else (pilots, Quality, Command) reads, adds files and raises queries.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDateTime, type DisplaySettings } from '../lib/format';
import { SnagStateChip, TailStatusChip } from '../components/StatusChip';
import { SetTailStatus } from '../components/SetTailStatus';
import { Attachments } from '../components/Attachments';
import { BackButton, Crumbs, PageHead, Section, TailHeader, TailTabs, type Crumb } from '../components/PageFrame';
import { Disposition, WorkOrderForm, type Kind } from './Disposition';
import { Queries } from '../components/Queries';
import { useFleetBoard } from './FleetBoard';
import { cached } from '../lib/offline/cache';
import { usePendingFor } from '../lib/offline/hooks';
import { perform, queuedText } from '../lib/perform';

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
const ACTIVE_WO = ['requested', 'pre_approved', 'open', 'work_complete'];

type Step = '' | 'assess' | 'disposition';

export function SnagDetail() {
  const { id } = useParams();
  const { me, display } = useAuth();
  const { rows: fleet, load: loadBoard } = useFleetBoard();
  const [snag, setSnag] = useState<Snag | null | undefined>(undefined);
  const [linked, setLinked] = useState<Linked>({ workOrders: [], ddls: [], nadds: [] });
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [similar, setSimilar] = useState<Similar[] | null>(null);
  const [canCertify, setCanCertify] = useState(false);
  const [tailStatus, setTailStatus] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [offlineView, setOfflineView] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const pending = usePendingFor(`/snags/${id}`);
  const step = (params.get('step') ?? '') as Step;
  const path = (params.get('path') ?? '') as Kind | '';

  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  // Each read is saved on the tablet, so the page still opens offline (D-102).
  const load = useCallback(async () => {
    const { data, fromCache: offline } = await cached(`snag:${id}`, () => db.from('snag')
      .select(`id, number, status, disposition, description, ata, is_soft_observation, reporter_kind,
               tlb_book, tlb_page, tlb_item, created_at, attended_at, assessment, dispositioned_at,
               closed_at, closure_note, aircraft_id,
               aircraft:aircraft_id (tail, aircraft_type_code),
               reporter:reported_by (three_letter_code, full_name),
               attender:attended_by (three_letter_code),
               dispositioner:dispositioned_by (three_letter_code),
               closer:closed_by (three_letter_code)`)
      .eq('id', id!)
      .maybeSingle());
    const s = data as unknown as Snag | null;
    setSnag(s);
    setOfflineView(offline);
    if (!s) return;
    const [wo, dd, na, rep, st] = await Promise.all([
      cached(`snag:${s.id}:wo`, () => db.from('work_order').select('id, number, status').eq('snag_id', s.id)),
      cached(`snag:${s.id}:ddls`, () => db.from('ddls_entry').select('id, page_no, entry_no, kind, mel_ref, due_at, limit_text, status').eq('snag_id', s.id)),
      cached(`snag:${s.id}:nadd`, () => db.from('nadd').select('id, number, status, due_at').eq('snag_id', s.id)),
      cached(`snag:${s.id}:repeat`, () => actions.rpc('repeat_defect', { p_snag: s.id })),
      cached(`status:${s.aircraft_id}`, () => db.from('aircraft_current_status').select('status').eq('aircraft_id', s.aircraft_id).maybeSingle()),
    ]);
    setLinked({
      workOrders: (wo.data ?? []) as Linked['workOrders'],
      ddls: (dd.data ?? []) as Linked['ddls'],
      nadds: (na.data ?? []) as Linked['nadds'],
    });
    setRepeat(((rep.data ?? []) as unknown as Repeat[])[0] ?? null);
    setTailStatus((st.data as { status: string } | null)?.status ?? null);
    if (me && s.aircraft) {
      const type = s.aircraft.aircraft_type_code;
      const { data: c } = await cached(`certifying:${me.personId}:${type}`, () => actions.rpc('is_certifying', {
        p_person: me.personId, p_aircraft_type: type,
      }));
      setCanCertify(c === true);
    }
  }, [id, me]);

  useEffect(() => { load(); }, [load]);

  // A new step starts at the top of the page (the scrolling area is .main).
  useEffect(() => { document.querySelector('.main')?.scrollTo?.(0, 0); }, [step]);

  // Move between the snag page and its steps, keeping other options (e.g. ?query=new).
  const go = useCallback((next: Step, kind: Kind | '' = '') => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (next) n.set('step', next); else n.delete('step');
      if (kind) n.set('path', kind); else n.delete('path');
      return n;
    });
  }, [setParams]);

  async function showSimilar() {
    if (similar) return setSimilar(null); // second tap hides the list
    const { data } = await actions.rpc('similar_snags', { p_snag: id!, p_limit: 10 });
    setSimilar((data ?? []) as unknown as Similar[]);
  }

  if (snag === undefined) return <div className="page muted">Loading…</div>;
  if (snag === null) return <div className="page"><p>This snag does not exist or is outside what you may see.</p></div>;

  const tail = snag.aircraft?.tail ?? '';
  const row = fleet.find((r) => r.aircraft_id === snag.aircraft_id);
  const nowStatus = tailStatus ?? row?.status ?? null;
  const who = (p: Person) => <span className="mono">{p?.three_letter_code ?? '—'}</span>;
  // After any action: show what happened, re-read the snag and the tail, and
  // return to the snag page.
  const done = (m: string) => { setMessage(m); setWoOpen(false); load(); loadBoard(); go(''); };
  // What this tablet has done to the snag but not yet sent (D-102, D-217).
  const waitingAttend = pending.some((p) => p.action === 'attend_snag');
  const waitingDisposition = pending.find((p) => p.kind === 'signed' || p.action === 'request_work_order');
  const status = waitingDisposition ? 'waiting' : snag.status === 'reported' && waitingAttend ? 'attended' : snag.status;
  const activeWo = linked.workOrders.find((w) => ACTIVE_WO.includes(w.status));

  // Which view to show. A step that no longer fits the snag's state falls
  // back to the right one (e.g. "assess" on a snag already attended).
  let view: Step = '';
  if (isEngineer && step === 'assess') view = status === 'reported' ? 'assess' : status === 'attended' ? 'disposition' : '';
  if (isEngineer && step === 'disposition') view = status === 'attended' ? 'disposition' : status === 'reported' ? 'assess' : '';

  const crumbs: Crumb[] = [
    { label: 'All aircraft', to: '/' },
    { label: <span className="mono">{tail}</span>, to: `/aircraft/${snag.aircraft_id}` },
    { label: 'Snag list', to: `/snags?aircraft=${snag.aircraft_id}` },
    { label: <span className="mono">{snag.number}</span>, to: `/snags/${snag.id}` },
    ...(view === 'assess' ? [{ label: 'Assess snag' }] : []),
    ...(view === 'disposition' ? [{ label: 'Disposition' }] : []),
  ];

  // The repeat-defect alert (red border). An alert only; the engineer decides
  // what it means (D-208).
  const repeatBanner = repeat?.is_repeat && (
    <div className="box box-warn">
      <div className="box-body">
        <div className="repeat-line">
          <span><strong className="repeat-word">Repeat defect.</strong> {repeat.reports_in_window} reports on <span className="mono">{tail}</span> in
            ATA <span className="mono">{repeat.ata_sub_chapter}</span> within {repeat.window_days} days. Alert only: the engineer decides what it means (D-208).</span>
          <button type="button" className="outline-button" onClick={showSimilar} aria-expanded={Boolean(similar)}>
            {similar ? 'Hide similar defects' : 'See similar defects'}
          </button>
        </div>
        {similar && <SimilarList items={similar} display={display} />}
      </div>
    </div>
  );

  return (
    <div className="page snag-page">
      <Crumbs items={crumbs} />
      {view
        ? <BackButton to={`/snags/${snag.id}`} label="Snag detail" />
        : <BackButton to={`/snags?aircraft=${snag.aircraft_id}`} label="Snag list" />}
      {row ? <TailHeader row={row} /> : (
        <div className="tail-head">
          <div className="tail-head-tail">{tail}</div>
          <div className="tail-head-status"><TailStatusChip status={nowStatus} /></div>
        </div>
      )}
      <TailTabs aircraftId={snag.aircraft_id} />

      {message && <div className={/provisional|queued|kept on this tablet/i.test(message) ? 'offline-banner' : 'success'} role="status">{message}</div>}
      {offlineView && <div className="offline-banner" role="status">Offline · showing this snag as last saved on this tablet.</div>}
      {pending.length > 0 && (
        <div className="offline-banner" role="status">
          <strong>Waiting on this tablet, provisional:</strong>
          <ul style={{ margin: '4px 0 0' }}>
            {pending.map((p) => (
              <li key={p.id}>{p.label}{p.kind === 'signed' && ' · signed offline'}{p.status === 'failed' && <> · <span style={{ color: 'var(--red)' }}>refused: {p.error}</span></>}</li>
            ))}
          </ul>
          <Link to="/sync">Send queue</Link>
        </div>
      )}

      {/* ---------------------------------------------- WF-D3 Assess snag */}
      {view === 'assess' && (
        <>
          <PageHead title={<>Assess <span className="mono">{snag.number}</span> · <span className="mono">{tail}</span></>} sub="Engineer only" />
          <div className="notice" style={{ margin: 0 }}>
            Starting this assessment changes the tail chip from <span className="chip tone-blue">Snag open</span> to{' '}
            <span className="chip tone-amber">Snag attended</span>. Neither is a serviceability status: the last
            engineer-set status (<TailStatusChip status={nowStatus} short />{row?.status_set_by && <> set by <span className="mono">{row.status_set_by}</span></>})
            stays until an engineer sets a new one (D-200, D-045, D-046).
          </div>
          {repeatBanner}
          <ReportBox snag={snag} who={who} display={display} />
          <AttendForm snagId={snag.id} snagNumber={snag.number} aircraftId={snag.aircraft_id}
            onCancel={() => go('')}
            onDone={async (m) => { setMessage(m); await load(); loadBoard(); go('disposition'); }} />
          <Section title="Set aircraft status (engineer only; signed with your PIN)">
            <p className="small muted" style={{ margin: 0 }}>
              The status is the engineer's decision (D-046, D-215). Assessing or deferring a snag does not change it.
            </p>
            <SetTailStatus aircraftId={snag.aircraft_id} tail={tail} current={tailStatus}
              onDone={(m) => { setMessage(m ?? `Status of ${tail} recorded.`); load(); loadBoard(); }} />
          </Section>
        </>
      )}

      {/* ---------------------------------------------- WF-D4 Disposition */}
      {view === 'disposition' && snag.aircraft && (
        <>
          <PageHead title={<>Disposition · <span className="mono">{snag.number}</span></>}
            sub="Choose one path. Without an approved work order, a snag can only be deferred (D-218)." />
          {repeatBanner}
          <Disposition
            snag={{ ...snag, aircraft_type: snag.aircraft.aircraft_type_code, tail, tail_status: nowStatus }}
            canCertify={canCertify}
            initialKind={path}
            onDone={done}
            onChoose={() => setMessage('')}
            onCancel={() => go('')}
          />
        </>
      )}

      {/* ---------------------------------------------- WF-D2 Snag detail */}
      {view === '' && (
        <>
          <PageHead title={<><span className="mono">{snag.number}</span> · <span className="mono">{tail}</span></>} sub="Snag detail">
            {isEngineer && status === 'reported' && <button type="button" onClick={() => go('assess')}>Assess (engineer)</button>}
          </PageHead>

          {/* WF-D6: once certified, the closure and the tail's status now. */}
          {snag.status === 'closed' && (
            <Section title={<><span className="mono">{snag.number}</span> closed</>}>
              <div>Closed by {who(snag.closer)} · {formatDateTime(snag.closed_at, display)}{snag.disposition === 'nff' && ' · no fault found'}</div>
              {snag.closure_note && <div className="small">{snag.closure_note}</div>}
              <div className="chip-row" style={{ marginTop: 0 }}>
                <span className="small muted">Aircraft status now:</span>
                <TailStatusChip status={nowStatus} />
                {row?.status_set_by && <span className="small muted">set by <span className="mono">{row.status_set_by}</span> · {formatDateTime(row.status_set_at, display)}</span>}
              </div>
              <div className="action-row">
                <Link className="button outline-button" to={`/aircraft/${snag.aircraft_id}`}>Back to aircraft</Link>
                <Link className="button outline-button" to={`/aircraft/${snag.aircraft_id}#panel-activity`}>Aircraft activity</Link>
              </div>
            </Section>
          )}

          {repeatBanner}

          <Section title="State">
            <div className="chip-row" style={{ marginTop: 0 }}>
              {status === 'waiting'
                ? <span className="chip tone-amber provisional">Waiting on this tablet</span>
                : <SnagStateChip status={status} disposition={snag.disposition} />}
              <span>reported by {who(snag.reporter)} ({snag.reporter_kind}) · {formatDateTime(snag.created_at, display)}</span>
            </div>
            <div className="chip-row" style={{ marginTop: 0 }}>
              <span className="small muted">Tail status (set by an engineer):</span>
              <TailStatusChip status={nowStatus} />
            </div>
            {(linked.ddls.length > 0 || linked.nadds.length > 0) && (
              <ul className="open-list">
                {linked.ddls.map((d) => (
                  <li key={d.id}>
                    <Link to={`/ddls?aircraft=${snag.aircraft_id}`}>DDLS page {d.page_no} entry {d.entry_no}</Link>
                    <span>{d.kind === 'mel' ? <>MEL <span className="mono">{d.mel_ref}</span></> : 'non-MEL'} · {d.status}</span>
                    {d.due_at && <span className="small">due <span className="mono">{formatDateTime(d.due_at, display)}</span></span>}
                    {d.limit_text && <span className="small">{d.limit_text}</span>}
                  </li>
                ))}
                {linked.nadds.map((n) => (
                  <li key={n.id}>
                    <Link className="mono" to={`/nadds?aircraft=${snag.aircraft_id}`}>{n.number}</Link>
                    <span>NADD · {n.status}</span>
                    {n.due_at && <span className="small">due <span className="mono">{formatDateTime(n.due_at, display)}</span></span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <ReportBox snag={snag} who={who} display={display}
            extra={!repeat?.is_repeat && (
              <>
                <button type="button" className="link-button" onClick={showSimilar} aria-expanded={Boolean(similar)}>
                  Similar defects on the {snag.aircraft?.aircraft_type_code} {similar ? '▾' : '▸'}
                </button>
                {similar && <SimilarList items={similar} display={display} />}
              </>
            )} />

          <Section title="Attachments">
            {/* Photos and scans, PDF or images only, never deleted (D-026, D-023). */}
            <Attachments recordTable="snag" recordId={snag.id} kinds={['photo', 'tech_log_page', 'document']}
              canUpload={Boolean(me) && snag.status !== 'closed'} />
          </Section>

          <Section title="Work order" tone="strong" id="work-order">
            <WorkOrderBox snag={snag} status={status} linked={linked} activeWo={activeWo} isEngineer={isEngineer}
              woOpen={woOpen} setWoOpen={setWoOpen} go={go} onDone={done} />
          </Section>

          {isEngineer && (
            <Section title="Tail status">
              <p className="small muted" style={{ margin: 0 }}>
                The status is the engineer's decision (D-046), signed with your PIN (D-215). Reporting or deferring a snag does not change it.
              </p>
              <SetTailStatus aircraftId={snag.aircraft_id} tail={tail} current={tailStatus}
                onDone={(m) => { setMessage(m ?? `Status of ${tail} recorded.`); load(); loadBoard(); }} />
            </Section>
          )}

          <Queries recordTable="snag" recordId={snag.id} startOpen={params.get('query') === 'new'} />

          <Section title="History">
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
            <div className="action-row">
              <button type="button" className="outline-button" disabled title="Not built yet">
                This snag's versions <span className="rail-tag">Soon</span>
              </button>
              <Link className="button outline-button" to={`/aircraft/${snag.aircraft_id}#panel-activity`}>Aircraft activity</Link>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// The report as the reporter wrote it. Never edited: corrections are made by
// the engineer's own entries, not by changing these words (D-023).
function ReportBox({ snag, who, display, extra }: {
  snag: Snag; who: (p: Person) => ReactNode; display: DisplaySettings; extra?: ReactNode;
}) {
  const whose = snag.reporter_kind === 'pilot' ? "Pilot's words" : "Reporter's words";
  return (
    <Section title={`${whose} (original, never edited)`}>
      <p className="report-text" style={{ margin: 0 }}>{snag.description}</p>
      <dl className="facts" style={{ margin: 0 }}>
        {snag.is_soft_observation && <><dt>Type</dt><dd>Soft observation (D-041)</dd></>}
        <dt>ATA</dt><dd className="mono">{snag.ata ?? '—'}</dd>
        <dt>Tech log</dt>
        <dd className="mono">{[snag.tlb_book && `Book ${snag.tlb_book}`, snag.tlb_page && `p.${snag.tlb_page}`, snag.tlb_item && `item ${snag.tlb_item}`].filter(Boolean).join(' · ') || '—'}</dd>
        <dt>Reported</dt>
        <dd>{formatDateTime(snag.created_at, display)} by {who(snag.reporter)} ({snag.reporter_kind})</dd>
      </dl>
      {extra}
    </Section>
  );
}

function SimilarList({ items, display }: { items: Similar[]; display: DisplaySettings }) {
  if (items.length === 0) return <p className="small muted" style={{ margin: 0 }}>No similar defects found.</p>;
  return (
    <ul className="open-list">
      {items.map((x) => (
        <li key={x.id}>
          <Link className="mono" to={`/snags/${x.id}`}>{x.number}</Link>
          <span className="mono">{x.tail}</span>
          <span className="small mono">{x.ata ?? ''}</span>
          <span>{x.description}</span>
          <span className="small muted">{formatDateTime(x.reported_at, display)}</span>
        </li>
      ))}
    </ul>
  );
}

// The work order box (WF-D2, strong border). D-218: no work on a snag
// without an approved work order; the only thing allowed without one is a
// deferral (MEL, DDLS or NADD). A deferred snag stays deferred until its
// work order is certified; certifying clears the DDLS entry. A NADD may
// still be rectified directly, on the NADD list.
function WorkOrderBox({ snag, status, linked, activeWo, isEngineer, woOpen, setWoOpen, go, onDone }: {
  snag: Snag; status: string; linked: Linked; activeWo: Linked['workOrders'][number] | undefined; isEngineer: boolean;
  woOpen: boolean; setWoOpen: (v: boolean) => void; go: (s: Step, k?: Kind | '') => void; onDone: (m: string) => void;
}) {
  const openNadd = linked.nadds.some((n) => n.status === 'open');
  return (
    <>
      {linked.workOrders.length === 0
        ? <div>No work order yet on <span className="mono">{snag.number}</span>.</div>
        : (
          <ul className="open-list">
            {linked.workOrders.map((w) => (
              <li key={w.id}>
                <Link className="mono" to={`/work-orders/${w.id}`}>{w.number}</Link>
                <span>Work order · {WO_STATE[w.status] ?? w.status}</span>
                {w.status === 'work_complete' && <span className="small">Certify it on the work order (certifying engineer, PIN): that closes this snag.</span>}
              </li>
            ))}
          </ul>
        )}
      {status !== 'closed' && (
        <p className="small muted" style={{ margin: 0 }}>
          No work is recorded on a snag until its work order is approved by Quality, then the CO. Only a deferral under the MEL,
          on the DDLS or as a NADD can be made without one. A deferred snag is cleared by certifying its work order (D-218).
        </p>
      )}

      {isEngineer && status === 'reported' && (
        <div className="action-row">
          <span className="small">Assess the snag first; the work order or deferral follows.</span>
          <button type="button" onClick={() => go('assess')}>Assess (engineer)</button>
        </div>
      )}

      {isEngineer && status === 'attended' && !activeWo && (
        <div className="action-row">
          <button type="button" onClick={() => go('disposition', 'rectify_now')}>Request work order</button>
          <button type="button" className="outline-button" onClick={() => go('disposition')}>Defer under MEL, DDLS or NADD</button>
        </div>
      )}

      {isEngineer && snag.status === 'deferred' && (
        activeWo
          ? <p style={{ margin: 0 }}>Certifying <Link className="mono" to={`/work-orders/${activeWo.id}`}>{activeWo.number}</Link> clears the deferral and closes the snag.</p>
          : woOpen
            ? <WorkOrderForm snag={snag} deferred onDone={onDone} onCancel={() => setWoOpen(false)} />
            : (
              <div className="action-row">
                <button type="button" onClick={() => setWoOpen(true)}>Request work order to rectify</button>
                {openNadd && (
                  <Link className="button outline-button" to={`/nadds?aircraft=${snag.aircraft_id}`}>Rectify the NADD directly</Link>
                )}
              </div>
            )
      )}

      {!isEngineer && snag.status !== 'closed' && (
        <p className="small muted" style={{ margin: 0 }}>An engineer assesses and dispositions this snag. A pilot cannot close an entry (D-042).</p>
      )}
    </>
  );
}

// WF-D3: the assessment, in the engineer's own words. Saving it "attends"
// the snag (the tail chip turns amber, D-200) and moves on to the disposition.
function AttendForm({ snagId, snagNumber, aircraftId, onDone, onCancel }: {
  snagId: string; snagNumber: string; aircraftId: string; onDone: (m: string) => void; onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const o = await perform('attend_snag', { p_snag: snagId, p_note: note.trim() || undefined },
      { label: `Attend ${snagNumber}`, recordPath: `/snags/${snagId}`, aircraftId });
    setBusy(false);
    if (o.error) return setError(errorText(o.error));
    if (o.queued) return onDone(queuedText(o, `Attend ${snagNumber}`) + ' You can choose the disposition now.');
    onDone('Snag attended. The tail now shows amber "Snag attended" (D-200). Choose a disposition below.');
  }
  return (
    <form onSubmit={submit}>
      <Section title="Assessment, in the engineer's own words" tone="strong">
        <label htmlFor="attend-note" style={{ margin: 0 }}>Assessment <span className="hint">(optional now; you can add detail on the work order)</span></label>
        <textarea id="attend-note" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <div className="error" role="alert">{error}</div>}
        <div className="action-row">
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Start assessment and continue to disposition'}</button>
          <button type="button" className="outline-button" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </Section>
    </form>
  );
}
