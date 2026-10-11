// NADDs: Non-Airworthiness Deferred Defects (D-048, D-160 to D-166, D-209,
// workflows/nadd.md), laid out as the Claude Design wireframes WF-NA1 (list
// per tail), WF-NA3 (NADD detail) and WF-NA4 (cabin items to review).
//
// All on the one /nadds address (no extra routes):
//   ?aircraft=<id>              the tail's NADDs, soonest due first (WF-NA1)
//   ?aircraft=<id>&nadd=<id>    one NADD in full, with its actions (WF-NA3)
//   ?review=1                   cabin items waiting for an engineer, all
//                               tails in your scope (WF-NA4)
// Logging a NADD is the /cabin-item screen (WF-NA2).
//
// NADDs never change the tail status and never block the A-check (D-165,
// D-166). The countdown runs from the REPORT date (D-160).
//
// Engineers:
//   Proposed: confirm as NADD (declaration + PIN), reject with a reason the
//             reporter sees, or reclassify as a snag
//   Open:     rectify (PIN; no work order needed, it may be fixed at another
//             MRO, D-218), request an extension (approval), reclassify
// Crews see the list, so they know what is inoperative in the cabin.
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { perform, queuedText, type Outcome } from '../lib/perform';
import { cached } from '../lib/offline/cache';
import { useApproachingDays } from '../lib/settings';
import { formatDate, formatDateTime } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { PinField } from '../components/PinField';
import { Crumbs, BackButton, PageHead, Section } from '../components/PageFrame';
import { countdown, Fact, Message, PendingBanner, TailTop, tlbRef, useTailParam } from './Ddls';

type Who = { three_letter_code: string } | null;

export type Nadd = {
  id: string; number: string; status: string; aircraft_id: string; zone_code: string | null; location: string | null;
  description: string; ata: string | null; reported_at: string; due_at: string | null; limit_days: number | null;
  tlb_book: string | null; tlb_page: string | null; tlb_item: string | null;
  confirmed_at: string | null; rejected_at: string | null;
  rectified_at: string | null; action_taken: string | null; rect_tlb_book: string | null; rect_tlb_page: string | null;
  reject_reason: string | null; reclassified_snag_id: string | null; snag_id: string | null;
  reporter: Who; confirmer: Who; rectifier: Who; rejecter: Who;
  aircraft: { tail: string } | null;
  extensions: { id: string; extra_days: number; status: string; reason: string; new_due_at: string | null; created_at: string }[];
};

export const NADD_SELECT = `id, number, status, aircraft_id, zone_code, location, description, ata, reported_at, due_at, limit_days,
  tlb_book, tlb_page, tlb_item, confirmed_at, rejected_at, rectified_at, action_taken, rect_tlb_book, rect_tlb_page, reject_reason,
  reclassified_snag_id, snag_id,
  reporter:reported_by (three_letter_code), confirmer:confirmed_by (three_letter_code),
  rectifier:rectified_by (three_letter_code), rejecter:rejected_by (three_letter_code),
  aircraft:aircraft_id (tail),
  extensions:nadd_extension (id, extra_days, status, reason, new_due_at, created_at)`;

const STATE: Record<string, { label: string; tone: string }> = {
  proposed: { label: 'Proposed · awaiting engineer', tone: 'blue' },
  open: { label: 'Open', tone: 'amber' },
  rectified: { label: 'Rectified', tone: 'grey' },
  reclassified: { label: 'Reclassified as snag', tone: 'grey' },
  rejected: { label: 'Rejected', tone: 'grey' },
};

const VIEWS: Record<string, string[]> = {
  current: ['proposed', 'open'],
  closed: ['rectified', 'reclassified', 'rejected'],
  all: ['proposed', 'open', 'rectified', 'reclassified', 'rejected'],
};

const NADD_ACTIONS = ['propose_nadd', 'defer_as_nadd', 'confirm_nadd', 'rectify_nadd'];
const tlc = (w: Who) => w?.three_letter_code ?? '—';
const where = (n: Nadd) => [n.zone_code, n.location].filter(Boolean).join(' · ');

// The countdown or the state, as one chip.
function NaddChip({ n, now, margin }: { n: Nadd; now: Date; margin: number }) {
  if (n.status === 'open') {
    const c = countdown(n.due_at, now, margin);
    if (c) return <span className={`chip tone-${c.tone}`}>{c.label}</span>;
  }
  const s = STATE[n.status] ?? { label: n.status, tone: 'grey' };
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function NaddList() {
  const [params] = useSearchParams();
  if (params.get('review')) return <CabinReview />;
  if (params.get('nadd')) return <NaddDetail id={params.get('nadd')!} />;
  return <NaddSheet />;
}

// ------------------------------------------------------------ WF-NA1
function NaddSheet() {
  const { display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [tailId, setTailId] = useTailParam(aircraft);
  const [view, setView] = useState('current');
  const [rows, setRows] = useState<Nadd[] | null>(null);
  const [toReview, setToReview] = useState<number | null>(null);
  const margin = useApproachingDays();
  const now = useMemo(() => new Date(), [rows]);
  const tail = aircraft.find((a) => a.id === tailId);

  const load = useCallback(async () => {
    if (!tailId) return;
    const { data } = await cached(`nadds:${tailId}:${view}`, () => db.from('nadd').select(NADD_SELECT)
      .eq('aircraft_id', tailId).in('status', VIEWS[view]).order('reported_at'));
    setRows((data ?? []) as unknown as Nadd[]);
  }, [tailId, view]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    db.from('nadd').select('id', { count: 'exact', head: true }).eq('status', 'proposed')
      .then(({ count }) => setToReview(count ?? null));
  }, []);

  // Sorted by days remaining (D-048): open by due time, then proposed, then closed.
  const sorted = useMemo(() => {
    const rank = (n: Nadd) => (n.status === 'open' ? 0 : n.status === 'proposed' ? 1 : 2);
    return [...(rows ?? [])].sort((a, b) => rank(a) - rank(b) || (a.due_at ?? a.reported_at).localeCompare(b.due_at ?? b.reported_at));
  }, [rows]);

  if (!tailId) return <div className="page"><p className="muted">No aircraft in your scope.</p></div>;

  return (
    <div className="page dd-page">
      <TailTop aircraftId={tailId} tail={tail?.tail} here={[{ label: 'NADD list' }]}
        back={{ to: `/aircraft/${tailId}`, label: `${tail?.tail ?? 'aircraft'} overview` }} />
      <PageHead title={<>NADD · <span className="mono">{tail?.tail}</span></>}
        sub="Non-airworthiness deferred defects · sorted by days remaining · countdown from the report date (D-160)">
        <Link className="button" to={`/cabin-item?aircraft=${tailId}`}>Log NADD</Link>
        <Link className="button outline-button" to={`/print/nadds/${tailId}`} target="_blank">Print NADDS</Link>
        <select aria-label="Which NADDs" className="dd-select" value={view} onChange={(e) => setView(e.target.value)}>
          <option value="current">Show: Proposed and open</option>
          <option value="closed">Show: Closed</option>
          <option value="all">Show: All</option>
        </select>
        <AircraftPicker aircraft={aircraft} value={tailId} onChange={setTailId} placeholder="Choose a tail" />
      </PageHead>
      <PendingBanner aircraftId={tailId} actionNames={NADD_ACTIONS} />
      {!rows && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <div className="box"><div className="box-body"><p className="muted">No NADDs to show on {tail?.tail ?? 'this tail'}.</p></div></div>}
      {rows && rows.length > 0 && (
        <div className="box">
          <div className="table-scroll">
            <table className="ptable">
              <thead><tr><th>NADD</th><th>Location / defect</th><th>Reported</th><th>Countdown</th><th>Confirmed by</th></tr></thead>
              <tbody>
                {sorted.map((n) => (
                  <tr key={n.id}>
                    <td><Link className="mono" to={`/nadds?aircraft=${tailId}&nadd=${n.id}`}>{n.number}</Link></td>
                    <td>{where(n) && <span className="muted">{where(n)} · </span>}{n.description}
                      {n.reject_reason && <div className="small">Rejected: {n.reject_reason}</div>}
                      {n.action_taken && <div className="small">Action: {n.action_taken}</div>}
                      {n.reclassified_snag_id && <div className="small"><Link to={`/snags/${n.reclassified_snag_id}`}>Open the snag</Link></div>}
                    </td>
                    <td className="mono">{formatDate(n.reported_at, display)}</td>
                    <td><NaddChip n={n} now={now} margin={margin} />
                      {n.extensions.some((x) => x.status === 'pending') && <div><span className="chip tone-blue">Extension waiting</span></div>}</td>
                    <td>{n.confirmer ? <><span className="mono">{tlc(n.confirmer)}</span> · {formatDate(n.confirmed_at, display)}</>
                      : n.status === 'proposed' ? <><span className="mono">{tlc(n.reporter)}</span> (proposed)</> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="action-row">
        <Link className="button outline-button" to={`/nadds?review=1&aircraft=${tailId}`}>
          Cabin items to review{toReview !== null && ` (${toReview})`}
        </Link>
        <span className="small muted">DDLS and NADD entries never change the aircraft status.</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ WF-NA3
function NaddDetail({ id }: { id: string }) {
  const { me, display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const [params] = useSearchParams();
  const [n, setN] = useState<Nadd | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [other, setOther] = useState<'' | 'reject' | 'reclassify' | 'extend'>('');
  const margin = useApproachingDays();
  const now = useMemo(() => new Date(), [n]);
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const load = useCallback(async () => {
    const { data } = await cached(`nadd:${id}`, () => db.from('nadd').select(NADD_SELECT).eq('id', id).maybeSingle());
    setN((data ?? null) as unknown as Nadd | null);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const tailId = n?.aircraft_id ?? params.get('aircraft') ?? '';
  const tail = n?.aircraft?.tail ?? aircraft.find((a) => a.id === tailId)?.tail;
  const listTo = `/nadds?aircraft=${tailId}`;
  const done = (m: string) => { setMessage(m); setOther(''); load(); };

  if (n === undefined) return <div className="page muted">Loading…</div>;
  if (n === null) {
    return <div className="page"><BackButton to={listTo} label="NADD list" /><p>This NADD is not in your aircraft scope.</p></div>;
  }
  const pending = n.extensions.find((x) => x.status === 'pending');
  const extensions = [...n.extensions].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="page dd-page">
      <TailTop aircraftId={tailId} tail={tail} here={[{ label: 'NADD list', to: listTo }, { label: n.number }]}
        back={{ to: listTo, label: 'NADD list' }} full={false} />
      <PageHead title={<><span className="mono">{n.number}</span> · <span className="mono">{tail}</span></>} sub={n.description}>
        <NaddChip n={n} now={now} margin={margin} />
      </PageHead>
      <Message text={message} />
      <PendingBanner aircraftId={tailId} actionNames={NADD_ACTIONS} />

      <Section title="NADD">
        <div className="dd-grid">
          <Fact k="Reported"><span className="mono">{formatDateTime(n.reported_at, display)}</span> · <span className="mono">{tlc(n.reporter)}</span></Fact>
          <Fact k="TLB ref"><span className="mono">{tlbRef(n.tlb_book, n.tlb_page, n.tlb_item) || '—'}</span></Fact>
          <Fact k="Limit">{n.limit_days ? <>{n.limit_days} days{n.due_at && <> · due <span className="mono">{formatDateTime(n.due_at, display)}</span></>}</> : 'Set when confirmed'}</Fact>
          <Fact k="Countdown"><NaddChip n={n} now={now} margin={margin} /></Fact>
          <Fact k="Location / zone">{where(n) || '—'}</Fact>
          <Fact k="ATA">{n.ata ? <span className="mono">{n.ata}</span> : '—'}</Fact>
        </div>
        <div><strong>Defect:</strong> {n.description}</div>
      </Section>

      {/* Confirmation (D-160) */}
      <Section title="Confirmation">
        {n.confirmer ? (
          <p style={{ margin: 0 }}>Confirmed by <span className="mono">{tlc(n.confirmer)}</span> · {formatDateTime(n.confirmed_at, display)} ·
            "Not covered by the MEL, no airworthiness effect" (signed with PIN)</p>
        ) : n.status === 'rejected' ? (
          <p style={{ margin: 0 }}>Rejected by <span className="mono">{tlc(n.rejecter)}</span> · {formatDateTime(n.rejected_at, display)}: {n.reject_reason}</p>
        ) : n.status === 'reclassified' ? (
          <p style={{ margin: 0 }}>Reclassified as a snag. <Link to={`/snags/${n.reclassified_snag_id}`}>Open the snag</Link>. The NADD record stays in history.</p>
        ) : n.status === 'proposed' && isEngineer ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>Proposed by <span className="mono">{tlc(n.reporter)}</span>. A certifying engineer confirms it (online, or provisional offline on an enrolled tablet, D-217).</p>
            <ConfirmForm nadd={n} onDone={done} />
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Proposed, waiting for an engineer to confirm, reject or reclassify it.</p>
        )}
      </Section>

      {(extensions.length > 0 || (isEngineer && n.status === 'open')) && (
        <Section title="Extensions" actions={isEngineer && n.status === 'open' && !pending && other !== 'extend'
          ? <button type="button" className="outline-button" onClick={() => setOther('extend')}>Request extension</button> : undefined}>
          {extensions.length > 0 ? (
            <div className="table-scroll">
              <table className="ptable">
                <thead><tr><th>#</th><th>Extra days</th><th>New limit</th><th>Reason</th><th>State</th></tr></thead>
                <tbody>
                  {extensions.map((x, i) => (
                    <tr key={x.id}>
                      <td className="mono">{i + 1}</td><td className="mono">+{x.extra_days} d</td>
                      <td className="mono">{x.new_due_at ? formatDateTime(x.new_due_at, display) : '—'}</td>
                      <td>{x.reason}</td>
                      <td><span className={`chip tone-${x.status === 'approved' ? 'green' : x.status === 'pending' ? 'blue' : 'grey'}`}>
                        {x.status === 'pending' ? 'Waiting for approval' : x.status === 'approved' ? 'Approved' : x.status === 'rejected' ? 'Rejected' : x.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="small muted" style={{ margin: 0 }}>No extensions. Extensions are a separate approval (Quality by default, D-160).</p>}
          {other === 'extend' && <ExtendForm nadd={n} onDone={done} onCancel={() => setOther('')} />}
        </Section>
      )}

      {n.status === 'rectified' && (
        <Section title="Rectification">
          <div className="dd-grid">
            <Fact k="Action taken">{n.action_taken}</Fact>
            <Fact k="Date"><span className="mono">{formatDateTime(n.rectified_at, display)}</span></Fact>
            <Fact k="Name"><span className="mono">{tlc(n.rectifier)}</span> (signed with PIN)</Fact>
            <Fact k="Log ref no"><span className="mono">{tlbRef(n.rect_tlb_book, n.rect_tlb_page) || '—'}</span></Fact>
          </div>
        </Section>
      )}

      {isEngineer && n.status === 'open' && (
        <Section title="Rectify (certifying engineer, PIN)">
          <p className="small muted" style={{ margin: 0 }}>A NADD can be rectified directly, without a work order: it may be fixed at another MRO (D-218).</p>
          <RectifyForm nadd={n} onDone={done} />
        </Section>
      )}

      {isEngineer && (n.status === 'open' || n.status === 'proposed') && (
        <Section title={n.status === 'proposed' ? 'Reject or reclassify' : 'Reclassify'}>
          <div className="action-row">
            {n.status === 'proposed' && (
              <button type="button" className={other === 'reject' ? '' : 'outline-button'} aria-pressed={other === 'reject'}
                onClick={() => setOther(other === 'reject' ? '' : 'reject')}>Reject, with a reason</button>
            )}
            <button type="button" className={other === 'reclassify' ? '' : 'outline-button'} aria-pressed={other === 'reclassify'}
              onClick={() => setOther(other === 'reclassify' ? '' : 'reclassify')}>Reclassify as a snag</button>
          </div>
          {other === 'reject' && <RejectForm nadd={n} onDone={done} />}
          {other === 'reclassify' && <ReclassifyForm nadd={n} />}
          <p className="small muted" style={{ margin: 0 }}>
            If it affects airworthiness, reclassify it as a snag; from the snag it can be deferred on the DDLS or MEL, or a work order requested. The NADD record stays in history.
          </p>
        </Section>
      )}

      <div className="action-row">
        <Link className="button outline-button" to={`/print/nadds/${tailId}`} target="_blank">Print NADDS</Link>
        <span className="button outline-button dd-soon" aria-disabled="true">History (this NADD's versions) <span className="rail-tag">Soon</span></span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ WF-NA4
// Cabin items (proposed NADDs) across every tail in your scope, with the
// engineer's decision right on the row (D-209).
function CabinReview() {
  const { me, display } = useAuth();
  const [params] = useSearchParams();
  const backTail = params.get('aircraft');
  const [rows, setRows] = useState<Nadd[] | null>(null);
  const [decided, setDecided] = useState<Nadd[]>([]);
  const [open, setOpen] = useState<{ id: string; act: 'confirm' | 'reject' | 'reclassify' } | null>(null);
  const [message, setMessage] = useState('');
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const [p, d] = await Promise.all([
      cached('nadds:review', () => db.from('nadd').select(NADD_SELECT).eq('status', 'proposed').order('reported_at', { ascending: false })),
      cached('nadds:review-decided', () => db.from('nadd').select(NADD_SELECT).neq('status', 'proposed')
        .not('zone_code', 'is', null).gte('reported_at', since).order('reported_at', { ascending: false }).limit(20)),
    ]);
    setRows((p.data ?? []) as unknown as Nadd[]);
    setDecided((d.data ?? []) as unknown as Nadd[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const done = (m: string) => { setMessage(m); setOpen(null); load(); };
  const time = (v: string) => (
    <><span className="mono">{formatDateTime(v, display)}</span>
      {display.timeZone !== 'UTC' && <span className="muted small"> ({new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(v))} UTC)</span>}</>
  );

  const decision = (n: Nadd): ReactNode => {
    if (n.status === 'open' || n.status === 'rectified') return <>Accepted as <Link className="mono" to={`/nadds?aircraft=${n.aircraft_id}&nadd=${n.id}`}>{n.number}</Link> · <span className="mono">{tlc(n.confirmer)}</span> {formatDateTime(n.confirmed_at, display)}</>;
    if (n.status === 'rejected') return <>Rejected: {n.reject_reason} · <span className="mono">{tlc(n.rejecter)}</span> {formatDateTime(n.rejected_at, display)}</>;
    if (n.status === 'reclassified') return <>Raised as <Link to={`/snags/${n.reclassified_snag_id}`}>snag</Link></>;
    return STATE[n.status]?.label ?? n.status;
  };

  return (
    <div className="page dd-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, ...(backTail ? [{ label: 'NADD list', to: `/nadds?aircraft=${backTail}` }] : []), { label: 'Cabin items to review' }]} />
      <BackButton to={backTail ? `/nadds?aircraft=${backTail}` : '/'} label={backTail ? 'NADD list' : 'All aircraft'} />
      <PageHead title="Cabin items to review" sub="Reported on the cabin map · all tails in your scope · times local with UTC beside them" />
      <Message text={message} />
      <PendingBanner actionNames={NADD_ACTIONS} />
      {!rows && <p className="muted">Loading…</p>}
      {rows && (
        <div className="box">
          <div className="table-scroll">
            <table className="ptable">
              <thead><tr><th>Item</th><th>Tail</th><th>Where</th><th>Reported</th><th>By</th><th>Decision</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="muted">Nothing waiting for an engineer.</td></tr>}
                {rows.map((n) => (
                  <Fragment key={n.id}>
                    <tr>
                      <td><Link to={`/nadds?aircraft=${n.aircraft_id}&nadd=${n.id}`}>{n.description}</Link><div className="small mono muted">{n.number}</div></td>
                      <td className="mono">{n.aircraft?.tail}</td>
                      <td>{where(n) || '—'}</td>
                      <td>{time(n.reported_at)}</td>
                      <td className="mono">{tlc(n.reporter)}</td>
                      <td>{isEngineer ? (
                        <div className="dd-decide">
                          {(['confirm', 'reject', 'reclassify'] as const).map((act) => (
                            <button key={act} type="button" aria-pressed={open?.id === n.id && open.act === act}
                              className={open?.id === n.id && open.act === act ? '' : 'outline-button'}
                              onClick={() => setOpen(open?.id === n.id && open.act === act ? null : { id: n.id, act })}>
                              {act === 'confirm' ? 'Accept as NADD' : act === 'reject' ? 'Reject (reason)' : 'Raise as snag'}
                            </button>
                          ))}
                        </div>
                      ) : <span className="chip tone-blue">Awaiting engineer</span>}</td>
                    </tr>
                    {open?.id === n.id && (
                      <tr className="dd-expanded"><td colSpan={6}>
                        {open.act === 'confirm' && <ConfirmForm nadd={n} onDone={done} />}
                        {open.act === 'reject' && <RejectForm nadd={n} onDone={done} />}
                        {open.act === 'reclassify' && <ReclassifyForm nadd={n} />}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
                {decided.map((n) => (
                  <tr key={n.id} className="dd-decided">
                    <td>{n.description}</td>
                    <td className="mono">{n.aircraft?.tail}</td>
                    <td>{where(n) || '—'}</td>
                    <td>{time(n.reported_at)}</td>
                    <td className="mono">{tlc(n.reporter)}</td>
                    <td className="small">{decision(n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Section title="Rules">
        <ul className="dd-rules">
          <li>Accept or reject: engineers who may confirm NADDs. A reason is required to reject, and the reporter sees it (D-209).</li>
          <li>Anything touching emergency equipment, exits, oxygen or emergency lighting goes to the snag workflow, never NADD.</li>
          <li>Decided items from the last 14 days are shown below the waiting ones.</li>
        </ul>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------ the forms

function useAction(onDone: (m: string) => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(problem: string | null,
    call: () => PromiseLike<{ error?: { message?: string } | null; queued?: Outcome['queued'] }>, message: string) {
    setError('');
    if (problem) return setError(problem);
    setBusy(true);
    const res = await call();
    setBusy(false);
    if (res.error) return setError(errorText(res.error));
    onDone(res.queued ? queuedText(res, message) : message);
  }
  return { error, busy, run };
}

function Foot({ error, busy, label, onCancel }: { error: string; busy: boolean; label: string; onCancel?: () => void }) {
  return (
    <>
      {error && <div className="error" role="alert">{error}</div>}
      <p className="action-row">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : label}</button>
        {onCancel && <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>}
      </p>
    </>
  );
}

function Labelled({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return <><label htmlFor={id}>{label}</label>{children}</>;
}

const pinProblem = (pin: string) => (/^[0-9]{4,8}$/.test(pin) ? null : 'Enter your PIN (4 to 8 digits) to sign.');

function ConfirmForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [limit, setLimit] = useState('');
  const [declared, setDeclared] = useState(false);
  const [pin, setPin] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!declared ? 'Confirm the item is not covered by the MEL and has no airworthiness effect (D-160).' : pinProblem(pin),
      () => perform('confirm_nadd', { p_nadd: nadd.id, p_pin: pin, p_declaration: declared, p_limit_days: limit ? Number(limit) : undefined },
        { label: `Confirm ${nadd.number} as NADD`, aircraftId: nadd.aircraft_id }),
      `${nadd.number} confirmed. Its countdown runs from the report date (D-160).`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`lim-${nadd.id}`} label={<>Limit in days <span className="hint">(blank for the operator default; shorter only)</span></>}>
        <input id={`lim-${nadd.id}`} className="mono dd-short" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))} />
      </Labelled>
      <label className="check"><input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
        <span>I confirm this item is not covered by the MEL and has no effect on airworthiness (D-160).</span></label>
      <PinField id={`pin-${nadd.id}`} value={pin} onChange={setPin} />
      <Foot error={error} busy={busy} label="Sign and confirm" />
    </form>
  );
}

function RejectForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(reason.trim() ? null : 'Give a reason the reporter will see (D-209).',
      () => actions.rpc('reject_nadd', { p_nadd: nadd.id, p_reason: reason.trim() }),
      `${nadd.number} rejected. The reporter sees your reason.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`rej-${nadd.id}`} label="Reason (the reporter sees this)">
        <textarea id={`rej-${nadd.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Labelled>
      <Foot error={error} busy={busy} label="Reject" />
    </form>
  );
}

function ReclassifyForm({ nadd }: { nadd: Nadd }) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error: err } = await actions.rpc('reclassify_nadd_as_snag', { p_nadd: nadd.id, p_note: note.trim() });
    setBusy(false);
    if (err) return setError(errorText(err));
    navigate(`/snags/${data as string}`);
  }
  return (
    <form onSubmit={submit}>
      <p className="small muted">A snag is raised, already attended by you, and follows the full snag workflow. The NADD stays on record as reclassified.</p>
      <Labelled id={`rc-${nadd.id}`} label="Why it is not a NADD">
        <textarea id={`rc-${nadd.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Labelled>
      {error && <div className="error" role="alert">{error}</div>}
      <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Reclassify as snag'}</button></p>
    </form>
  );
}

function RectifyForm({ nadd, onDone }: { nadd: Nadd; onDone: (m: string) => void }) {
  const [text, setText] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [pin, setPin] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!text.trim() ? 'Describe the action taken.' : pinProblem(pin),
      () => perform('rectify_nadd', { p_nadd: nadd.id, p_action_taken: text.trim(), p_pin: pin,
        p_rect_tlb_book: book || undefined, p_rect_tlb_page: page || undefined }, { label: `Rectify ${nadd.number}`, aircraftId: nadd.aircraft_id }),
      `${nadd.number} rectified.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`at-${nadd.id}`} label="Action taken"><textarea id={`at-${nadd.id}`} value={text} onChange={(e) => setText(e.target.value)} /></Labelled>
      <div className="label dd-sub">Technical log reference (paper TLB)</div>
      <div className="row dd-form-row">
        <div><Labelled id={`rb-${nadd.id}`} label="TLB book no"><input id={`rb-${nadd.id}`} className="mono" placeholder="e.g. 14" value={book} onChange={(e) => setBook(e.target.value)} /></Labelled></div>
        <div><Labelled id={`rp-${nadd.id}`} label="TLB page no"><input id={`rp-${nadd.id}`} className="mono" placeholder="e.g. 0372" value={page} onChange={(e) => setPage(e.target.value)} /></Labelled></div>
      </div>
      <PinField id={`rpin-${nadd.id}`} value={pin} onChange={setPin} />
      <Foot error={error} busy={busy} label="Rectify and close" />
    </form>
  );
}

function ExtendForm({ nadd, onDone, onCancel }: { nadd: Nadd; onDone: (m: string) => void; onCancel: () => void }) {
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const { error, busy, run } = useAction(onDone);
  function submit(e: FormEvent) {
    e.preventDefault();
    run(!/^[0-9]+$/.test(days) || Number(days) < 1 ? 'Enter the extra days.' : reason.trim() ? null : 'Give the reason.',
      () => actions.rpc('request_nadd_extension', { p_nadd: nadd.id, p_extra_days: Number(days), p_reason: reason.trim() }),
      `Extension of ${days} days requested for ${nadd.number}; the limit is unchanged until approved.`);
  }
  return (
    <form onSubmit={submit}>
      <Labelled id={`xd-${nadd.id}`} label="Extra days"><input id={`xd-${nadd.id}`} className="mono dd-short" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} /></Labelled>
      <Labelled id={`xr-${nadd.id}`} label="Reason"><textarea id={`xr-${nadd.id}`} value={reason} onChange={(e) => setReason(e.target.value)} /></Labelled>
      <Foot error={error} busy={busy} label="Submit for approval" onCancel={onCancel} />
    </form>
  );
}
