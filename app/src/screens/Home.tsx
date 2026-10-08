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

// "Online" / "Offline" is always visible (D-094). Until Phase 1C adds the
// offline queue, actions need a connection, and the pill says so.
function OnlinePill() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online
    ? <span className="pill pill-online" title="Connected to the Nexus server">Online</span>
    : <span className="pill pill-offline" role="status" title="Actions cannot be sent until the connection returns">Offline · actions not sent</span>;
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
  return (
    <Menu label={<span className="mono">{me?.tlc}</span>} ariaLabel="Account" align="right" className="plain">
      {() => (
        <>
          <div className="menu-head">
            <strong>{me?.fullName}</strong> <span className="mono">{me?.tlc}</span>
            <div className="small muted">{me?.departments.map((d) => d.name).join(' · ')}</div>
          </div>
          <MenuItem soon>Change PIN</MenuItem>
          <MenuItem soon>My account</MenuItem>
          <MenuItem onSelect={signOut}>Sign out</MenuItem>
        </>
      )}
    </Menu>
  );
}

export function Home() {
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
          <span className="brand-mark">N</span> <span className="brand-name">Nexus MRO</span>
        </Link>
        <span className="spacer" />
        <OnlinePill />
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
