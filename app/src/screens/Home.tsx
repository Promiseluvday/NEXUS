// The frame around every screen after sign-in:
//   black top bar (Liebetag mark, who is signed in, Sign out: D-206)
//   left rail (departments and aircraft: D-201, D-202)
//   the chosen screen on the right.
// On a phone the rail slides in from the left with the ☰ button.
import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { Rail } from '../components/Rail';
import { useAircraftList } from '../components/AircraftPicker';

export function Home() {
  const { me, signOut } = useAuth();
  const aircraft = useAircraftList();
  const [railOpen, setRailOpen] = useState(false);

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="plain menu-button"
          aria-label="Menu"
          aria-expanded={railOpen}
          onClick={() => setRailOpen((o) => !o)}
        >
          ☰
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark">N</span> Nexus MRO
        </Link>
        <span className="spacer" />
        <span className="who">
          <span className="name">{me?.fullName} </span>
          <span className="mono">{me?.tlc}</span>
          <br />
          <span className="small">{me?.departments.map((d) => d.name).join(' · ')}</span>
        </span>
        <button type="button" className="plain" onClick={signOut}>Sign out</button>
      </header>
      <Rail aircraft={aircraft} open={railOpen} onNavigate={() => setRailOpen(false)} />
      <main className="main" onClick={() => railOpen && setRailOpen(false)}>
        <Outlet context={{ aircraft }} />
      </main>
    </div>
  );
}

// Placeholder for subsections built in later slices, so every rail link
// goes somewhere and the map of the app is visible now.
const LATER: Record<string, string> = {
  'flight-scheduling': 'Built after the Phase 1 snag workflow (D-205).',
  'crew-scheduling': 'Built after the Phase 1 snag workflow (D-205).',
};

export function ComingSoon() {
  const { dept, page } = useParams();
  const title = (page ?? '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › {dept} › {title}</div>
      <div className="card">
        <h1>{title}</h1>
        <p className="muted">
          Coming soon. {LATER[page ?? ''] ?? 'This screen is planned for a later slice of Phase 1 or a later phase.'}
        </p>
      </div>
    </div>
  );
}
