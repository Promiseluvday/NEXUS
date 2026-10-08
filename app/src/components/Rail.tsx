// The left rail (D-201, D-202, docs/ui-rules.md).
//   * "All aircraft" (the fleet board) and the tail search.
//   * The user's own departments. Each opens with a dropdown arrow; only one
//     is open at a time so the rail never floods.
//   * Inside a department, related screens are grouped one level deeper
//     (e.g. Workshops ▸ Tire Bay, Battery Workshop, AGE). Never deeper than
//     that: department ▸ group ▸ screen.
//   * Command and Quality also get "Other departments", collapsed, marked
//     "View" because they only read there (D-122).
//   * Screens not built yet show a "Soon" tag.
// Actions (Report snag, Request part…) are NOT in the rail. They live in
// the ＋ New menu in the top bar.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth, type Department } from '../lib/auth';
import { TailSearch, type AircraftOption } from './AircraftPicker';

type Screen = { label: string; to: string };
type Entry = Screen | { group: string; items: Screen[] };

// Screens under /section/ are not built yet ("Soon").
const MENU: Record<string, Entry[]> = {
  ENG: [
    { group: 'Snags & deferrals', items: [
      { label: 'Snags', to: '/snags' },
      { label: 'DDLS', to: '/ddls' },
      { label: 'NADDs', to: '/nadds' },
    ] },
    { label: 'Work orders', to: '/work-orders' },
    { group: 'Workshops', items: [
      { label: 'Tire Bay', to: '/section/ENG/tire-bay' },
      { label: 'Battery Workshop', to: '/section/ENG/battery-workshop' },
      { label: 'AGE', to: '/section/ENG/age' },
    ] },
  ],
  OPS: [
    { label: 'Aircraft availability', to: '/' },
    { label: 'NADDs (cabin items)', to: '/nadds' },
    { group: 'Scheduling', items: [
      { label: 'Flight scheduling', to: '/section/OPS/flight-scheduling' },
      { label: 'Crew scheduling', to: '/section/OPS/crew-scheduling' },
    ] },
  ],
  SUP: [
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
    { label: 'Approvals', to: '/approvals' },
    { label: 'MEL revisions', to: '/section/QUA/mel' },
    { label: 'Offline signatures', to: '/offline-signatures' },
    { label: 'Audit trail', to: '/section/QUA/audit' },
  ],
  CMD: [
    { label: 'Approvals', to: '/approvals' },
    { label: 'Reports', to: '/section/CMD/reports' },
  ],
};

const isSoon = (s: Screen) => s.to.startsWith('/section/');

function ScreenLink({ s, onNavigate }: { s: Screen; onNavigate: () => void }) {
  return (
    <NavLink to={s.to} end className={`rail-link${isSoon(s) ? ' soon' : ''}`} onClick={onNavigate}>
      {s.label}
      {isSoon(s) && <span className="rail-tag">Soon</span>}
    </NavLink>
  );
}

function DepartmentBlock(props: {
  d: Department; viewOnly: boolean; open: boolean; onToggle: () => void; onNavigate: () => void;
}) {
  const { d, viewOnly, open, onToggle, onNavigate } = props;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="rail-link" aria-expanded={open} onClick={onToggle}>
        {d.name}
        {viewOnly && <span className="rail-tag">View</span>}
        <span className="caret" aria-hidden>▸</span>
      </button>
      {open && (
        <div className="rail-sub">
          {(MENU[d.code] ?? []).map((e) =>
            'group' in e ? (
              <div key={e.group}>
                <button
                  type="button"
                  className="rail-link"
                  aria-expanded={openGroup === e.group}
                  onClick={() => setOpenGroup((g) => (g === e.group ? null : e.group))}
                >
                  {e.group}
                  <span className="caret" aria-hidden>▸</span>
                </button>
                {openGroup === e.group && (
                  <div className="rail-sub">
                    {e.items.map((s) => <ScreenLink key={s.to} s={s} onNavigate={onNavigate} />)}
                  </div>
                )}
              </div>
            ) : (
              <ScreenLink key={e.to + e.label} s={e} onNavigate={onNavigate} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

type Props = { aircraft: AircraftOption[]; open: boolean; onNavigate: () => void };

export function Rail({ aircraft, open, onNavigate }: Props) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const own = me?.departments ?? [];
  const ownCodes = new Set(own.map((d) => d.code));
  const others = me?.isOversight ? (me.allDepartments.filter((d) => !ownCodes.has(d.code))) : [];

  // Accordion: one department open at a time. The home department starts open.
  const [openDept, setOpenDept] = useState<string | null>(own[0]?.code ?? null);
  const [othersOpen, setOthersOpen] = useState(false);
  const toggle = (code: string) => setOpenDept((c) => (c === code ? null : code));

  return (
    <nav className={`rail${open ? ' open' : ''}`} aria-label="Main">
      <NavLink to="/" end className="rail-link" onClick={onNavigate}>
        All aircraft
      </NavLink>
      <NavLink to="/queries" className="rail-link" onClick={onNavigate}>
        Technical queries
      </NavLink>
      <TailSearch
        aircraft={aircraft}
        onPick={(id) => {
          navigate(`/aircraft/${id}`);
          onNavigate();
        }}
      />

      <div className="rail-heading">My departments</div>
      {own.map((d) => (
        <DepartmentBlock key={d.code} d={d} viewOnly={false} open={openDept === d.code}
          onToggle={() => toggle(d.code)} onNavigate={onNavigate} />
      ))}

      {others.length > 0 && (
        <>
          <button type="button" className="rail-heading rail-heading-button" aria-expanded={othersOpen}
            onClick={() => setOthersOpen((o) => !o)}>
            Other departments ({others.length}) <span className="caret" aria-hidden>▸</span>
          </button>
          {othersOpen && others.map((d) => (
            <DepartmentBlock key={d.code} d={d} viewOnly open={openDept === d.code}
              onToggle={() => toggle(d.code)} onNavigate={onNavigate} />
          ))}
        </>
      )}
    </nav>
  );
}
