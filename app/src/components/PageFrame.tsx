// The common top of every record screen, as the Claude Design wireframes
// (WF-D1, WF-D2, WF-DD1, WF-NA1, WF-G1 …):
//
//   Crumbs      All aircraft › NX-203 › Snag list › SNAG-000001
//   BackButton  "← Back to Snag list" (one tap back, D-098)
//   TailHeader  the tail in mono, its type, and on the right the status an
//               engineer set (or the waiting snag), with who and when
//   TailTabs    the tail's sections: Overview, Snags, DDLS (MEL), NADD,
//               Work orders. Sections not built yet are not shown.
//   PageHead    the page title with its main actions on the right
//
// Shared by all Phase C screens so every page starts the same way.
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { SnagChip, TailStatusChip } from './StatusChip';
import type { FleetRow } from '../screens/FleetBoard';

export type Crumb = { label: ReactNode; to?: string };

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      {items.map((c, i) => (
        <span key={i} className="crumb">
          {i > 0 && <span aria-hidden> › </span>}
          {c.to && i < items.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function BackButton({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="button outline-button back-button">← Back to {label}</Link>;
}

// Tail, type and status. `row` is the tail's fleet board row (useFleetBoard).
export function TailHeader({ row }: { row: FleetRow }) {
  const { display } = useAuth();
  return (
    <div className="tail-head">
      <div>
        <div className="tail-head-tail">{row.tail}</div>
        <div className="tail-head-type">{row.aircraft_type}</div>
      </div>
      <div className="tail-head-status">
        {row.snag_display ? <SnagChip display={row.snag_display} /> : <TailStatusChip status={row.status} />}
        {row.status_set_by && (
          <span className="small muted">Status set by <span className="mono">{row.status_set_by}</span> · {formatDateTime(row.status_set_at, display)}</span>
        )}
      </div>
    </div>
  );
}

// The tail's sections. Engineers and oversight see work orders; pilots don't (D-120).
export function TailTabs({ aircraftId }: { aircraftId: string }) {
  const { me } = useAuth();
  const engOrOversight = Boolean(me?.departments.some((d) => d.code === 'ENG') || me?.isOversight);
  const q = `?aircraft=${aircraftId}`;
  const tabs = [
    { to: `/aircraft/${aircraftId}`, label: 'Overview' },
    { to: `/snags${q}`, label: 'Snags' },
    { to: `/ddls${q}`, label: 'DDLS (MEL)' },
    { to: `/nadds${q}`, label: 'NADD' },
    ...(engOrOversight ? [{ to: `/work-orders${q}`, label: 'Work orders' }] : []),
  ];
  return (
    <nav aria-label="Aircraft sections" className="tail-tabs">
      {tabs.map((t) => (
        <NavLink key={t.label} to={t.to} end
          className={({ isActive }) => (isActive || isTabActive(t.to) ? 'active' : undefined)}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

// NavLink ignores the ?aircraft= part; match the path ourselves.
function isTabActive(to: string): boolean {
  if (typeof window === 'undefined') return false;
  const [path] = to.split('?');
  const here = window.location.pathname;
  // A record page (/snags/<id>) belongs to its list's tab (/snags).
  return here === path || (path !== '/' && !path.startsWith('/aircraft/') && here.startsWith(`${path}/`));
}

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head2">
      <div>
        <h1>{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

// A titled box, as the wireframes' grey section boxes (white cards here).
export function Section({ title, children, tone, id, actions }: {
  title: ReactNode; children: ReactNode; tone?: 'strong' | 'warn'; id?: string; actions?: ReactNode;
}) {
  return (
    <section className={`box${tone ? ` box-${tone}` : ''}`} id={id}>
      <div className="box-head">
        <h2>{title}</h2>
        {actions && <div className="box-actions">{actions}</div>}
      </div>
      <div className="box-body">{children}</div>
    </section>
  );
}
