// Request a work order (D-063, D-218), from ＋ New, the aircraft page, the
// work order list or the snag page. Laid out as the Claude Design wireframe
// WF-WO1: tail → the snag it is raised from → scope and estimated man-hours.
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
//
// The number is given by the server on submission, in one fleet-wide
// sequence (D-064). No signature yet: it goes to Quality, then the CO.
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { db } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../lib/auth';
import { AircraftPicker, type AircraftOption } from '../components/AircraftPicker';
import { SnagStateChip } from '../components/StatusChip';
import { BackButton, Crumbs, PageHead, Section, type Crumb } from '../components/PageFrame';
import { WorkOrderForm } from './Disposition';

type Row = {
  id: string; number: string; description: string; status: string; disposition: string | null; created_at: string;
  work_order: { id: string; number: string; status: string }[];
};
const ACTIVE = ['requested', 'pre_approved', 'open', 'work_complete'];

export function RequestWorkOrder() {
  const { aircraft } = useOutletContext<{ aircraft: AircraftOption[] }>();
  const { display, me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tailId = params.get('aircraft') ?? '';
  const fromSnag = params.get('snag');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(fromSnag);
  const [message, setMessage] = useState('');
  const tail = aircraft.find((a) => a.id === tailId)?.tail ?? '';

  useEffect(() => {
    if (!tailId) return setRows(null);
    cached(`wo-request:${tailId}`, () => db.from('snag')
      .select('id, number, description, status, disposition, created_at, work_order (id, number, status)')
      .eq('aircraft_id', tailId).in('status', ['reported', 'attended', 'deferred'])
      .order('created_at', { ascending: false }))
      .then((r) => setRows((r.data ?? []) as unknown as Row[]));
  }, [tailId, message]);

  // Only an assessed snag with no work order in progress can be chosen.
  const snag = rows?.find((s) => s.id === chosen
    && s.status !== 'reported' && !s.work_order.some((w) => ACTIVE.includes(w.status))) ?? null;
  const crumbs: Crumb[] = [
    { label: 'All aircraft', to: '/' },
    ...(tailId ? [{ label: <span className="mono">{tail || '…'}</span>, to: `/aircraft/${tailId}` }] : []),
    { label: 'Work order request' },
  ];

  return (
    <div className="page wo-page">
      <Crumbs items={crumbs} />
      {fromSnag
        ? <BackButton to={`/snags/${fromSnag}`} label="snag" />
        : tailId ? <BackButton to={`/aircraft/${tailId}`} label={`${tail || 'aircraft'} overview`} />
        : <BackButton to="/" label="All aircraft" />}
      <PageHead title={<>Work order request{tail && <> · <span className="mono">{tail}</span></>}</>}
        sub="Raised from an assessed snag. Any rectification, troubleshooting or no fault found needs Quality, then the CO, to approve (D-063, D-218)." />
      {message && <div className="success" role="status">{message} <Link to={`/work-orders?aircraft=${tailId}`}>Work orders for {tail}</Link></div>}

      <Section title="1 · Aircraft">
        <label htmlFor="wo-tail" className="visually-hidden">Aircraft</label>
        <AircraftPicker id="wo-tail" aircraft={aircraft} value={tailId}
          onChange={(id) => { setChosen(null); setMessage(''); setParams(id ? { aircraft: id } : {}); }} />
      </Section>

      {rows && (
        <Section title="2 · Raised from">
          {rows.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              No open snags. Found something during work? <Link to={`/report-snag?aircraft=${tailId}`}>Report the snag</Link> first.
            </p>
          )}
          {rows.length > 0 && (
            <ul className="wo-pick" role="list">
              {rows.map((s) => {
                const active = s.work_order.find((w) => ACTIVE.includes(w.status));
                const pickable = !active && s.status !== 'reported';
                return (
                  <li key={s.id} className={pickable && chosen === s.id ? 'chosen' : undefined}>
                    <div className="wo-pick-top">
                      <Link className="mono" to={`/snags/${s.id}`}>{s.number}</Link>
                      <SnagStateChip status={s.status} disposition={s.disposition} />
                      <span className="small muted">{formatDateTime(s.created_at, display)}</span>
                    </div>
                    <div>{s.description}</div>
                    <div className="wo-pick-action">
                      {active ? (
                        <span className="small">Work order <Link className="mono" to={`/work-orders/${active.id}`}>{active.number}</Link> already in progress.</span>
                      ) : s.status === 'reported' ? (
                        <span className="small">Not assessed yet. <Link to={`/snags/${s.id}`}>Attend it first</Link>.</span>
                      ) : pickable && chosen !== s.id ? (
                        <button type="button" className="outline-button" onClick={() => { setMessage(''); setChosen(s.id); }}>
                          Raise from this snag{s.status === 'deferred' ? ' (rectify the deferral)' : ''}
                        </button>
                      ) : <span className="small"><strong>Chosen</strong> · fill in the request below.</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {snag && (
        <Section title="3 · Request" tone="strong">
          <dl className="facts">
            <dt>Raised from</dt>
            <dd><span className="mono">{snag.number}</span> · {snag.description} <SnagStateChip status={snag.status} disposition={snag.disposition} /></dd>
            <dt>Work order number</dt><dd className="muted">Assigned on submission (D-064)</dd>
            <dt>Requested by</dt><dd><span className="mono">{me?.tlc}</span> {me?.fullName && <span className="muted">· {me.fullName} (from sign-in)</span>}</dd>
          </dl>
          {snag.status === 'deferred' && (
            <p className="panel-note">The deferral stays in force until this work order is certified; certifying clears its DDLS entry or NADD (D-218).</p>
          )}
          <WorkOrderForm key={snag.id} snag={snag} deferred={snag.status === 'deferred'}
            onDone={(m) => { setChosen(null); setMessage(m); }} />
          <div className="action-row">
            <button type="button" className="outline-button" onClick={() => setChosen(null)}>Cancel</button>
          </div>
          <h3 className="sub-head">Parts <span className="rail-tag">Soon</span></h3>
          <p className="panel-note">Reserving parts before approval (D-068) comes with stores in Phase 2.</p>
        </Section>
      )}
    </div>
  );
}
