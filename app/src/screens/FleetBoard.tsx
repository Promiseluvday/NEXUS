// Fleet board (D-006, D-046, D-120, D-200) and the single-aircraft summary.
//
// Everything shown comes from app.fleet_board() in the database, which only
// returns aircraft this user may see. The screen adds nothing of its own
// except counting rows for the tiles and "held for" times (subtraction of
// two recorded times). It never works out serviceability (D-020).
//
// Whole tiles and whole rows are clickable (D-098). The board refreshes every
// minute and with the Refresh button.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { actions, errorText } from '../lib/supabase';
import { formatDateTime, formatPlainDate, heldFor } from '../lib/format';
import { SnagChip, TailStatusChip } from '../components/StatusChip';

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

  const load = useCallback(async () => {
    const { data, error: err } = await actions.rpc('fleet_board');
    if (err) {
      setError(errorText(err));
      return;
    }
    setError('');
    setRows((data ?? []) as unknown as FleetRow[]);
    setLoadedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  return { rows, error, loadedAt, load };
}

// Tiles: each counts AIRCRAFT, and clicking one filters the board.
const TILES: { key: string; label: string; match: (r: FleetRow) => boolean }[] = [
  { key: 'all', label: 'All aircraft', match: () => true },
  { key: 'SVC', label: 'Serviceable', match: (r) => r.status === 'SVC' },
  { key: 'SVC_MEL', label: 'Serviceable · MEL', match: (r) => r.status === 'SVC_MEL' },
  { key: 'down', label: 'U/S or AOG', match: (r) => r.status === 'US' || r.status === 'AOG' },
  { key: 'IN_CHECK', label: 'In check', match: (r) => r.status === 'IN_CHECK' },
  { key: 'snag', label: 'Snag open or attended', match: (r) => r.snag_display !== null },
];

function Blocked({ row, now }: { row: FleetRow; now: Date }) {
  if (!row.blocked_by) return <span className="muted">—</span>;
  return (
    <div className="blocked">
      <div>{row.blocked_by}</div>
      <div className="small muted">
        <span className="mono">{row.blocked_ref}</span> · {row.blocked_holder} · held {heldFor(row.blocked_since, now)}
      </div>
    </div>
  );
}

export function FleetBoard() {
  const { display, me } = useAuth();
  const navigate = useNavigate();
  const { rows, error, loadedAt, load } = useFleetBoard();
  const [filter, setFilter] = useState('all');
  const now = loadedAt ?? new Date();

  const shown = useMemo(() => rows.filter(TILES.find((t) => t.key === filter)!.match), [rows, filter]);
  const open = (r: FleetRow) => navigate(`/aircraft/${r.aircraft_id}`);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>All aircraft</h1>
          <div className="small muted">
            {loadedAt ? `As at ${formatDateTime(loadedAt, display)}` : 'Loading…'}
          </div>
        </div>
        <div className="row" style={{ flex: '0 0 auto' }}>
          <button type="button" onClick={load}>Refresh</button>
          {me?.canReportSnags && <Link className="button" to="/report-snag">Report snag</Link>}
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="tiles">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tile${filter === t.key ? ' selected' : ''}`}
            aria-pressed={filter === t.key}
            onClick={() => setFilter(t.key)}
          >
            <span className="num">{rows.filter(t.match).length}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop and tablet: one row per aircraft */}
      <table className="board">
        <thead>
          <tr>
            <th>Tail</th>
            <th>Status (set by engineer)</th>
            <th>Snags</th>
            <th>DDLS</th>
            <th>NADD</th>
            <th>Blocked by</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.aircraft_id} onClick={() => open(r)} tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && open(r)}>
              <td>
                <div className="tail">{r.tail}</div>
                <div className="small muted">{r.aircraft_type}</div>
              </td>
              <td>
                <TailStatusChip status={r.status} />
                <div className="small muted">
                  {r.status_set_by && <>by <span className="mono">{r.status_set_by}</span> · {formatDateTime(r.status_set_at, display)}</>}
                </div>
                {r.expected_rts_on && (
                  <div className="small">Expected RTS {formatPlainDate(r.expected_rts_on, display)}</div>
                )}
              </td>
              <td>
                <SnagChip display={r.snag_display} />
                <div className="small muted">{r.open_snags} open</div>
              </td>
              <td>
                <span className="num">{r.open_ddls}</span>
                {r.next_ddls_due && <div className="small muted">next due {formatDateTime(r.next_ddls_due, display)}</div>}
              </td>
              <td>
                <span className="num">{r.open_nadds}</span>
                {r.next_nadd_due && <div className="small muted">next due {formatDateTime(r.next_nadd_due, display)}</div>}
              </td>
              <td><Blocked row={r} now={now} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone: one card per aircraft */}
      <div className="cards">
        {shown.map((r) => (
          <button key={r.aircraft_id} type="button" className="card tail-card" onClick={() => open(r)}>
            <div className="top">
              <span className="tail">{r.tail}</span>
              <TailStatusChip status={r.status} short />
            </div>
            <div className="small muted">
              {r.aircraft_type}
              {r.status_set_by && <> · by <span className="mono">{r.status_set_by}</span> {formatDateTime(r.status_set_at, display)}</>}
            </div>
            <p style={{ margin: '8px 0' }}>
              <SnagChip display={r.snag_display} />{' '}
              <span className="small">
                {r.open_snags} snags · {r.open_ddls} DDLS · {r.open_nadds} NADD
              </span>
            </p>
            <Blocked row={r} now={now} />
          </button>
        ))}
      </div>

      {rows.length > 0 && shown.length === 0 && <p className="muted">No aircraft match this tile.</p>}
      {loadedAt && rows.length === 0 && !error && (
        <p className="muted">No aircraft in your aircraft scope. A Super Admin grants aircraft access (D-121).</p>
      )}
    </div>
  );
}

// One aircraft's summary. The full aircraft dashboard (D-096) comes in a
// later slice; this shows the same facts as its fleet board row.
export function AircraftSummary() {
  const { id } = useParams();
  const { display, me } = useAuth();
  const { rows, error, loadedAt } = useFleetBoard();
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
        {me?.canReportSnags && (
          <Link className="button" to={`/report-snag?aircraft=${r.aircraft_id}`}>Report snag on {r.tail}</Link>
        )}
      </div>
      <div className="card">
        <p>
          <TailStatusChip status={r.status} /> <SnagChip display={r.snag_display} />
        </p>
        <p className="muted">
          {r.status_set_by
            ? <>Status set by <span className="mono">{r.status_set_by}</span> · {formatDateTime(r.status_set_at, display)}</>
            : 'No status recorded yet.'}
          {r.expected_rts_on && <> · Expected RTS {formatPlainDate(r.expected_rts_on, display)}</>}
        </p>
        <h2 style={{ fontSize: 16 }}>Blocked by</h2>
        <Blocked row={r} now={now} />
        <h2 style={{ fontSize: 16 }}>Open items</h2>
        <ul>
          <li>{r.open_snags} open snags</li>
          <li>{r.open_ddls} DDLS entries{r.next_ddls_due && <>, next due {formatDateTime(r.next_ddls_due, display)}</>}</li>
          <li>{r.open_nadds} NADDs{r.next_nadd_due && <>, next due {formatDateTime(r.next_nadd_due, display)}</>}</li>
        </ul>
        <p className="small muted">The full aircraft dashboard (snag list, history, calendar) comes in the next slice.</p>
      </div>
    </div>
  );
}
