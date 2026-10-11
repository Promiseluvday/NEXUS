// Procurement board (DeptProcurement): the Procurement home view (D-120).
//   * Tiles: AOG requisitions, awaiting approval, approved waiting for a PO,
//     in clearing (customs, D-149), overdue deliveries, outside-MRO jobs.
//   * Requisitions with their approval step and how long it has been held
//     ("Blocked by", D-006, D-094).
//   * Purchase orders, overdue first, with ETA as entered (never predicted,
//     D-020). Costs only with "View cost" (D-077, D-121, D-127).
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { PageHead, Section, Crumbs } from '../../components/PageFrame';
import { Empty, NoCostNote, ProcurementTabs, useProcurementRights } from './common';
import { RequisitionTable, useRequisitions } from './Requisitions';
import { PurchaseOrderTable, usePurchaseOrders } from './PurchaseOrders';
import { useOutsideMroJobs } from './OutsideMro';

export function ProcurementBoard() {
  const { display } = useAuth();
  const { rights, label } = useProcurementRights();
  const { rows: reqs } = useRequisitions(true);
  const { rows: pos } = usePurchaseOrders(true);
  const { rows: jobs } = useOutsideMroJobs(true);

  const r = reqs ?? [];
  const p = pos ?? [];
  const aog = r.filter((x) => x.priority === 'AOG' && ['in_approval', 'approved', 'ordered'].includes(x.status));
  const inApproval = r.filter((x) => x.status === 'in_approval');
  const toOrder = r.filter((x) => x.status === 'approved' && !x.po_id);
  const clearing = p.filter((x) => x.status === 'in_clearing');
  const overdue = p.filter((x) => x.overdue);

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Procurement board' }]} />
      <PageHead title="Procurement board" sub={`${formatDateTime(new Date(), display)} · AOG first`}>
        {rights.raise_po && <Link className="button" to="/procurement/purchase-orders/new">Raise PO</Link>}
        <Link className="button outline-button" to="/procurement/purchase-orders">Update ETA</Link>
      </PageHead>
      <ProcurementTabs />

      <div className="tiles pq-tiles">
        <Link className="tile" to="/procurement/requisitions"><span className={`tile-n${aog.length ? ' warn' : ''}`}>{aog.length}</span><span className="tile-l">AOG requisitions</span></Link>
        <Link className="tile" to="/procurement/requisitions"><span className="tile-n">{inApproval.length}</span><span className="tile-l">Awaiting approval</span></Link>
        <Link className="tile" to="/procurement/purchase-orders/new"><span className={`tile-n${toOrder.length ? ' warn' : ''}`}>{toOrder.length}</span><span className="tile-l">Approved · to order</span></Link>
        <Link className="tile" to="/procurement/purchase-orders"><span className="tile-n">{clearing.length}</span><span className="tile-l">In clearing (customs)</span></Link>
        <Link className="tile" to="/procurement/purchase-orders"><span className={`tile-n${overdue.length ? ' warn' : ''}`}>{overdue.length}</span><span className="tile-l">Overdue deliveries</span></Link>
        <Link className="tile" to="/procurement/outside-mro"><span className="tile-n">{(jobs ?? []).length}</span><span className="tile-l">Outside-MRO jobs open</span></Link>
      </div>

      <Section title={`${label('requisition', true)} with approval step`} actions={<Link to="/procurement/requisitions">All {label('requisition', true).toLowerCase()}</Link>}>
        {reqs === null ? <p className="muted">Loading…</p> : r.length === 0 ? <Empty>No open requisitions.</Empty>
          : <RequisitionTable rows={r} showCost={rights.view_cost} currency={rights.currency} />}
      </Section>

      <Section title={`${label('purchase_order', true)} · overdue first`} actions={<Link to="/procurement/purchase-orders">All</Link>}>
        {pos === null ? <p className="muted">Loading…</p> : p.length === 0 ? <Empty>No open purchase orders.</Empty>
          : <PurchaseOrderTable rows={p} showCost={rights.view_cost} currency={rights.currency} />}
      </Section>

      <Section title="Outside-MRO jobs" actions={<Link to="/procurement/outside-mro">All</Link>}>
        {jobs === null ? <p className="muted">Loading…</p> : jobs.length === 0 ? <Empty>No open outside-MRO jobs.</Empty> : (
          <ul className="open-list">
            {jobs.map((j) => (
              <li key={j.id}><Link className="mono" to={`/procurement/outside-mro/${j.id}`}>{j.number}</Link>
                <span>{j.title}</span>{j.tail && <span className="tail">{j.tail}</span>}
                <span className="small muted">{j.supplier_name}</span>
                {j.overdue && <span className="chip tone-red">Overdue</span>}</li>
            ))}
          </ul>
        )}
      </Section>
      {!rights.view_cost && <NoCostNote />}
    </div>
  );
}
