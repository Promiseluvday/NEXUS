// Request a work order (D-063, D-218), from ＋ New or the aircraft page.
//
// Every work order belongs to a snag, so the engineer picks the tail, then
// the snag:
//   attended snag   → rectify or troubleshoot now
//   deferred snag   → rectify a MEL / DDLS / NADD deferral; the deferral
//                     stays in force until the work order is certified
//   reported snag   → must be attended (assessed) first: link to it
// Snags that already have a work order in progress show it instead.
// Observations found during work with no snag yet: report the snag first
// (＋ New ▸ Report snag), then request the work order here.
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { db } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../lib/auth';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { SnagStateChip } from '../components/StatusChip';
import { WorkOrderForm } from './Disposition';

type Row = {
  id: string; number: string; description: string; status: string; disposition: string | null; created_at: string;
  work_order: { id: string; number: string; status: string }[];
};
const ACTIVE = ['requested', 'pre_approved', 'open', 'work_complete'];

export function RequestWorkOrder() {
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const { display } = useAuth();
  const [params, setParams] = useSearchParams();
  const tailId = params.get('aircraft') ?? '';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(params.get('snag'));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!tailId) return setRows(null);
    cached(`wo-request:${tailId}`, () => db.from('snag')
      .select('id, number, description, status, disposition, created_at, work_order (id, number, status)')
      .eq('aircraft_id', tailId).in('status', ['reported', 'attended', 'deferred'])
      .order('created_at', { ascending: false }))
      .then((r) => setRows((r.data ?? []) as unknown as Row[]));
  }, [tailId, message]);

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Request work order</div>
      <h1>Request work order</h1>
      <p className="muted">
        Any rectification, troubleshooting or "no fault found" needs a work order approved by Quality, then the CO
        (D-063, D-218). Choose the aircraft, then the snag.
      </p>
      {message && <div className="success" role="status">{message}</div>}

      <div className="card">
        <label htmlFor="wo-tail">Aircraft</label>
        <AircraftPicker id="wo-tail" aircraft={aircraft} value={tailId}
          onChange={(id) => { setChosen(null); setMessage(''); setParams(id ? { aircraft: id } : {}); }} />
      </div>

      {rows && (
        <div className="card">
          <h2>Snags on this aircraft</h2>
          {rows.length === 0 && (
            <p className="muted">No open snags. Found something during work? <Link to={`/report-snag?aircraft=${tailId}`}>Report the snag</Link> first.</p>
          )}
          <ul className="open-list">
            {rows.map((s) => {
              const active = s.work_order.find((w) => ACTIVE.includes(w.status));
              return (
                <li key={s.id} style={{ display: 'block' }}>
                  <div className="chip-row" style={{ marginTop: 0 }}>
                    <Link className="mono" to={`/snags/${s.id}`}>{s.number}</Link>
                    <SnagStateChip status={s.status} disposition={s.disposition} />
                    <span>{s.description}</span>
                    <span className="small muted">{formatDateTime(s.created_at, display)}</span>
                  </div>
                  <div style={{ margin: '6px 0' }}>
                    {active ? (
                      <span className="small">Work order <Link className="mono" to={`/work-orders/${active.id}`}>{active.number}</Link> already in progress.</span>
                    ) : s.status === 'reported' ? (
                      <span className="small">Not assessed yet. <Link to={`/snags/${s.id}`}>Attend it first</Link>.</span>
                    ) : chosen === s.id ? (
                      <WorkOrderForm snag={s} deferred={s.status === 'deferred'}
                        onDone={(m) => { setChosen(null); setMessage(m); }} />
                    ) : (
                      <button type="button" className="secondary" onClick={() => setChosen(s.id)}>
                        Request work order{s.status === 'deferred' ? ' to rectify' : ''}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
