// Parts and stores (Phase 2, area D): one place to import every stores
// screen from. Database rules are in migration 0029 (parts_stores).
//
// Routes (children of the app frame in App.tsx):
//   /supply                    SupplyBoard          Supply home (DeptSupply)
//   /stores                    StoresSearch         WF-I1
//   /stores/parts/:id          PartDetail           WF-I2
//   /stores/issue              IssueParts           WF-J1
//   /stores/receiving          Receiving            WF-J2 list + new receipt; WF-FWD1 with ?store=FWD
//   /stores/receiving/:id      ReceiptPage          WF-J2 one inspection
//   /stores/quarantine         Quarantine           WF-J3
//   /stores/us-returns         UsReturns            WF-J4
//   /stores/transfers          Transfers            WF-TR1
//   /part-requests             PartRequestList      WF-C3 (?aircraft=<id> for one tail)
//   /part-requests/new         PartRequestForm      WF-I3 (?part= &aircraft= &wo= &store=)
//   /part-requests/:id         PartRequestPage      WF-I4
//
// For other screens:
//   usePartRequestSummary(aircraftId)   counts for the aircraft page tile
//   PartRequestsForWorkOrder            panel for the work order page
export { StoresSearch, PartDetail } from './stores/Search';
export {
  PartRequestForm, PartRequestList, PartRequestPage, PartRequestsForWorkOrder, RequestLinesTable,
} from './stores/Requests';
export { SupplyBoard, IssueParts, Quarantine, UsReturns } from './stores/Supply';
export { Receiving, ReceiptPage } from './stores/Receiving';
export { Transfers } from './stores/Transfers';
export { usePartRequestSummary, usePartRequestLines, LineStateChip, PriorityChip } from './stores/common';
