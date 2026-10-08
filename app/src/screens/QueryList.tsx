// "My queries": every technical query you are involved in (you raised it,
// it is assigned to your department, or you have oversight), with a link to
// the record it is about (D-207). Raise a new query from the record itself,
// so the query is always attached to something.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { db } from '../lib/supabase';
import { QUERY_SELECT, QueryThread, type QueryRow } from '../components/Queries';

const RECORD_PATH: Record<string, string> = { snag: '/snags/', work_order: '/work-orders/' };
const RECORD_NAME: Record<string, string> = { snag: 'snag', work_order: 'work order', nadd: 'NADD', ddls_entry: 'DDLS entry' };

export function QueryList() {
  const [view, setView] = useState('open');
  const [rows, setRows] = useState<QueryRow[] | null>(null);
  const load = useCallback(async () => {
    let q = db.from('technical_query').select(QUERY_SELECT).order('urgent', { ascending: false }).order('created_at');
    if (view !== 'all') q = q.eq('status', view);
    const { data } = await q;
    setRows((data ?? []) as unknown as QueryRow[]);
  }, [view]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Technical queries</div>
      <div className="page-head">
        <div>
          <h1>Technical queries</h1>
          <div className="small muted">To raise one, open the snag or work order it is about and use “Raise a query”.</div>
        </div>
        <select aria-label="Which queries" value={view} onChange={(e) => setView(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="open">Show: Open</option>
          <option value="closed">Show: Closed</option>
          <option value="all">Show: All</option>
        </select>
      </div>
      {rows?.length === 0 && <div className="card"><p className="muted">No queries.</p></div>}
      {rows && rows.length > 0 && (
        <section className="card">
          {rows.map((q) => (
            <QueryThread key={q.id} q={q} onChange={load} showRecordLink={
              <p className="small">About a {RECORD_NAME[q.record_table] ?? q.record_table}
                {RECORD_PATH[q.record_table] && <> · <Link to={`${RECORD_PATH[q.record_table]}${q.record_id}`}>open it</Link></>}
              </p>
            } />
          ))}
        </section>
      )}
    </div>
  );
}
