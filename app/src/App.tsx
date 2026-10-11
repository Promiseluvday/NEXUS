// Which screen to show.
//   Not signed in             → Sign in
//   Account pending or off    → "waiting for approval" / "not active"
//   No signing PIN yet        → Set your PIN (first sign-in, D-206)
//   Otherwise                 → the app, with these addresses:
//     /                       fleet board (All aircraft)
//     /aircraft/:id           one aircraft overview
//     /report-snag            report a snag (?aircraft=… fills in the tail)
//     /snags                  snag list (?view=…&aircraft=…)
//     /snags/:id              one snag: attend, disposition, tail status
//     /approvals              approvals waiting for me
//     /work-orders            work order list; /work-orders/:id one work order
//     /request-work-order     pick tail and snag, request a work order (D-218)
//     /ddls, /nadds           DDLS sheet and NADD list per tail (?aircraft=…)
//     /cabin-item             report a cabin item on the cabin map
//     /queries                technical queries I am involved in
//     /device                 this tablet, offline signing, change PIN (D-217)
//     /sync                   send queue on this tablet
//     /offline-signatures     Quality review of offline signatures
//     /admin/users            Users and roles (Super Admins): list, /new, /:personId
//     /flights?aircraft=…     flight records per tail (&do=log, &do=baseline, &record=…, D-022, D-027)
//     /people, /people/:id(/qualifications|/authorizations)  people, licences, certifying authorizations (D-032, D-080)
//     /ads-sbs                ADs and SBs register and compliance (?aircraft=…, ?view=register, D-016)
//     /supply, /stores/…      Supply board, stores search, issue, receiving, quarantine, U/S returns, transfers (D-070, D-141 to D-153)
//     /part-requests          part requests (?aircraft=…, /new, /:id; D-068, D-143, D-145)
//     /procurement/…          requisitions, purchase orders, suppliers, outside-MRO jobs (D-073 to D-079, D-144 to D-149)
//     /notifications          things waiting on me, built from current records
//     /print/ddls/:id, /print/nadds/:id   printable sheets (no app frame)
//     /print/serviceability   daily serviceability state (?copy=ops: Operations copy, D-203)
//     /section/:dept/:page    subsections built in later slices
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { useAuth } from './lib/auth';
import { SignIn } from './screens/SignIn';
import { AccountNotActive, SetPassword, SetPin } from './screens/SetPin';
import { AdminAccount, AdminCreateAccount, AdminUsers } from './screens/Admin';
import { ComingSoon, Home } from './screens/Home';
import { FleetBoard } from './screens/FleetBoard';
import { AircraftPage } from './screens/AircraftPage';
import { RequestWorkOrder } from './screens/RequestWorkOrder';
import { Notifications } from './screens/Notifications';
import { Flights } from './screens/Flights';
import { AdsSbs } from './screens/AdsSbs';
import {
  IssueParts, PartDetail, PartRequestForm, PartRequestList, PartRequestPage, Quarantine, ReceiptPage, Receiving,
  StoresSearch, SupplyBoard, Transfers, UsReturns,
} from './screens/Stores';
import {
  NewPurchaseOrder, NewRequisition, OutsideMroList, OutsideMroPage, ProcurementBoard, PurchaseOrderList,
  PurchaseOrderPage, RequisitionList, RequisitionPage, Suppliers,
} from './screens/Procurement';
import { PeopleList, PersonAuthorizationsPage, PersonQualificationsPage, PersonRecordPage } from './screens/People';
import { ServiceabilityPrint } from './screens/ServiceabilityPrint';
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
import { DevicePage } from './screens/Device';
import { SyncQueue } from './screens/SyncQueue';
import { OfflineReview } from './screens/OfflineReview';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
    children: [
      { index: true, element: <FleetBoard /> },
      { path: 'aircraft/:id', element: <AircraftPage /> },
      { path: 'report-snag', element: <ReportSnag /> },
      { path: 'snags', element: <SnagList /> },
      { path: 'snags/:id', element: <SnagDetail /> },
      { path: 'approvals', element: <Approvals /> },
      { path: 'work-orders', element: <WorkOrderList /> },
      { path: 'work-orders/:id', element: <WorkOrderPage /> },
      { path: 'request-work-order', element: <RequestWorkOrder /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'flights', element: <Flights /> },
      { path: 'ads-sbs', element: <AdsSbs /> },
      { path: 'supply', element: <SupplyBoard /> },
      { path: 'stores', element: <StoresSearch /> },
      { path: 'stores/parts/:id', element: <PartDetail /> },
      { path: 'stores/issue', element: <IssueParts /> },
      { path: 'stores/receiving', element: <Receiving /> },
      { path: 'stores/receiving/:id', element: <ReceiptPage /> },
      { path: 'stores/quarantine', element: <Quarantine /> },
      { path: 'stores/us-returns', element: <UsReturns /> },
      { path: 'stores/transfers', element: <Transfers /> },
      { path: 'part-requests', element: <PartRequestList /> },
      { path: 'part-requests/new', element: <PartRequestForm /> },
      { path: 'part-requests/:id', element: <PartRequestPage /> },
      { path: 'procurement', element: <ProcurementBoard /> },
      { path: 'procurement/requisitions', element: <RequisitionList /> },
      { path: 'procurement/requisitions/new', element: <NewRequisition /> },
      { path: 'procurement/requisitions/:id', element: <RequisitionPage /> },
      { path: 'procurement/purchase-orders', element: <PurchaseOrderList /> },
      { path: 'procurement/purchase-orders/new', element: <NewPurchaseOrder /> },
      { path: 'procurement/purchase-orders/:id', element: <PurchaseOrderPage /> },
      { path: 'procurement/suppliers', element: <Suppliers /> },
      { path: 'procurement/outside-mro', element: <OutsideMroList /> },
      { path: 'procurement/outside-mro/:id', element: <OutsideMroPage /> },
      { path: 'people', element: <PeopleList /> },
      { path: 'people/:personId', element: <PersonRecordPage /> },
      { path: 'people/:personId/qualifications', element: <PersonQualificationsPage /> },
      { path: 'people/:personId/authorizations', element: <PersonAuthorizationsPage /> },
      { path: 'admin/users', element: <AdminUsers /> },
      { path: 'admin/users/new', element: <AdminCreateAccount /> },
      { path: 'admin/users/:personId', element: <AdminAccount /> },
      { path: 'ddls', element: <DdlsSheet /> },
      { path: 'nadds', element: <NaddList /> },
      { path: 'cabin-item', element: <CabinItem /> },
      { path: 'queries', element: <QueryList /> },
      { path: 'device', element: <DevicePage /> },
      { path: 'sync', element: <SyncQueue /> },
      { path: 'offline-signatures', element: <OfflineReview /> },
      { path: 'section/:dept/:page', element: <ComingSoon /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '/print/ddls/:id', element: <DdlsPrint /> },
  { path: '/print/nadds/:id', element: <NaddsPrint /> },
  { path: '/print/serviceability', element: <ServiceabilityPrint /> },
]);

export function App() {
  const { loading, session, me } = useAuth();

  if (loading) return <div className="center muted">Loading Nexus…</div>;
  if (!session) return <SignIn />;
  if (!me || me.status !== 'active') return <AccountNotActive />;
  if (me.mustChangePassword) return <SetPassword />;
  if (!me.pinSet) return <SetPin />;
  return <RouterProvider router={router} />;
}
