// The frame around every screen after sign-in:
//   black top bar: ☰ (phones), Liebetag mark, online/offline pill (D-094),
//     ＋ New menu (all actions in one place), user menu (Sign out, D-206)
//   left rail: departments and aircraft (D-201, D-202)
//   the chosen screen on the right.
// On a phone the rail slides in from the left with the ☰ button.
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { Rail } from '../components/Rail';
import { useAircraftList } from '../components/AircraftPicker';
import { Menu, MenuItem } from '../components/Menu';
import { usePendingApprovals } from './Approvals';
import { useOnline, useOutbox } from '../lib/offline/hooks';
import { startAutoSync } from '../lib/offline/outbox';
import { getCurrentUser } from '../lib/perform';
import { prefetchForOffline } from '../lib/offline/prefetch';

// "Online" / "Offline" is always visible (D-094), with how many actions are
// waiting to be sent and how many the server refused. Tap it for the queue.
function SyncPill() {
  const online = useOnline();
  const items = useOutbox();
  const waiting = items.filter((i) => i.status === 'queued' || i.status === 'sending').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const text = `${online ? 'Online' : 'Offline'}${waiting ? ` · ${waiting} waiting` : ''}${failed ? ` · ${failed} refused` : ''}`;
  return (
    <Link to="/sync" className={`pill ${online && !failed ? 'pill-online' : 'pill-offline'}${waiting || failed ? ' pill-busy' : ''}`}
      role="status" title={online ? 'Connected to the Nexus server' : 'No connection: actions wait on this tablet'}>
      {text}
    </Link>
  );
}

// Every "create something" action in one menu. Shows only what this user may
// do. Opened while looking at a tail, the tail is filled in (D-098).
function NewMenu() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tailId = location.pathname.startsWith('/aircraft/') ? location.pathname.split('/')[2] : '';
  const onRecord = /^\/(snags|work-orders)\/[0-9a-f-]{36}$/.test(location.pathname);
  const eng = me?.departments.some((d) => d.code === 'ENG');
  const ops = me?.departments.some((d) => d.code === 'OPS');
  if (!eng && !ops && !me?.isOversight) return null;
  return (
    <Menu label="＋ New" align="right" className="new-button">
      {(close) => (
        <>
          {me?.canReportSnags && (
            <MenuItem onSelect={() => { close(); navigate(`/report-snag${tailId ? `?aircraft=${tailId}` : ''}`); }}>
              Report snag
            </MenuItem>
          )}
          {(eng || ops) && (
            <MenuItem onSelect={() => { close(); navigate(`/cabin-item${tailId ? `?aircraft=${tailId}` : ''}`); }}>
              Cabin item
            </MenuItem>
          )}
          {eng && <MenuItem soon>Request part</MenuItem>}
          <MenuItem onSelect={() => {
            close();
            // A query is always about a record: raise it on the snag or work order being viewed.
            if (onRecord) navigate(`${location.pathname}?query=new#queries`);
            else navigate('/queries');
          }}>
            Raise technical query
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

// "Approvals (2)": shown only when something is waiting for this person.
function ApprovalsBadge() {
  const { items, load } = usePendingApprovals();
  useEffect(() => {
    window.addEventListener('nexus:approvals', load);
    return () => window.removeEventListener('nexus:approvals', load);
  }, [load]);
  if (!items?.length) return null;
  return <Link to="/approvals" className="button badge-button">Approvals <span className="badge">{items.length}</span></Link>;
}

function UserMenu() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Menu label={<span className="mono">{me?.tlc}</span>} ariaLabel="Account" align="right" className="plain">
      {(close) => (
        <>
          <div className="menu-head">
            <strong>{me?.fullName}</strong> <span className="mono">{me?.tlc}</span>
            <div className="small muted">{me?.departments.map((d) => d.name).join(' · ')}</div>
          </div>
          <MenuItem onSelect={() => { close(); navigate('/device#pin'); }}>Change PIN</MenuItem>
          <MenuItem onSelect={() => { close(); navigate('/device'); }}>This tablet and offline signing</MenuItem>
          <MenuItem onSelect={() => { close(); navigate('/sync'); }}>Send queue</MenuItem>
          <MenuItem onSelect={signOut}>Sign out</MenuItem>
        </>
      )}
    </Menu>
  );
}

export function Home() {
  const aircraft = useAircraftList();
  const [railOpen, setRailOpen] = useState(false);
  // Send waiting actions whenever the connection allows (D-102).
  useEffect(() => startAutoSync(getCurrentUser), []);
  // Save the MEL and cabin zones for offline use (D-102, D-217).
  useEffect(() => { prefetchForOffline(aircraft.map((a) => a.type)); }, [aircraft]);

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
          <span className="brand-mark">N</span> <span className="brand-name">Nexus MRO</span>
        </Link>
        <span className="spacer" />
        <SyncPill />
        <ApprovalsBadge />
        <NewMenu />
        <UserMenu />
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
