// All aircraft dashboard (D-006, D-046, D-120, D-200; layout from the Claude
// Design canvas, Main.dc.html) and the single-aircraft summary.
//
// Everything shown comes from app.fleet_board() in the database, which only
// returns aircraft this user may see. The screen adds nothing of its own
// except counting rows for the filter and "held for" times (subtraction of
// two recorded times). It never works out serviceability (D-020).
//
// Layout rules (docs/ui-rules.md): status and "Blocked by" are always on
// show, never inside a dropdown. The filter is a row of chips on desktop,
// one scrolling row on a phone. Whole cards are clickable (D-098).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, db, errorText } from '../lib/supabase';
import { formatDate, formatDateTime, formatPlainDate, formatTime, heldFor, type DisplaySettings } from '../lib/format';
import { NeedsAttention, dueText } from '../components/NeedsAttention';
import { usePendingApprovals } from './Approvals';
import { SnagChip, TAIL_STATUS, TailStatusChip } from '../components/StatusChip';
import { cached } from '../lib/offline/cache';
import { useOutbox } from '../lib/offline/hooks';
import { SetTailStatus } from '../components/SetTailStatus';

export type FleetRow = {
  aircraft_id: string;
  tail: string;
  aircraft_type: string;
  status: string | null;
  status_set_by: string | null;
  status_set_at: string | null;
  expected_rts_on: string | null;
  snag_display: string | null;
  open_snags: number;
  open_ddls: number;
  next_ddls_due: string | null;
  open_nadds: number;
  next_nadd_due: string | null;
  blocked_by: string | null;
  blocked_ref: string | null;
  blocked_holder: string | null;
  blocked_since: string | null;
};

function useFleetBoard() {
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const [fromCache, setFromCache] = useState(false);

  // Offline: the last saved board, "as at" the time it was saved (data
  // contract §5). Counts are never adjusted on the tablet.
  const load = useCallback(async () => {
    const r = await cached('fleet_board', () => actions.rpc('fleet_board'));
    if (r.error) {
      setError(errorText(r.error));
      return;
    }
    setError('');
    setRows((r.data ?? []) as unknown as FleetRow[]);
    setFromCache(r.fromCache);
    setLoadedAt(r.savedAt ? new Date(r.savedAt) : new Date());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  return { rows, error, loadedAt, load, fromCache };
}

// Tail statuses signed offline on this tablet and not yet accepted (Q-OS3).
function useProvisional(): Record<string, string> {
  const items = useOutbox();
  const out: Record<string, string> = {};
  items.filter((i) => i.status !== 'sent' && i.aircraftId).forEach((i) => {
    if (i.action === 'set_tail_status') out[i.aircraftId!] = String(i.args.p_status);
    else if (i.args.p_set_svc_mel) out[i.aircraftId!] = 'SVC_MEL';
  });
  return out;
}

// Filter chips (Main.dc.html): each counts AIRCRAFT.
const FILTERS: { key: string; label: string; match: (r: FleetRow) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'down', label: 'AOG / unserviceable', match: (r) => r.status === 'US' || r.status === 'AOG' },
  { key: 'snag', label: 'Snag open', match: (r) => r.snag_display !== null },
  { key: 'IN_CHECK', label: 'In check', match: (r) => r.status === 'IN_CHECK' },
  { key: 'mel', label: 'MEL open', match: (r) => r.status === 'SVC_MEL' || r.open_ddls > 0 },
  { key: 'svc', label: 'Serviceable', match: (r) => r.status === 'SVC' || r.status === 'SVC_MEL' },
];

function Blocked({ row, now, compact = false }: { row: FleetRow; now: Date; compact?: boolean }) {
  if (!row.blocked_by) return compact ? null : <span className="muted">—</span>;
  return (
    <div className="blocked">
      <div>{row.blocked_by}</div>
      <div className="small muted">
        <span className="mono">{row.blocked_ref}</span> · {row.blocked_holder} · held {heldFor(row.blocked_since, now)}
      </div>
    </div>
  );
}

// One "Open items" summary instead of three columns of zeros.
function OpenItems({ row, display, compact = false }: { row: FleetRow; display: DisplaySettings; compact?: boolean }) {
  const parts: ReactNode[] = [];
  if (row.open_snags) parts.push(<div key="s">{row.open_snags} snag{row.open_snags > 1 ? 's' : ''}</div>);
  if (row.open_ddls) parts.push(
    <div key="d">{row.open_ddls} DDLS <span className="small muted">· due {formatDateTime(row.next_ddls_due, display)}</span></div>,
  );
  if (row.open_nadds) parts.push(
    <div key="n">{row.open_nadds} NADD <span className="small muted">· due {formatDateTime(row.next_nadd_due, display)}</span></div>,
  );
  return (
    <>
      <SnagChip display={row.snag_display} />
      {parts.length ? parts : compact ? <span className="small muted">No open items</span> : <span className="muted">—</span>}
    </>
  );
}

function StatusCell({ row, display, short = false, provisional }: {
  row: FleetRow; display: DisplaySettings; short?: boolean; provisional?: string;
}) {
  return (
    <>
      <TailStatusChip status={row.status} short={short} />
      {provisional && (
        <div className="small"><span className="chip tone-amber provisional">→ {TAIL_STATUS[provisional]?.short ?? provisional} (provisional)</span></div>
      )}
      {row.status_set_by && (
        <div className="small muted">
          by <span className="mono">{row.status_set_by}</span> · {formatDateTime(row.status_set_at, display)}
        </div>
      )}
      {row.expected_rts_on && <div className="small">Expected RTS {formatPlainDate(row.expected_rts_on, display)}</div>}
    </>
  );
}

// The tail's open snags, loaded when the ▸ arrow is opened. Operations sees
// only the snags it reported (the database decides, D-120).
const SNAG_STATE: Record<string, string> = {
  reported: 'Snag open', attended: 'Snag attended', in_work: 'In work', deferred: 'Deferred',
};

function OpenSnags({ aircraftId, display }: { aircraftId: string; display: DisplaySettings }) {
  const [snags, setSnags] = useState<{ id: string; number: string; status: string; description: string; created_at: string }[] | null>(null);
  useEffect(() => {
    db.from('snag')
      .select('id, number, status, description, created_at')
      .eq('aircraft_id', aircraftId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSnags(data ?? []));
  }, [aircraftId]);
  if (!snags) return <span className="muted">Loading…</span>;
  if (!snags.length) return <span className="muted">No open snags you can see.</span>;
  return (
    <ul className="open-list">
      {snags.map((s) => (
        <li key={s.id}>
          <Link className="mono" to={`/snags/${s.id}`} onClick={(e) => e.stopPropagation()}>{s.number}</Link>
          <span className={`chip tone-${s.status === 'reported' ? 'blue' : s.status === 'attended' ? 'amber' : 'grey'}`}>
            {SNAG_STATE[s.status] ?? s.status}
          </span>
          <span>{s.description}</span>
          <span className="small muted">{formatDateTime(s.created_at, display)}</span>
        </li>
      ))}
    </ul>
  );
}

// One tail card (Main.dc.html). Shows only what was recorded: the status an
// engineer set, what holds the aircraft and since when, the next DDLS due
// time written at deferral, and counts. Nexus never decides serviceability
// (D-020); "No blocking items" just means nothing is holding the tail.
function TailCard({ r, now, display, provisional }: {
  r: FleetRow; now: Date; display: DisplaySettings; provisional?: string;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/aircraft/${r.aircraft_id}`);
  const snag = r.snag_display;
  const down = r.status === 'US' || r.status === 'AOG';
  const dueMs = r.next_ddls_due ? new Date(r.next_ddls_due).getTime() - now.getTime() : null;
  const note = r.next_ddls_due
    ? `${r.open_ddls} DDLS item${r.open_ddls > 1 ? 's' : ''} · next due ${formatDateTime(r.next_ddls_due, display)} (${dueText(r.next_ddls_due, now)})`
    : null;
  const clear = !r.blocked_by && !snag && !down && r.status !== 'IN_CHECK';
  const status = r.status ? TAIL_STATUS[r.status]?.long ?? r.status : 'no status';

  return (
    <article className="tcard" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}
      aria-label={`${r.tail}, ${snag ? 'snag open' : status}`}>
      <div className="tcard-top">
        <div>
          <div className="tcard-tail">{r.tail}</div>
          <div className="tcard-type">{r.aircraft_type}</div>
        </div>
        <div className="tcard-status">
          {snag ? <SnagChip display={snag} /> : <TailStatusChip status={r.status} />}
          {provisional && <span className="chip tone-amber provisional">→ {TAIL_STATUS[provisional]?.short ?? provisional} (provisional)</span>}
          {!snag && r.status_set_by && (
            <span className="tcard-setby">Set by <span className="mono">{r.status_set_by}</span> · {formatDateTime(r.status_set_at, display)}</span>
          )}
        </div>
      </div>

      {r.blocked_by && (
        <div className={`block${down ? ' down' : ''}`}>
          <div className="block-label">Blocked by</div>
          <div className="block-text">{r.blocked_by} <span className="mono">{r.blocked_ref}</span></div>
          <div className="block-meta">
            {r.blocked_holder && <span className="dept-tag">{r.blocked_holder}</span>}
            {r.blocked_since && <span>holding for {heldFor(r.blocked_since, now)}</span>}
          </div>
        </div>
      )}

      {snag && (
        <div className="tcard-line">
          Last status: <strong>{r.status ? TAIL_STATUS[r.status]?.short ?? r.status : 'none recorded'}</strong>
          {r.status_set_by && <> · set by <span className="mono">{r.status_set_by}</span> · <span className="mono">{formatDateTime(r.status_set_at, display)}</span></>}
        </div>
      )}

      {r.expected_rts_on && (
        <div className="tcard-line">Expected return to service: <strong>{formatPlainDate(r.expected_rts_on, display)}</strong></div>
      )}

      {note && <div className={`note${dueMs !== null && dueMs < 2 * 86_400_000 ? ' warn' : ''}`}>{note}</div>}

      {clear && !note && <div className="clear-line">No blocking items</div>}

      <div className="stats">
        <div title="Flight hours arrive with flight records (later phase)"><div className="k">Hours</div><div className="v none">—</div></div>
        <div title="Cycles arrive with flight records (later phase)"><div className="k">Cycles</div><div className="v none">—</div></div>
        <div><div className="k">Snags</div><div className="v">{r.open_snags}</div></div>
        <div><div className="k">DDLS</div><div className="v">{r.open_ddls}</div></div>
        <div><div className="k">NADD</div><div className="v">{r.open_nadds}</div></div>
      </div>
      <Link to={`/aircraft/${r.aircraft_id}`} className="open-link" onClick={(e) => e.stopPropagation()}>Open aircraft →</Link>
    </article>
  );
}

// The All aircraft dashboard (Main.dc.html): heading, filter chips, a card
// per tail and the Needs attention panel.
export function FleetBoard() {
  const { display } = useAuth();
  const { rows, error, loadedAt, load, fromCache } = useFleetBoard();
  const provisional = useProvisional();
  const { items: pending } = usePendingApprovals();
  const [filter, setFilter] = useState('all');
  const now = loadedAt ?? new Date();

  const shown = useMemo(() => rows.filter(FILTERS.find((t) => t.key === filter)!.match), [rows, filter]);
  const count = (key: string) => rows.filter(FILTERS.find((t) => t.key === key)!.match).length;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: display.timeZone }).format(now);

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1>All aircraft</h1>
          <p className="dash-sub">
            {weekday} {formatDate(now, display)} · {rows.length} aircraft ·{' '}
            <button type="button" className="link-button" onClick={load} title="Refresh now">
              {loadedAt ? `updated ${formatTime(loadedAt, display)}` : 'loading…'} ↻
            </button>
          </p>
        </div>
        <button type="button" className="outline-button" onClick={() => window.print()}>Print serviceability state</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {fromCache && loadedAt && (
        <div className="offline-banner" role="status">
          Offline · showing data as at {formatDateTime(loadedAt, display)}. Held times are as at that moment.
        </div>
      )}

      <div className="chips-row" role="group" aria-label="Filter fleet">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className="fchip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      <div className="dash-body">
        <section className="tail-grid" aria-label="Aircraft">
          {shown.map((r) => (
            <TailCard key={r.aircraft_id} r={r} now={now} display={display} provisional={provisional[r.aircraft_id]} />
          ))}
          {rows.length > 0 && shown.length === 0 && <p className="muted">No aircraft match this filter.</p>}
          {loadedAt && rows.length === 0 && !error && (
            <p className="muted">No aircraft in your aircraft scope. A Super Admin grants aircraft access (D-121).</p>
          )}
        </section>
        <NeedsAttention rows={rows} now={now} approvals={pending?.length ?? 0} display={display} />
      </div>
    </div>
  );
}

// One aircraft's summary. The full aircraft dashboard (D-096) comes in a
// later slice; this shows the same facts as its fleet board row plus its
// open snags. "Report snag" for this tail is in the ＋ New menu, tail filled in.
export function AircraftSummary() {
  const { id } = useParams();
  const { display, me } = useAuth();
  const { rows, error, loadedAt, load } = useFleetBoard();
  const isEngineer = Boolean(me?.departments.some((d) => d.code === 'ENG'));
  const r = rows.find((x) => x.aircraft_id === id);
  const now = loadedAt ?? new Date();

  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!loadedAt) return <div className="page muted">Loading…</div>;
  if (!r) return <div className="page"><p>This aircraft is not in your aircraft scope.</p></div>;

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">All aircraft</Link> › <span className="mono">{r.tail}</span></div>
      <div className="page-head">
        <div>
          <h1 className="tail">{r.tail}</h1>
          <div className="muted">{r.aircraft_type}</div>
        </div>
      </div>
      <div className="card">
        <div className="summary-grid">
          <section>
            <h2>Status</h2>
            <StatusCell row={r} display={display} />
          </section>
          <section>
            <h2>Blocked by</h2>
            <Blocked row={r} now={now} />
          </section>
          <section>
            <h2>Open items</h2>
            <OpenItems row={r} display={display} />
          </section>
        </div>
        <h2>Open snags</h2>
        <OpenSnags aircraftId={r.aircraft_id} display={display} />
        {isEngineer && (
          <>
            <h2>Tail status</h2>
            <SetTailStatus aircraftId={r.aircraft_id} tail={r.tail} current={r.status} onDone={load} />
          </>
        )}
        <p className="small muted">The full aircraft dashboard (history, DDLS and NADD detail, calendar) comes in the next slice.</p>
      </div>
    </div>
  );
}
