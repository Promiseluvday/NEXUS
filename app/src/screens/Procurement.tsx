// Procurement (Phase 2, area E): one place to import every procurement
// screen from. Database rules are in migration 0030 (procurement).
//
// Routes (children of the app frame in App.tsx):
//   /procurement                          ProcurementBoard     DeptProcurement (Procurement home)
//   /procurement/requisitions             RequisitionList      WF-K1 (Procurement and Supply)
//   /procurement/requisitions/new         NewRequisition       ?line=<part request line> | ?us_return=<id> | ?kind=replenishment
//   /procurement/requisitions/:id         RequisitionPage      WF-K2 (approve / reject with PIN here too)
//   /procurement/purchase-orders          PurchaseOrderList
//   /procurement/purchase-orders/new      NewPurchaseOrder     ?req=<requisition id>
//   /procurement/purchase-orders/:id      PurchaseOrderPage    WF-K3
//   /procurement/suppliers                Suppliers            approved supplier list (Quality maintains, D-148)
//   /procurement/outside-mro              OutsideMroList       WF-MRO1
//   /procurement/outside-mro/:id          OutsideMroPage       WF-MRO2
//
// For other screens:
//   RaiseRepairRequisitionLink   the U/S returns "Raise repair requisition" button
//   RaiseRequisitionForm         the raise form as a panel (kind, lineId / usReturnId)
//   REQUISITION_ACTION_TYPES     approval action types to group as "Requisitions"
//   requisitionPath(id)          where an approval or a request line links to
import { Link } from 'react-router';

export { ProcurementBoard } from './procurement/Board';
export {
  NewRequisition, RaiseRequisitionForm, RequisitionList, RequisitionPage, RequisitionTable, REQUISITION_ACTION_TYPES,
  useRequisitions,
} from './procurement/Requisitions';
export { NewPurchaseOrder, PurchaseOrderList, PurchaseOrderPage } from './procurement/PurchaseOrders';
export { Suppliers } from './procurement/Suppliers';
export { OutsideMroList, OutsideMroPage } from './procurement/OutsideMro';
export { useProcurementRights } from './procurement/common';

export function requisitionPath(requisitionId: string): string {
  return `/procurement/requisitions/${requisitionId}`;
}

// For stores/Supply.tsx (U/S returns): replaces the disabled button.
// A repair requisition needs the U/S part received and tagged first; the
// database checks that, and that the person may raise requisitions for the
// store (Supply with "Raise requisitions", D-121, D-152).
export function RaiseRepairRequisitionLink({ usReturnId, received }: { usReturnId: string; received: boolean }) {
  if (!received) {
    return <button type="button" className="secondary" disabled title="Receive and tag the part first">Raise repair requisition</button>;
  }
  return <Link className="button secondary" to={`/procurement/requisitions/new?us_return=${usReturnId}`}>Raise repair requisition</Link>;
}
