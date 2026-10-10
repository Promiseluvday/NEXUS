// One aircraft's overview, laid out as the Claude Design canvas
// (Home.dc.html, WF-B2, D-096): breadcrumb and back button, a row of count
// tiles, then panels that open and close (Expand all / Collapse all, or tap a panel's bar):
//   Aircraft record   tail, type, MSN, the status an engineer set, Set tail
//                     status for engineers (PIN, D-215), and Totals and
//                     Engines and APU (shown as "not recorded yet" until
//                     flight and component records exist)
//   ADs and SBs       not recorded yet
//   Open items        Blocked by, then open snags, DDLS, NADDs, work orders
//   Due items         the due times written at deferral, flagged
//                     "Approaching" / "Reached" against an operator margin
//   Recent activity   status changes, snags, deferrals, newest first
//   Calendar          next 4 weeks: DDLS and NADD due times, expected RTS
// Nexus records; engineers decide. Nothing here is projected or calculated
// beyond "recorded time minus now" (D-020, D-021).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { formatDate, formatDateTime, formatPlainDate, heldFor, type DisplaySettings } from '../lib/format';
import { SnagStateChip, TailStatusChip } from '../components/StatusChip';
import { SetTailStatus } from '../components/SetTailStatus';
import { dueText } from '../components/NeedsAttention';
import { useApproachingDays } from '../lib/settings';
import { useFleetBoard } from './FleetBoard';
import { WorkOrderChip } from './WorkOrders';

type Who = { three_letter_code: string } | null;
type Snag = { id: string; number: string; description: string; status: string; disposition: string | null; created_at: string; reporter: Who };
type Ddls = {
  id: string; page_no: number; entry_no: number; kind: string; mel_ref: string | null; mel_category: string | null;
  defect_text: string; due_at: string | null; deferred_at: string; deferrer: Who;
};
type Nadd = { id: string; number: string; description: string; status: string; due_at: string | null; reported_at: string; reporter: Who };
type WorkOrder = { id: string; number: string; scope: string; status: string; created_at: string };
type StatusEvent = { id: string; status: string; reason: string | null; set_at: string; setter: Who };
type Aircraft = { msn: string | null; registration_effective_on: string | null };

const DAY = 86_400_000;
const tlc = (w: Who) => w?.three_letter_code ?? '—';

// Loads everything about one tail; each list is saved for offline use.
function useAircraftDetail(id: string) {
  const [d, setD] = useState<{
    aircraft: Aircraft | null; snags: Snag[]; ddls: Ddls[]; nadds: Nadd[]; wos: WorkOrder[];
    events: StatusEvent[]; recentSnags: Snag[];
  } | null>(null);
  const load = useCallback(async () => {
    const [a, s, dd, n, w, e, rs] = await Promise.all([
      cached(`ac:${id}`, () => db.from('aircraft').select('msn, registration_effective_on').eq('id', id).maybeSingle()),
      cached(`ac-snags:${id}`, () => db.from('snag')
        .select('id, number, description, status, disposition, created_at, reporter:reported_by (three_letter_code)')
        .eq('aircraft_id', id).neq('status', 'closed').order('created_at', { ascending: false })),
      cached(`ac-ddls:${id}`, () => db.from('ddls_entry')
        .select('id, page_no, entry_no, kind, mel_ref, mel_category, defect_text, due_at, deferred_at, deferrer:deferred_by (three_letter_code)')
        .eq('aircraft_id', id).eq('status', 'open').order('due_at', { nullsFirst: false })),
      cached(`ac-nadds:${id}`, () => db.from('nadd')
        .select('id, number, description, status, due_at, reported_at, reporter:reported_by (three_letter_code)')
        .eq('aircraft_id', id).in('status', ['proposed', 'open']).order('due_at', { nullsFirst: false })),
      cached(`ac-wos:${id}`, () => db.from('work_order')
        .select('id, number, scope, status, created_at')
        .eq('aircraft_id', id).not('status', 'in', '(certified,rejected,cancelled)').order('created_at', { ascending: false })),
      cached(`ac-events:${id}`, () => db.from('tail_status_event')
        .select('id, status, reason, set_at, setter:set_by (three_letter_code)')
        .eq('aircraft_id', id).order('set_at', { ascending: false }).limit(8)),
      cached(`ac-recent:${id}`, () => db.from('snag')
        .select('id, number, description, status, disposition, created_at, reporter:reported_by (three_letter_code)')
        .eq('aircraft_id', id).order('created_at', { ascending: false }).limit(8)),
    ]);
    setD({
      aircraft: (a.data ?? null) as Aircraft | null,
      snags: (s.data ?? []) as unknown as Snag[],
      ddls: (dd.data ?? []) as unknown as Ddls[],
      nadds: (n.data ?? []) as unknown as Nadd[],
      wos: (w.data ?? []) as unknown as WorkOrder[],
      events: (e.data ?? []) as unknown as StatusEvent[],
      recentSnags: (rs.data ?? []) as unknown as Snag[],
    });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  return { d, load };
}

// A panel opens and closes from anywhere on its bar, not only the button.
function Panel({ id, title, link, open, onToggle, children }: {
  id: string; title: string; link?: { to: string; label: string; soon?: boolean };
  open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className="panel" aria-labelledby={`p-${id}`} id={`panel-${id}`}>
      <div className="panel-head" onClick={onToggle}>
        <h2 id={`p-${id}`}>{title}</h2>
        {link && (link.soon
          ? <span className="panel-link soon">{link.label} <span className="rail-tag">Soon</span></span>
          : <Link className="panel-link" to={link.to} onClick={(e) => e.stopPropagation()}>{link.label}</Link>)}
        <button type="button" className="outline-button panel-toggle" aria-expanded={open} aria-controls={`b-${id}`}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && <div id={`b-${id}`} className="panel-body">{children}</div>}
    </section>
  );
}

function Tile({ n, label, to, tone }: { n: ReactNode; label: string; to?: string; tone?: 'warn' | 'none' }) {
  const body = <><span className={`tile-n${tone ? ` ${tone}` : ''}`}>{n}</span><span className="tile-l">{label}</span></>;
  return to ? <Link className="tile" to={to}>{body}</Link> : <div className="tile tile-off" title="Not recorded in Nexus yet">{body}</div>;
}

// Four weeks starting on a Monday, with recorded due times on their days.
function Calendar({ events, display }: { events: { at: string; text: string; to: string; kind: string }[]; display: DisplaySettings }) {
  const [offset, setOffset] = useState(0);
  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 28);
    return d;
  }, [offset]);
  const days = Array.from({ length: 28 }, (_, i) => new Date(start.getTime() + i * DAY));
  const key = (d: Date | string) => formatDate(d, display);
  const today = key(new Date());
  return (
    <>
      <div className="cal-head">
        <span>{formatDate(days[0], display)} – {formatDate(days[27], display)}</span>
        <div className="row" style={{ flex: '0 0 auto' }}>
          <button type="button" className="outline-button" aria-label="Previous 4 weeks" onClick={() => setOffset((o) => o - 1)}>Previous</button>
          <button type="button" className="outline-button" aria-label="Next 4 weeks" onClick={() => setOffset((o) => o + 1)}>Next</button>
        </div>
      </div>
      <div className="cal-scroll">
        <div className="cal-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => (
            <div key={d.toISOString()} className={`cal-day${key(d) === today ? ' today' : ''}`}>
              <div className="cal-date">{key(d).slice(0, 6)}</div>
              {events.filter((e) => key(e.at) === key(d)).map((e, i) => (
                <Link key={i} to={e.to} className={`cal-ev ev-${e.kind}`}>{e.text}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="panel-note">
        <span className="cal-ev ev-ddls">DDLS</span> and <span className="cal-ev ev-nadd">NADD</span> due times were written at deferral.{' '}
        <span className="cal-ev ev-rts">RTS</span> is the expected return to service the engineer entered. Check packages join in Phase 2.
      </p>
    </>
  );
}

const PANELS = ['record', 'open', 'adsb', 'due', 'activity', 'calendar'] as const;
type PanelId = (typeof PANELS)[number];

export function AircraftPage() {
  const { id = '' } = useParams();
  const { display, me } = useAuth();
  const { rows, error, loadedAt, load: loadBoard } = useFleetBoard();
  const { d, load } = useAircraftDetail(id);
  const margin = useApproachingDays();
  const [open, setOpen] = useState<Record<PanelId, boolean>>(
    { record: true, open: true, adsb: false, due: true, activity: true, calendar: true });
  const toggle = (p: PanelId) => setOpen((o) => ({ ...o, [p]: !o[p] }));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(PANELS.map((p) => [p, v])) as Record<PanelId, boolean>);
  const isEngineer = Boolean(me?.departments.some((x) => x.code === 'ENG'));
  const r = rows.find((x) => x.aircraft_id === id);
  const now = loadedAt ?? new Date();

  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!loadedAt) return <div className="page muted">Loading…</div>;
  if (!r) return <div className="page"><p>This aircraft is not in your aircraft scope.</p></div>;

  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: display.timeZone }).format(now);
  const down = r.status === 'US' || r.status === 'AOG';
  const mel = d?.ddls.filter((x) => x.kind === 'mel').length ?? 0;
  const flag = (due: string | null) => {
    if (!due) return null;
    const ms = new Date(due).getTime() - now.getTime();
    if (ms <= 0) return <span className="chip tone-red">Reached</span>;
    if (ms <= margin * DAY) return <span className="chip tone-amber">Approaching</span>;
    return null;
  };

  // Due items: the DDLS and NADD due times as recorded.
  const due = [
    ...(d?.ddls ?? []).map((x) => ({
      key: x.id, to: `/ddls?aircraft=${id}`, due: x.due_at,
      item: `DDLS ${x.page_no}/${x.entry_no} · ${x.kind === 'mel' ? `MEL ${x.mel_ref ?? ''}${x.mel_category ? ` Cat ${x.mel_category}` : ''}` : x.defect_text}`,
      by: `${tlc(x.deferrer)} · ${formatDateTime(x.deferred_at, display)}`,
    })),
    ...(d?.nadds ?? []).filter((x) => x.due_at).map((x) => ({
      key: x.id, to: `/nadds?aircraft=${id}`, due: x.due_at,
      item: `${x.number} · ${x.description}`, by: `${tlc(x.reporter)} · ${formatDateTime(x.reported_at, display)}`,
    })),
  ].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));

  const calendar = [
    ...(d?.ddls ?? []).filter((x) => x.due_at).map((x) => ({ at: x.due_at!, text: `DDLS ${x.page_no}/${x.entry_no}`, to: `/ddls?aircraft=${id}`, kind: 'ddls' })),
    ...(d?.nadds ?? []).filter((x) => x.due_at).map((x) => ({ at: x.due_at!, text: x.number, to: `/nadds?aircraft=${id}`, kind: 'nadd' })),
    ...(r.expected_rts_on ? [{ at: `${r.expected_rts_on}T12:00:00Z`, text: 'Expected RTS', to: `/aircraft/${id}`, kind: 'rts' }] : []),
  ];

  const activity = [
    ...(d?.events ?? []).map((e) => ({
      at: e.set_at, what: `Status set to ${e.status.replace('_', ' · ')}${e.reason ? `: ${e.reason}` : ''}`, who: tlc(e.setter), to: `/aircraft/${id}`,
    })),
    ...(d?.recentSnags ?? []).map((s) => ({
      at: s.created_at, what: `${s.number} reported · ${s.description}`, who: tlc(s.reporter), to: `/snags/${s.id}`,
    })),
    ...(d?.ddls ?? []).map((x) => ({
      at: x.deferred_at, what: `Deferred on DDLS ${x.page_no}/${x.entry_no}`, who: tlc(x.deferrer), to: `/ddls?aircraft=${id}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  const reload = () => { loadBoard(); load(); };

  return (
    <div className="dash ac-page">
      <nav aria-label="Breadcrumb" className="crumbs"><Link to="/">All aircraft</Link> <span aria-hidden>›</span> <span aria-current="page" className="mono">{r.tail}</span></nav>
      <Link to="/" className="button outline-button back-button">← Back to All aircraft</Link>
      <div className="dash-head">
        <div>
          <h1><span className="mono">{r.tail}</span> overview</h1>
          <p className="dash-sub">{weekday} {formatDate(now, display)} · {r.aircraft_type}</p>
        </div>
        <div className="row" style={{ flex: '0 0 auto' }}>
          {isEngineer && <Link className="button" to={`/request-work-order?aircraft=${id}`}>Request work order</Link>}
          <button type="button" className="outline-button" onClick={() => setAll(true)}>Expand all</button>
          <button type="button" className="outline-button" onClick={() => setAll(false)}>Collapse all</button>
        </div>
      </div>

      <div className="tiles">
        <Tile n={r.open_ddls} label="DDLS" to={`/ddls?aircraft=${id}`} />
        <Tile n={r.open_nadds} to={`/nadds?aircraft=${id}`}
          label={`NADD${r.next_nadd_due ? ` · next due ${dueText(r.next_nadd_due, now)}` : ''}`}
          tone={r.next_nadd_due && new Date(r.next_nadd_due).getTime() - now.getTime() < margin * DAY ? 'warn' : undefined} />
        <Tile n={r.open_snags} label="Open snags" to={`/snags?aircraft=${id}`} />
        <Tile n={mel} label="MEL deferrals" to={`/ddls?aircraft=${id}`} />
        <Tile n={d?.wos.length ?? '…'} label="Work orders open" to={`/work-orders?aircraft=${id}`} />
        <Tile n={due.filter((x) => flag(x.due)).length} label="Due items flagged" to={`/aircraft/${id}#p-due`}
          tone={due.some((x) => flag(x.due)) ? 'warn' : undefined} />
        <Tile n="—" label="Part requests" tone="none" />
        <Tile n="—" label="ADs and SBs" tone="none" />
      </div>

      <Panel id="record" title="Aircraft record" open={open.record} onToggle={() => toggle('record')}>
        <div className="record">
          <div className="photo" role="img" aria-label="Aircraft photo placeholder">[Aircraft photo]</div>
          <div className="facts-grid">
            <div><div className="k">Tail</div><div className="v mono big">{r.tail}</div></div>
            <div><div className="k">Type</div><div className="v">{r.aircraft_type}</div></div>
            <div><div className="k">Serial (MSN)</div><div className="v mono">{d?.aircraft?.msn ?? '—'}</div></div>
            <div><div className="k">On register since</div><div className="v">{formatPlainDate(d?.aircraft?.registration_effective_on, display) || '—'}</div></div>
            <div><div className="k">Expected return to service</div><div className="v">{formatPlainDate(r.expected_rts_on, display) || '—'}</div></div>
          </div>
        </div>
        <div className="chip-row">
          <TailStatusChip status={r.status} />
          {r.status_set_by && <span className="small muted">Set by <span className="mono">{r.status_set_by}</span> · <span className="mono">{formatDateTime(r.status_set_at, display)}</span></span>}
        </div>
        <h3 className="sub-head">Totals <span className="rail-tag">Soon</span></h3>
        <div className="facts-grid">
          <div><div className="k">Total hours</div><div className="v mono none">—</div></div>
          <div><div className="k">Cycles</div><div className="v mono none">—</div></div>
          <div><div className="k">Landings</div><div className="v mono none">—</div></div>
        </div>
        <p className="panel-note">The sum of entered flight records. Flight records are not built yet (D-017).</p>
        <h3 className="sub-head">Engines and APU <span className="rail-tag">Soon</span></h3>
        <div className="table-scroll">
          <table className="ptable">
            <thead><tr><th>Position</th><th>Model</th><th>Serial</th><th>Hours since new</th><th>Cycles since new</th></tr></thead>
            <tbody>
              {['Engine 1', 'Engine 2', 'APU'].map((pos) => (
                <tr key={pos}><td>{pos}</td><td className="muted">—</td><td className="muted">—</td><td className="muted">—</td><td className="muted">—</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">Engine and APU records come with component records in Phase 2.</p>
        {isEngineer && (
          <details className="set-status">
            <summary className="outline-button button">Set tail status</summary>
            <SetTailStatus aircraftId={r.aircraft_id} tail={r.tail} current={r.status} onDone={reload} />
          </details>
        )}
      </Panel>

      <Panel id="open" title="Open items" link={isEngineer ? { to: `/request-work-order?aircraft=${id}`, label: 'Request work order' } : { to: `/snags?aircraft=${id}`, label: 'All snags' }} open={open.open} onToggle={() => toggle('open')}>
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
        <div className="table-scroll">
          <table className="ptable">
            <thead><tr><th>Item</th><th>Type</th><th>State</th><th>Who and when</th></tr></thead>
            <tbody>
              {d?.snags.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/snags/${s.id}`}><span className="mono">{s.number}</span> · {s.description}</Link></td>
                  <td>Snag</td><td><SnagStateChip status={s.status} disposition={s.disposition} /></td>
                  <td>Reported by <span className="mono">{tlc(s.reporter)}</span> · {formatDateTime(s.created_at, display)}</td>
                </tr>
              ))}
              {d?.ddls.map((x) => (
                <tr key={x.id}>
                  <td><Link to={`/ddls?aircraft=${id}`}>DDLS {x.page_no}/{x.entry_no} · {x.defect_text}</Link></td>
                  <td>{x.kind === 'mel' ? `MEL${x.mel_category ? ` Cat ${x.mel_category}` : ''}` : 'Deferred defect'}</td>
                  <td>{x.due_at ? `Due ${formatDateTime(x.due_at, display)}` : 'Limit as specified'}</td>
                  <td>Deferred by <span className="mono">{tlc(x.deferrer)}</span> · {formatDateTime(x.deferred_at, display)}</td>
                </tr>
              ))}
              {d?.nadds.map((x) => (
                <tr key={x.id}>
                  <td><Link to={`/nadds?aircraft=${id}`}><span className="mono">{x.number}</span> · {x.description}</Link></td>
                  <td>NADD</td><td>{x.status === 'proposed' ? 'Proposed, awaiting engineer' : `Due ${formatDateTime(x.due_at, display)}`}</td>
                  <td><span className="mono">{tlc(x.reporter)}</span> · {formatDateTime(x.reported_at, display)}</td>
                </tr>
              ))}
              {d?.wos.map((w) => (
                <tr key={w.id}>
                  <td><Link to={`/work-orders/${w.id}`}><span className="mono">{w.number}</span> · {w.scope}</Link></td>
                  <td>Work order</td><td><WorkOrderChip status={w.status} /></td>
                  <td>{formatDateTime(w.created_at, display)}</td>
                </tr>
              ))}
              {d && !d.snags.length && !d.ddls.length && !d.nadds.length && !d.wos.length && (
                <tr><td colSpan={4} className="muted">No open items.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="adsb" title="ADs and SBs" link={{ to: '', label: 'All ADs and SBs', soon: true }} open={open.adsb} onToggle={() => toggle('adsb')}>
        <p className="panel-note">Every AD and SB entry, including applicability and next due, will be made by an engineer. Nothing is imported or calculated. Not built yet.</p>
      </Panel>

      <Panel id="due" title="Due items, entered by engineers" link={{ to: `/ddls?aircraft=${id}`, label: 'DDLS sheet' }} open={open.due} onToggle={() => toggle('due')}>
        <div className="table-scroll">
          <table className="ptable">
            <thead><tr><th>Item</th><th>Due (as entered)</th><th>Entered by</th><th>Flag</th></tr></thead>
            <tbody>
              {due.map((x) => (
                <tr key={x.key}>
                  <td><Link to={x.to}>{x.item}</Link></td>
                  <td className="mono">{x.due ? formatDateTime(x.due, display) : 'as specified'}</td>
                  <td>{x.by}</td>
                  <td>{flag(x.due) ?? '—'}</td>
                </tr>
              ))}
              {due.length === 0 && <tr><td colSpan={4} className="muted">No due items recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          <span className="chip tone-amber">Approaching</span> within {margin} day{margin === 1 ? '' : 's'} of the recorded due time ·{' '}
          <span className="chip tone-red">Reached</span> at or past it · margin set in operator settings · no projections.
        </p>
      </Panel>

      <Panel id="activity" title="Recent activity" open={open.activity} onToggle={() => toggle('activity')}>
        <div className="activity">
          {activity.map((a, i) => (
            <Link key={i} to={a.to} className="act">
              <span className="act-what">{a.what}</span>
              <span className="act-who"><span className="mono">{a.who}</span> · <span className="mono">{formatDateTime(a.at, display)}</span></span>
            </Link>
          ))}
          {d && activity.length === 0 && <span className="muted">Nothing recorded yet.</span>}
        </div>
      </Panel>

      <Panel id="calendar" title="Calendar · next 4 weeks" open={open.calendar} onToggle={() => toggle('calendar')}>
        <Calendar events={calendar} display={display} />
      </Panel>
    </div>
  );
}
