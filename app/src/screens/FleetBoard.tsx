// All aircraft dashboard (D-006, D-046, D-120, D-200; layout from the Claude
// Design canvas, Main.dc.html) (the one-aircraft page is AircraftPage.tsx).
//
// Everything shown comes from app.fleet_board() in the database, which only
// returns aircraft this user may see. The screen adds nothing of its own
// except counting rows for the filter and "held for" times (subtraction of
// two recorded times). It never works out serviceability (D-020).
//
// Layout rules (docs/ui-rules.md): status and "Blocked by" are always on
// show, never inside a dropdown. The filter is a row of chips on desktop,
// one scrolling row on a phone. Whole cards are clickable (D-098).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, errorText } from '../lib/supabase';
import { formatDate, formatDateTime, formatPlainDate, formatTime, heldFor, type DisplaySettings } from '../lib/format';
import { NeedsAttention, dueText } from '../components/NeedsAttention';
import { usePendingApprovals } from './Approvals';
import { SnagChip, TAIL_STATUS, TailStatusChip } from '../components/StatusChip';
import { cached } from '../lib/offline/cache';
import { useOutbox } from '../lib/offline/hooks';

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

export function useFleetBoard() {
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
        <Link className="button outline-button" to="/print/serviceability" target="_blank" rel="noopener">Print serviceability state</Link>
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
