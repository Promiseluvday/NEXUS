// The left rail (D-201, D-202).
//   * "All aircraft" (the fleet board), then the aircraft dropdown.
//   * The departments this user may use, each with a dropdown arrow that
//     opens its subsections.
//   * Command and Quality see every department, marked "View" where they
//     only read (D-122).
// Subsections not built yet open a "coming in a later slice" page, so the
// whole map is visible from day one.
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { AircraftPicker, type AircraftOption } from './AircraftPicker';

type Sub = { label: string; to: string; action?: boolean }; // action: hidden in view-only departments

// Subsections per department. Paths under /section/ are placeholders for
// screens built in later slices.
const SUBSECTIONS: Record<string, Sub[]> = {
  ENG: [
    { label: 'Fleet board', to: '/' },
    { label: 'Report snag', to: '/report-snag', action: true },
    { label: 'Snags', to: '/section/ENG/snags' },
    { label: 'Work orders', to: '/section/ENG/work-orders' },
    { label: 'DDLS', to: '/section/ENG/ddls' },
    { label: 'NADDs', to: '/section/ENG/nadds' },
    { label: 'Tire Bay', to: '/section/ENG/tire-bay' },
    { label: 'Battery Workshop', to: '/section/ENG/battery-workshop' },
    { label: 'AGE', to: '/section/ENG/age' },
  ],
  OPS: [
    { label: 'Aircraft availability', to: '/' },
    { label: 'Report snag', to: '/report-snag', action: true },
    { label: 'Flight scheduling', to: '/section/OPS/flight-scheduling' },
    { label: 'Crew scheduling', to: '/section/OPS/crew-scheduling' },
  ],
  SUP: [
    { label: 'Main Store', to: '/section/SUP/main-store' },
    { label: 'Forward Store', to: '/section/SUP/forward-store' },
    { label: 'Receiving', to: '/section/SUP/receiving' },
  ],
  PRO: [
    { label: 'Requisitions', to: '/section/PRO/requisitions' },
    { label: 'Purchase orders', to: '/section/PRO/purchase-orders' },
    { label: 'Outside-MRO jobs', to: '/section/PRO/outside-mro' },
  ],
  QUA: [
    { label: 'Approvals', to: '/section/QUA/approvals' },
    { label: 'MEL revisions', to: '/section/QUA/mel' },
    { label: 'Audit trail', to: '/section/QUA/audit' },
  ],
  CMD: [
    { label: 'Approvals', to: '/section/CMD/approvals' },
    { label: 'Reports', to: '/section/CMD/reports' },
  ],
};

type Props = { aircraft: AircraftOption[]; open: boolean; onNavigate: () => void };

export function Rail({ aircraft, open, onNavigate }: Props) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const heldCodes = new Set(me?.departments.map((d) => d.code));
  const shown = me?.isOversight ? me.allDepartments : (me?.departments ?? []);

  // The user's own departments start open; others start closed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries((me?.departments ?? []).map((d) => [d.code, true])),
  );

  const currentTail = location.pathname.startsWith('/aircraft/') ? location.pathname.split('/')[2] : '';

  return (
    <nav className={`rail${open ? ' open' : ''}`} aria-label="Main">
      <NavLink to="/" end className="rail-link" onClick={onNavigate}>
        All aircraft
      </NavLink>
      <label className="rail-heading" htmlFor="rail-aircraft">Aircraft</label>
      <AircraftPicker
        id="rail-aircraft"
        aircraft={aircraft}
        value={currentTail}
        placeholder="Go to a tail…"
        onChange={(id) => {
          if (id) {
            navigate(`/aircraft/${id}`);
            onNavigate();
          }
        }}
      />

      <div className="rail-heading">Departments</div>
      {shown.map((d) => {
        const isOpen = expanded[d.code] ?? false;
        const viewOnly = !heldCodes.has(d.code);
        return (
          <div key={d.code}>
            <button
              type="button"
              className="rail-link"
              aria-expanded={isOpen}
              onClick={() => setExpanded((e) => ({ ...e, [d.code]: !isOpen }))}
            >
              {d.name}
              {viewOnly && <span className="rail-tag">View</span>}
              <span className="caret" aria-hidden>▸</span>
            </button>
            {isOpen && (
              <div className="rail-sub">
                {(SUBSECTIONS[d.code] ?? []).filter((s) => !(viewOnly && s.action)).map((s) => (
                  <NavLink key={s.to + s.label} to={s.to} end className="rail-link" onClick={onNavigate}>
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
