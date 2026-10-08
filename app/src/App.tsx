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
      { path: 'section/:dept/:page', element: <ComingSoon /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  const { loading, session, me } = useAuth();

  if (loading) return <div className="center muted">Loading Nexus…</div>;
  if (!session) return <SignIn />;
  if (!me || me.status !== 'active') return <AccountNotActive />;
  if (!me.pinSet) return <SetPin />;
  return <RouterProvider router={router} />;
}
