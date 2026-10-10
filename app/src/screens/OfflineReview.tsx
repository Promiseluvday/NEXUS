// Offline signatures for Quality review (D-217 (f), S-7).
// Every offline signature the server received, accepted or refused, with
// who, which tablet, when it was signed (and how the time was known), when it
// arrived, and the gap between the two. Read-only. Laid out in the shared
// page frame (breadcrumb, Back, heading, a titled box).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { formatDateTime, heldFor } from '../lib/format';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';

type Row = {
  id: string; action: string; status: string; reason: string | null; signed_at: string | null; clock_kind: string | null;
  received_at: string; record_table: string | null; record_id: string | null;
  person: { three_letter_code: string } | null; device: { label: string } | null;
};

const ACTION: Record<string, string> = {
  apply_mel: 'MEL deferral', defer_on_ddls: 'DDLS deferral', defer_as_nadd: 'NADD deferral',
  close_snag_no_fault_found: 'No fault found', clear_ddls_entry: 'DDLS clearance', confirm_nadd: 'NADD confirmation',
  rectify_nadd: 'NADD rectification', certify_work_order: 'Work order certification', set_tail_status: 'Tail status',
};

export function OfflineReview() {
  const { display } = useAuth();
  const [view, setView] = useState('all');
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let q = db.from('offline_signature')
      .select('id, action, status, reason, signed_at, clock_kind, received_at, record_table, record_id, person:person_id (three_letter_code), device:device_id (label)')
      .order('received_at', { ascending: false }).limit(300);
    if (view !== 'all') q = q.eq('status', view);
    q.then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [view]);

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Quality' }, { label: 'Offline signatures' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="Offline signatures" sub="Signed on a tablet without a connection, checked by the server on arrival (D-217).">
        <div className="tq-inline-select">
          <label htmlFor="os-view">Show</label>
          <select id="os-view" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">All</option>
            <option value="rejected">Refused</option>
            <option value="accepted">Accepted</option>
          </select>
        </div>
      </PageHead>
      <Section title={rows ? `Signatures received (${rows.length}${rows.length === 300 ? ', latest 300' : ''})` : 'Signatures received'}>
        {rows === null && <p className="muted">Loading…</p>}
        {rows?.length === 0 && <p className="muted tq-empty">No offline signatures.</p>}
        {rows && rows.length > 0 && (
          <table className="board sq-table os-table">
            <thead><tr><th>Received</th><th>Who / tablet</th><th>What</th><th>Signed (clock)</th><th>Gap</th><th>Result</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Received" className="small">{formatDateTime(r.received_at, display)}</td>
                  <td data-label="Who / tablet" className="small"><span className="mono">{r.person?.three_letter_code}</span> · {r.device?.label ?? '—'}</td>
                  <td data-label="What">{ACTION[r.action] ?? r.action}
                    {r.record_table === 'snag' && r.record_id && <div className="small"><Link to={`/snags/${r.record_id}`}>open snag</Link></div>}
                    {r.record_table === 'work_order' && r.record_id && <div className="small"><Link to={`/work-orders/${r.record_id}`}>open work order</Link></div>}
                  </td>
                  <td data-label="Signed (clock)" className="small">{r.signed_at ? formatDateTime(r.signed_at, display) : '—'}
                    <div className="muted">{r.clock_kind === 'server+elapsed' ? 'server time + elapsed' : r.clock_kind === 'device+offset' ? 'clock estimate' : ''}</div></td>
                  <td data-label="Gap" className="small">{r.signed_at ? heldFor(r.signed_at, new Date(r.received_at)) : ''}</td>
                  <td data-label="Result" className="small">
                    <span className={`chip tone-${r.status === 'accepted' ? 'green' : 'red'}`}>{r.status === 'accepted' ? 'Accepted' : 'Refused'}</span>
                    {r.reason && <div>{r.reason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
