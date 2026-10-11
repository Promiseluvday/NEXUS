// Snags list (Engineering ▸ Snags & deferrals ▸ Snags), laid out as the
// Claude Design wireframe WF-D1.
// Shows the snags this user may see (the database filters: D-120, D-121).
// Default view: everything not closed, oldest waiting first, so nothing sits
// unnoticed. Filters are dropdowns (docs/ui-rules.md); the status chip on
// every row stays visible (D-094).
//
// Opened from a tail (?aircraft=…) the page carries that tail's header and
// section tabs, like every page under a tail (D-098). Opened from the rail it
// lists all tails in your scope, with a tail column.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatDateTime, heldFor, type DisplaySettings } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { SnagStateChip } from '../components/StatusChip';
import { BackButton, Crumbs, PageHead, TailHeader, TailTabs } from '../components/PageFrame';
import { useFleetBoard } from './FleetBoard';

type Who = { three_letter_code: string } | null;
type Row = {
  id: string; number: string; status: string; description: string; ata: string | null;
  created_at: string; aircraft_id: string; disposition: string | null; reporter_kind: string | null;
  attended_at: string | null; dispositioned_at: string | null; closed_at: string | null;
  aircraft: { tail: string } | null;
  reporter: Who; attender: Who; dispositioner: Who; closer: Who;
};

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  open:     { label: 'Not closed', statuses: ['reported', 'attended', 'in_work', 'deferred'] },
  waiting:  { label: 'Waiting for an engineer', statuses: ['reported', 'attended'] },
  in_work:  { label: 'In work', statuses: ['in_work'] },
  deferred: { label: 'Deferred', statuses: ['deferred'] },
  closed:   { label: 'Closed', statuses: ['closed'] },
  all:      { label: 'All', statuses: null },
};

const tlc = (w: Who | undefined) => w?.three_letter_code ?? '—';

// "Who and when" (WF-D1): the latest recorded step on the snag, by whom.
// Older saved copies on a tablet may lack the later fields; fall back to the
// report itself.
function lastStep(r: Row, display: DisplaySettings) {
  if (r.closed_at) return <>Closed by <span className="mono">{tlc(r.closer)}</span> · {formatDateTime(r.closed_at, display)}</>;
  if (r.dispositioned_at) return <>Dispositioned by <span className="mono">{tlc(r.dispositioner)}</span> · {formatDateTime(r.dispositioned_at, display)}</>;
  if (r.attended_at) return <>Attended by <span className="mono">{tlc(r.attender)}</span> · {formatDateTime(r.attended_at, display)}</>;
  return <>Reported by <span className="mono">{tlc(r.reporter)}</span> · {formatDateTime(r.created_at, display)}</>;
}

export function SnagList() {
  const { display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const { rows: fleet } = useFleetBoard();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'open';
  const tail = params.get('aircraft') ?? '';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let q = db.from('snag')
      .select(`id, number, status, description, ata, created_at, aircraft_id, disposition, reporter_kind,
               attended_at, dispositioned_at, closed_at,
               aircraft:aircraft_id (tail),
               reporter:reported_by (three_letter_code), attender:attended_by (three_letter_code),
               dispositioner:dispositioned_by (three_letter_code), closer:closed_by (three_letter_code)`)
      .order('created_at', { ascending: view !== 'closed' && view !== 'all' })
      .limit(200);
    const statuses = VIEWS[view]?.statuses;
    if (statuses) q = q.in('status', statuses);
    if (tail) q = q.eq('aircraft_id', tail);
    cached(`snags:${view}:${tail}`, () => q).then(({ data, error: err }) => {
      if (err) setError(errorText(err));
      setRows((data ?? []) as unknown as Row[]);
    });
  }, [view, tail]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const now = useMemo(() => new Date(), [rows]);

  // The tail in view, if the list was opened from one.
  const row = tail ? fleet.find((r) => r.aircraft_id === tail) : undefined;
  const tailName = row?.tail ?? aircraft.find((a) => a.id === tail)?.tail ?? '';
  const reportLink = tail ? `/report-snag?aircraft=${tail}` : '/report-snag';

  return (
    <div className="page snag-page">
      <Crumbs items={tail
        ? [{ label: 'All aircraft', to: '/' }, { label: <span className="mono">{tailName}</span>, to: `/aircraft/${tail}` }, { label: 'Snag list' }]
        : [{ label: 'All aircraft', to: '/' }, { label: 'Snag list' }]} />
      {tail ? <BackButton to={`/aircraft/${tail}`} label={tailName || 'the aircraft'} /> : <BackButton to="/" label="All aircraft" />}
      {row && <TailHeader row={row} />}
      {tail && <TailTabs aircraftId={tail} />}

      <PageHead title="Snags" sub={tail ? undefined : 'All tails in your scope'}>
        {/* Choosing columns is in the wireframe but not built yet. */}
        <button type="button" className="outline-button" disabled title="Not built yet">
          Columns <span className="rail-tag">Soon</span>
        </button>
        <Link className="button" to={reportLink}>Report snag</Link>
      </PageHead>

      {/* Filters are dropdowns (docs/ui-rules.md). */}
      <div className="snag-filters">
        <select aria-label="Which snags" value={view} onChange={(e) => set('view', e.target.value)}>
          {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>Show: {v.label}</option>)}
        </select>
        {!tail && <AircraftPicker aircraft={aircraft} value={tail} onChange={(id) => set('aircraft', id)} placeholder="All tails" />}
      </div>

      {error && <div className="error">{error}</div>}
      {!rows && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <div className="box"><div className="box-body muted">No snags match.</div></div>}

      {/* Desktop and tablet: a table. Tap anywhere on a row to open it (D-098). */}
      {rows && rows.length > 0 && (
        <div className="box snag-table">
          <div className="table-scroll">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Snag</th>
                  {!tail && <th>Tail</th>}
                  <th>Reported by</th>
                  <th>Description</th>
                  <th>State</th>
                  <th>Who and when</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="click-row" onClick={() => navigate(`/snags/${r.id}`)}>
                    <td><Link className="mono strong-link" to={`/snags/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.number}</Link></td>
                    {!tail && <td className="mono">{r.aircraft?.tail}</td>}
                    <td>
                      <span className="mono">{tlc(r.reporter)}</span>
                      {r.reporter_kind && <div className="small muted">{r.reporter_kind}</div>}
                    </td>
                    <td>
                      {r.description}
                      {r.ata && <div className="small muted">ATA <span className="mono">{r.ata}</span></div>}
                    </td>
                    <td><SnagStateChip status={r.status} disposition={r.disposition} /></td>
                    <td className="small">
                      {lastStep(r, display)}
                      {(r.status === 'reported' || r.status === 'attended') && <div className="muted">waiting {heldFor(r.created_at, now)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phones: one card per snag, state chip always visible. */}
      {rows && rows.length > 0 && (
        <div className="snag-cards">
          {rows.map((r) => (
            <Link key={r.id} className="snag-card" to={`/snags/${r.id}`}>
              <div className="snag-card-top">
                <span><span className="mono">{r.number}</span>{!tail && <> · <span className="mono">{r.aircraft?.tail}</span></>}</span>
                <SnagStateChip status={r.status} disposition={r.disposition} />
              </div>
              <div className="snag-card-text">{r.description}</div>
              <div className="small muted">{lastStep(r, display)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
