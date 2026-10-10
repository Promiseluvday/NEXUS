// The left rail, laid out as the Claude Design canvas (Main.dc.html, D-201,
// D-202, docs/ui-rules.md):
//   * "All aircraft" (the dashboard) with a chevron that drops down every
//     tail and its status, coloured by meaning (D-091).
//   * The user's departments, each a dropdown. The home department is first,
//     marked "· home", and starts open. Inside, related screens are grouped
//     one level deeper (Snags & deferrals ▸, Workshops ▸). Workshops show
//     only for people who hold them (D-018, D-124).
//   * Command and Quality also see the other departments, collapsed, marked
//     "View" because they only read there (D-122).
//   * Then Approvals (with a count when something waits for you), Queries,
//     Reports.
// Screens not built yet show a "Soon" tag. Actions (Report snag, Request
// part…) are not in the rail; they live in the ＋ New menu in the header.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuth, type Department } from '../lib/auth';
import { TAIL_STATUS } from './StatusChip';
import type { AircraftOption } from './AircraftPicker';

type Screen = { label: string; to: string; section?: string };
type Entry = Screen | { group: string; items: Screen[] };

// Promise's agreed grouping (9 Oct): department ▸ group ▸ screen, never
// deeper. Screens under /section/ are not built yet ("Soon"). `section` =
// shown only to people who hold that Engineering section (D-018, D-124);
// Command and Quality, viewing, see them all.
const MENU: Record<string, Entry[]> = {
  ENG: [
    { group: 'Snags & deferrals', items: [
      { label: 'Snags', to: '/snags' },
      { label: 'MEL / DDLS', to: '/ddls' },
      { label: 'NADDs', to: '/nadds' },
      { label: 'Cabin items to review', to: '/nadds?review=1' },
    ] },
    { label: 'Work orders', to: '/work-orders' },
    { group: 'Workshops', items: [
      { label: 'Tire Bay', to: '/section/ENG/tire-bay', section: 'TIRE' },
      { label: 'Battery Workshop', to: '/section/ENG/battery-workshop', section: 'BATT' },
      { label: 'AGE', to: '/section/ENG/age', section: 'AGE' },
    ] },
  ],
  OPS: [
    { label: 'Availability (read-only)', to: '/' },
    { label: 'NADDs (cabin items)', to: '/nadds' },
    { group: 'Scheduling', items: [
      { label: 'Flight scheduling', to: '/section/OPS/flight-scheduling' },
      { label: 'Crew scheduling', to: '/section/OPS/crew-scheduling' },
    ] },
  ],
  SUP: [
    { label: 'Stores search', to: '/section/SUP/stores-search' },
    { group: 'Stores', items: [
      { label: 'Main Store', to: '/section/SUP/main-store' },
      { label: 'Forward Store', to: '/section/SUP/forward-store' },
    ] },
    { label: 'Receiving', to: '/section/SUP/receiving' },
  ],
  PRO: [
    { label: 'Requisitions', to: '/section/PRO/requisitions' },
    { label: 'Purchase orders', to: '/section/PRO/purchase-orders' },
    { label: 'Outside-MRO jobs', to: '/section/PRO/outside-mro' },
  ],
  QUA: [
    { label: 'Offline signatures', to: '/offline-signatures' },
    { label: 'MEL revisions', to: '/section/QUA/mel' },
    { label: 'Audit trail', to: '/section/QUA/audit' },
  ],
  CMD: [
    { label: 'Reports', to: '/section/CMD/reports' },
  ],
};

const isSoon = (s: Screen) => s.to.startsWith('/section/');

const Chevron = () => (
  <svg className="caret" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
);

function ScreenLink({ s, onNavigate }: { s: Screen; onNavigate: () => void }) {
  return (
    <NavLink to={s.to} end className={`rail-link${isSoon(s) ? ' soon' : ''}`} onClick={onNavigate}>
      {s.label}
      {isSoon(s) && <span className="rail-tag">Soon</span>}
    </NavLink>
  );
}

function DepartmentBlock(props: {
  d: Department; home: boolean; viewOnly: boolean; open: boolean; onToggle: () => void; onNavigate: () => void;
}) {
  const { d, home, viewOnly, open, onToggle, onNavigate } = props;
  const { me } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const allowed = (s: Screen) => !s.section || viewOnly || Boolean(me?.sections.includes(s.section));
  return (
    <div>
      <button type="button" className="rail-link rail-dept" aria-expanded={open} onClick={onToggle}>
        <span>{d.name}{home && <span className="rail-note"> · home</span>}</span>
        {viewOnly && <span className="rail-tag">View</span>}
        <Chevron />
      </button>
      {open && (
        <div className="rail-sub">
          {(MENU[d.code] ?? []).map((e) => {
            if (!('group' in e)) return <ScreenLink key={e.to + e.label} s={e} onNavigate={onNavigate} />;
            const items = e.items.filter(allowed);
            if (!items.length) return null;
            return (
              <div key={e.group}>
                <button type="button" className="rail-link" aria-expanded={openGroup === e.group}
                  onClick={() => setOpenGroup((g) => (g === e.group ? null : e.group))}>
                  {e.group}
                  <Chevron />
                </button>
                {openGroup === e.group && (
                  <div className="rail-sub rail-sub2">
                    {items.map((s) => <ScreenLink key={s.to} s={s} onNavigate={onNavigate} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "All aircraft" and the chevron listing every tail with its status.
function FleetLink({ aircraft, onNavigate }: { aircraft: AircraftOption[]; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="rail-fleet" ref={box}>
      <NavLink to="/" end className="rail-link" onClick={onNavigate}>All aircraft</NavLink>
      <button type="button" className="rail-chevron" aria-expanded={open} aria-label="Show aircraft list"
        title="Show aircraft list" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="rail-tails" role="group" aria-label="Aircraft list">
          {aircraft.map((a) => {
            // A waiting snag shows instead of the status, as on the cards (D-200).
            const snag = a.snagDisplay === 'snag_open' ? 'Snag open' : a.snagDisplay === 'snag_attended' ? 'Snag attended' : null;
            const label = snag ?? (a.status ? TAIL_STATUS[a.status]?.short ?? a.status : 'No status');
            return (
              <Link key={a.id} to={`/aircraft/${a.id}`} className="rail-tail" onClick={() => { setOpen(false); onNavigate(); }}>
                <span><span className="tail">{a.tail}</span><span className="type">{a.type}</span></span>
                <span className={`st st-${snag ? 'snag' : a.status ?? ''}`}>{label}</span>
              </Link>
            );
          })}
          {aircraft.length === 0 && <span className="small muted" style={{ padding: 10 }}>No aircraft in your scope.</span>}
        </div>
      )}
    </div>
  );
}

type Props = { aircraft: AircraftOption[]; open: boolean; onNavigate: () => void; approvals: number };

export function Rail({ aircraft, open, onNavigate, approvals }: Props) {
  const { me } = useAuth();
  const own = me?.departments ?? [];
  const ownCodes = new Set(own.map((d) => d.code));
  const others = me?.isOversight ? me.allDepartments.filter((d) => !ownCodes.has(d.code)) : [];

  // Accordion: one department open at a time. The home department starts open.
  const [openDept, setOpenDept] = useState<string | null>(own[0]?.code ?? null);
  const toggle = (code: string) => setOpenDept((c) => (c === code ? null : code));

  return (
    <nav className={`rail${open ? ' open' : ''}`} aria-label="Aircraft and departments">
      <FleetLink aircraft={aircraft} onNavigate={onNavigate} />
      <div className="rail-rule" />

      {own.map((d, i) => (
        <DepartmentBlock key={d.code} d={d} home={i === 0} viewOnly={false} open={openDept === d.code}
          onToggle={() => toggle(d.code)} onNavigate={onNavigate} />
      ))}
      {others.length > 0 && <div className="rail-heading">Other departments</div>}
      {others.map((d) => (
        <DepartmentBlock key={d.code} d={d} home={false} viewOnly open={openDept === d.code}
          onToggle={() => toggle(d.code)} onNavigate={onNavigate} />
      ))}

      <div className="rail-rule" />
      <NavLink to="/approvals" className="rail-link" onClick={onNavigate}>
        Approvals {approvals > 0 && <span className="rail-count" aria-label={`${approvals} waiting for you`}>{approvals}</span>}
      </NavLink>
      <NavLink to="/queries" className="rail-link" onClick={onNavigate}>Queries</NavLink>
      <ScreenLink s={{ label: 'Reports', to: '/section/ALL/reports' }} onNavigate={onNavigate} />
    </nav>
  );
}
