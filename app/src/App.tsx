// Which screen to show.
//   Not signed in             → Sign in
//   Account pending or off    → "waiting for approval" / "not active"
//   No signing PIN yet        → Set your PIN (first sign-in, D-206)
//   Otherwise                 → the app, with these addresses:
//     /                       fleet board (All aircraft)
//     /aircraft/:id           one aircraft
//     /report-snag            report a snag (?aircraft=… fills in the tail)
//     /snags                  snag list (?view=…&aircraft=…)
//     /snags/:id              one snag: attend, disposition, tail status
//     /approvals              approvals waiting for me
//     /work-orders            work order list; /work-orders/:id one work order
//     /ddls, /nadds           DDLS sheet and NADD list per tail (?aircraft=…)
//     /cabin-item             report a cabin item on the cabin map
//     /queries                technical queries I am involved in
//     /print/ddls/:id, /print/nadds/:id   printable sheets (no app frame)
//     /section/:dept/:page    subsections built in later slices
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { useAuth } from './lib/auth';
import { SignIn } from './screens/SignIn';
import { AccountNotActive, SetPin } from './screens/SetPin';
import { ComingSoon, Home } from './screens/Home';
import { AircraftSummary, FleetBoard } from './screens/FleetBoard';
import { ReportSnag } from './screens/ReportSnag';
import { SnagList } from './screens/SnagList';
import { SnagDetail } from './screens/SnagDetail';
import { Approvals } from './screens/Approvals';
import { WorkOrderList, WorkOrderPage } from './screens/WorkOrders';
import { DdlsSheet } from './screens/Ddls';
import { NaddList } from './screens/Nadds';
import { CabinItem } from './screens/CabinItem';
import { QueryList } from './screens/QueryList';
import { DdlsPrint, NaddsPrint } from './screens/Prints';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
    children: [
      { index: true, element: <FleetBoard /> },
      { path: 'aircraft/:id', element: <AircraftSummary /> },
      { path: 'report-snag', element: <ReportSnag /> },
      { path: 'snags', element: <SnagList /> },
      { path: 'snags/:id', element: <SnagDetail /> },
      { path: 'approvals', element: <Approvals /> },
      { path: 'work-orders', element: <WorkOrderList /> },
      { path: 'work-orders/:id', element: <WorkOrderPage /> },
      { path: 'ddls', element: <DdlsSheet /> },
      { path: 'nadds', element: <NaddList /> },
      { path: 'cabin-item', element: <CabinItem /> },
      { path: 'queries', element: <QueryList /> },
      { path: 'section/:dept/:page', element: <ComingSoon /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '/print/ddls/:id', element: <DdlsPrint /> },
  { path: '/print/nadds/:id', element: <NaddsPrint /> },
]);

export function App() {
  const { loading, session, me } = useAuth();

  if (loading) return <div className="center muted">Loading Nexus…</div>;
  if (!session) return <SignIn />;
  if (!me || me.status !== 'active') return <AccountNotActive />;
  if (!me.pinSet) return <SetPin />;
  return <RouterProvider router={router} />;
}
