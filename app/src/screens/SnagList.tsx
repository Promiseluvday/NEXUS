// Snags list (Engineering ▸ Snags & deferrals ▸ Snags).
// Shows the snags this user may see (the database filters: D-120, D-121).
// Default view: everything not closed, oldest waiting first, so nothing sits
// unnoticed. Filters are dropdowns (docs/ui-rules.md); the status chip on
// every row stays visible.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatDateTime, heldFor } from '../lib/format';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { SnagStateChip } from '../components/StatusChip';

type Row = {
  id: string; number: string; status: string; description: string; ata: string | null;
  created_at: string; aircraft_id: string; disposition: string | null;
  aircraft: { tail: string } | null;
  reporter: { three_letter_code: string } | null;
};

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  open:     { label: 'Not closed', statuses: ['reported', 'attended', 'in_work', 'deferred'] },
  waiting:  { label: 'Waiting for an engineer', statuses: ['reported', 'attended'] },
  in_work:  { label: 'In work', statuses: ['in_work'] },
  deferred: { label: 'Deferred', statuses: ['deferred'] },
  closed:   { label: 'Closed', statuses: ['closed'] },
  all:      { label: 'All', statuses: null },
};

export function SnagList() {
  const { display } = useAuth();
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'open';
  const tail = params.get('aircraft') ?? '';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let q = db.from('snag')
      .select('id, number, status, description, ata, created_at, aircraft_id, disposition, aircraft:aircraft_id (tail), reporter:reported_by (three_letter_code)')
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

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Engineering › Snags</div>
      <div className="page-head">
        <h1>Snags</h1>
        <div className="row filter-row">
          <select aria-label="Which snags" value={view} onChange={(e) => set('view', e.target.value)}>
            {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>Show: {v.label}</option>)}
          </select>
          <AircraftPicker aircraft={aircraft} value={tail} onChange={(id) => set('aircraft', id)} placeholder="All tails" />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!rows && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No snags match.</p>}
      {rows && rows.length > 0 && (
        <table className="board">
          <thead>
            <tr><th>Snag</th><th>Tail</th><th>State</th><th>Defect</th><th>Reported</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} tabIndex={0} onClick={() => navigate(`/snags/${r.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/snags/${r.id}`)}>
                <td className="mono">{r.number}</td>
                <td className="tail">{r.aircraft?.tail}</td>
                <td><SnagStateChip status={r.status} disposition={r.disposition} /></td>
                <td>
                  {r.description}
                  {r.ata && <div className="small muted">ATA {r.ata}</div>}
                </td>
                <td className="small">
                  {formatDateTime(r.created_at, display)} · <span className="mono">{r.reporter?.three_letter_code}</span>
                  {(r.status === 'reported' || r.status === 'attended') && <div className="muted">waiting {heldFor(r.created_at, now)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && rows.length > 0 && (
        <div className="cards">
          {rows.map((r) => (
            <button key={r.id} type="button" className="card tail-card" onClick={() => navigate(`/snags/${r.id}`)}>
              <div className="top">
                <span><span className="mono">{r.number}</span> · <span className="tail">{r.aircraft?.tail}</span></span>
                <SnagStateChip status={r.status} disposition={r.disposition} />
              </div>
              <div style={{ margin: '6px 0' }}>{r.description}</div>
              <div className="small muted">{formatDateTime(r.created_at, display)} · {r.reporter?.three_letter_code}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
