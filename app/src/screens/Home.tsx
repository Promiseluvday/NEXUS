// The frame around every screen after sign-in, as the Claude Design canvas
// (Main.dc.html):
//   black header: "Nexus MRO by Liebetag", tail search,
//     online/offline pill (D-094), notifications bell (approvals waiting),
//     ＋ New menu (all actions in one place), account menu with name and
//     role (Sign out, D-206)
//   left rail: All aircraft and departments (D-201, D-202); on a phone it
//     slides in from More on the bottom bar (Fleet, Snags, Parts, More)
//   the chosen screen on the right.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { Rail } from '../components/Rail';
import { TailSearch, useAircraftList } from '../components/AircraftPicker';
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
  const text = `${online ? 'Online' : 'Offline'}${waiting ? ` · ${waiting} waiting` : ''}${failed ? ` · ${failed} refused` : ''}${online && !waiting && !failed ? ' · all synced' : ''}`;
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
          {eng && (
            <MenuItem onSelect={() => { close(); navigate(`/request-work-order${tailId ? `?aircraft=${tailId}` : ''}`); }}>
              Request work order
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

// The bell: how many approvals are waiting for this person. Tap for the
// approvals inbox. (Other notifications join it in later phases.)
function Bell({ count }: { count: number }) {
  return (
    <Link to="/approvals" className={`bell${count ? "" : " bell-zero"}`} aria-label={`Notifications, ${count} waiting`} title="Approvals waiting for you">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {count > 0 ? <span className="badge">{count}</span> : <span>0</span>}
    </Link>
  );
}

function UserMenu() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const role = me?.departments.map((d) => d.name).join(' · ') ?? '';
  return (
    <Menu
      label={<span><span className="account-name"><span className="account-full">{me?.fullName} </span><span className="mono">{me?.tlc}</span></span><span className="account-role">{role}</span></span>}
      ariaLabel="Account menu" align="right" className="account-button">
      {(close) => (
        <>
          <MenuItem onSelect={() => { close(); navigate('/device#pin'); }}>My account · change PIN</MenuItem>
          <MenuItem onSelect={() => { close(); navigate('/device'); }}>This tablet and offline signing</MenuItem>
          <MenuItem onSelect={() => { close(); navigate('/sync'); }}>Send queue</MenuItem>
          <MenuItem onSelect={signOut}><span className="danger-text">Sign out</span></MenuItem>
        </>
      )}
    </Menu>
  );
}

export function Home() {
  const aircraft = useAircraftList();
  const [railOpen, setRailOpen] = useState(false);
  const navigate = useNavigate();
  const { items: pending, load: loadPending } = usePendingApprovals();
  useEffect(() => {
    window.addEventListener('nexus:approvals', loadPending);
    return () => window.removeEventListener('nexus:approvals', loadPending);
  }, [loadPending]);
  const approvals = pending?.length ?? 0;
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
          <span className="brand-name">Nexus<span> MRO</span></span>
          <span className="brand-by">by Liebetag</span>
        </Link>
        <div className="top-search">
          <TailSearch aircraft={aircraft} onPick={(id) => navigate(`/aircraft/${id}`)} />
        </div>
        <SyncPill />
        <Bell count={approvals} />
        <NewMenu />
        <span className="spacer" />
        <UserMenu />
      </header>
      <Rail aircraft={aircraft} open={railOpen} approvals={approvals} onNavigate={() => setRailOpen(false)} />
      <main className="main" onClick={() => railOpen && setRailOpen(false)}>
        <Outlet context={{ aircraft }} />
      </main>
      {/* Phones: bottom bar (Phone.dc.html). More opens the full menu. */}
      <nav className="bottom-nav" aria-label="Main">
        <NavLink to="/" end onClick={() => setRailOpen(false)}>Fleet</NavLink>
        <NavLink to="/snags" onClick={() => setRailOpen(false)}>Snags</NavLink>
        <NavLink to="/section/SUP/stores-search" onClick={() => setRailOpen(false)}>Parts</NavLink>
        <button type="button" aria-expanded={railOpen} onClick={() => setRailOpen((o) => !o)}>More</button>
      </nav>
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
