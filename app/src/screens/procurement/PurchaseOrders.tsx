// Purchase orders (list, raise, WF-K3 detail).
//
//   draft → ordered → shipped → IN CLEARING (customs, D-149) → arrived
//   (receiving inspection) → closed when everything is accepted into stock.
//   * Procurement ("Raise purchase orders") raises the PO from APPROVED
//     requisitions only, to a supplier on Quality's approved list (D-076,
//     D-148), agrees the price (cost) and signs the order with PIN.
//   * The ARRIVAL is registered by Supply: it opens the receiving inspection
//     linked to the PO and the part request, so acceptance reserves the part
//     for the engineer (D-074, D-145).
//   * D-075: the buyer can never receive the PO; the button is not offered
//     and the database refuses it.
//   * Prices, totals, last price and invoices only with "View cost" (D-077,
//     D-121, D-127): the server sends none to anyone else.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import { formatDateTime, formatPlainDate, heldFor } from '../../lib/format';
import { PinField } from '../../components/PinField';
import { BackButton, Crumbs, PageHead, Section } from '../../components/PageFrame';
import {
  Empty, Money, NoCostNote, PoChip, ProcurementTabs, ReqPriorityChip, qtyText, useProcurementRights, type Currency,
} from './common';
import { InvoicesSection, type Invoice } from './Invoices';
import type { ReqRow } from './Requisitions';

export type PoRow = {
  id: string; number: string; status: string; status_since: string; supplier_id: string; supplier_name: string;
  supplier_ref: string | null; eta: string | null; overdue: boolean; shipment_ref: string | null; clearing_ref: string | null;
  lines: number; first_line: string | null; tails: string | null; has_aog: boolean; raised_by_code: string;
  created_at: string; ordered_at: string | null; total: number | null; currency: string | null;
};

type PoLine = {
  id: string; line_no: number; status: string; qty: number; cancel_reason: string | null; part_id: string | null;
  part_number: string; description: string | null; unit: string | null; requisition_id: string; requisition_number: string;
  requisition_version: number; priority: string; store_code: string; kind: string; request_number: string | null;
  tail: string | null; received_qty: number; open_receipt_qty: number; unit_price: number | null; line_total: number | null;
  last_price: number | null; last_price_ref: string | null; price_flag: number | null;
};
// One PO. The list's "lines" is a count; the detail gives the lines themselves.
type PoDetailRaw = Omit<PoRow, 'lines'> & {
  supplier: { id: string; code: string; name: string; status: string; country: string | null; contact: string | null };
  note: string | null; ordered_by: string | null; cancel_reason: string | null;
  lines: PoLine[];
  receipts: { id: string; number: string; status: string; qty: number; store_code: string; line_id: string;
    opened_by: string; inspected_by: string | null; created_at: string; quarantine_reason: string | null }[];
  events: { event: string; note: string | null; eta: string | null; by: string | null; at: string }[];
  invoices: Invoice[] | null;
  can: { buy: boolean; receive: boolean; i_am_buyer: boolean; view_cost: boolean };
};

export function usePurchaseOrders(openOnly = true) {
  const [rows, setRows] = useState<PoRow[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('purchase_order_list', { p_open_only: openOnly });
    setError(err ? errorText(err) : '');
    setRows((data ?? []) as PoRow[]);
  }, [openOnly]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, reload: load };
}

// ------------------------------------------------------------------ table
export function PurchaseOrderTable({ rows, showCost, currency }: { rows: PoRow[]; showCost: boolean; currency: Currency }) {
  const navigate = useNavigate();
  const { display } = useAuth();
  const open = (p: PoRow) => navigate(`/procurement/purchase-orders/${p.id}`);
  return (
    <>
      <table className="board pq-table">
        <thead>
          <tr><th>PO</th><th>For</th><th>Supplier</th><th>ETA</th><th>State</th><th>Since</th>{showCost && <th>Value</th>}</tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} tabIndex={0} onClick={() => open(p)} onKeyDown={(e) => e.key === 'Enter' && open(p)}>
              <td><Link className="mono" to={`/procurement/purchase-orders/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.number}</Link>
                {p.has_aog && <> <span className="chip tone-aog">AOG</span></>}</td>
              <td>{p.first_line ?? '—'}{p.lines > 1 && <span className="small muted"> + {p.lines - 1} more</span>}
                {p.tails && <div className="small"><span className="tail">{p.tails}</span></div>}</td>
              <td>{p.supplier_name}</td>
              <td className="mono small">{p.eta ? formatPlainDate(p.eta, display) : '—'}</td>
              <td><PoChip status={p.status} overdue={p.overdue} /></td>
              <td className="mono small">{heldFor(p.status_since)}</td>
              {showCost && <td><Money value={p.total} currency={currency} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cards">
        {rows.map((p) => (
          <div key={p.id} className="card tail-card" role="link" tabIndex={0} onClick={() => open(p)} onKeyDown={(e) => e.key === 'Enter' && open(p)}>
            <div className="top"><span className="mono">{p.number}</span><PoChip status={p.status} overdue={p.overdue} /></div>
            <div className="pq-card-line">{p.first_line ?? ''}{p.lines > 1 && ` + ${p.lines - 1} more`}</div>
            <div className="small muted">{p.supplier_name}{p.eta && ` · ETA ${formatPlainDate(p.eta, display)}`}{p.tails && ` · ${p.tails}`}</div>
            {showCost && p.total !== null && <div className="small"><Money value={p.total} currency={currency} /></div>}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ list
export function PurchaseOrderList() {
  const { rights, label } = useProcurementRights();
  const [all, setAll] = useState(false);
  const { rows, error } = usePurchaseOrders(!all);
  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('purchase_order', true) }]} />
      <BackButton to="/procurement" label="Procurement board" />
      <ProcurementTabs />
      <PageHead title={label('purchase_order', true)} sub="Overdue first · ETA entered by Procurement, never predicted (D-020)">
        {rights.raise_po && <Link className="button" to="/procurement/purchase-orders/new">Raise purchase order</Link>}
      </PageHead>
      {error && <div className="error" role="alert">{error}</div>}
      <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show closed and cancelled too</label>
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0
        ? <div className="box"><div className="box-body"><Empty>No purchase orders.</Empty></div></div>
        : <PurchaseOrderTable rows={rows} showCost={rights.view_cost} currency={rights.currency} />}
      {!rights.view_cost && <NoCostNote />}
    </div>
  );
}

// Approved requisitions not yet on a PO (what Procurement can order).
function useApprovedRequisitions() {
  const [rows, setRows] = useState<ReqRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await anyActions.rpc('requisition_list', { p_id: null, p_open_only: true });
    setRows(((data ?? []) as ReqRow[]).filter((r) => r.status === 'approved' && !r.po_id));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { rows, reload: load };
}

type Supplier = { id: string; code: string; name: string; kind: string; status: string };
function useSuppliers(kind: 'parts' | 'mro') {
  const [list, setList] = useState<Supplier[]>([]);
  useEffect(() => {
    anyDb.from('supplier').select('id, code, name, kind, status').eq('status', 'approved').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setList((data ?? []).filter((s) => s.kind === 'both' || s.kind === kind)));
  }, [kind]);
  return list;
}
export { useSuppliers };

// ------------------------------------------------------------------ new PO
// /procurement/purchase-orders/new?req=<requisition id>
export function NewPurchaseOrder() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { rights, label } = useProcurementRights();
  const { rows } = useApprovedRequisitions();
  const suppliers = useSuppliers('parts');
  const [picked, setPicked] = useState<string[]>(params.get('req') ? [params.get('req')!] : []);
  const [f, setF] = useState({ supplier: '', ref: '', eta: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { data, error: err } = await anyActions.rpc('create_purchase_order', {
      p_supplier: f.supplier, p_requisitions: picked, p_supplier_ref: f.ref || null, p_eta: f.eta || null, p_note: f.note || null,
    });
    setBusy(false);
    if (err) return setError(errorText(err));
    const po = data as { id: string; number: string };
    navigate(`/procurement/purchase-orders/${po.id}`, { state: { message: `${po.number} raised as a draft. Enter the agreed prices, then place the order.` } });
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('purchase_order', true), to: '/procurement/purchase-orders' }, { label: 'New' }]} />
      <BackButton to="/procurement/purchase-orders" label={label('purchase_order', true)} />
      <PageHead title={`Raise ${label('purchase_order').toLowerCase()}`} sub="Only approved requisitions, only suppliers on Quality's approved list (D-076, D-148)" />
      {!rights.raise_po && <div className="note warn">You need Procurement with “Raise purchase orders” to raise a PO.</div>}
      <form className="pq-form" onSubmit={create}>
        <Section title="Approved requisitions to order">
          {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <Empty>No approved requisitions waiting for a PO.</Empty> : (
            <ul className="open-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <label className="check pq-pick">
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span className="mono">{r.number}</span>
                  </label>
                  <span>{qtyText(r.qty)} × {r.description ?? ''} <span className="mono small">{r.part_number}</span></span>
                  {r.tail && <span className="tail">{r.tail}</span>}
                  <ReqPriorityChip priority={r.priority} />
                  {rights.view_cost && r.estimated_value !== null && <span className="small">Est. <Money value={r.estimated_value} currency={rights.currency} /></span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Supplier and order">
          <div className="row pq-row">
            <div><label htmlFor="po-sup">Supplier (approved list, D-148)</label>
              <select id="po-sup" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} required>
                <option value="">Choose</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select></div>
            <div><label htmlFor="po-ref">Supplier's quote or reference</label><input id="po-ref" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></div>
            <div><label htmlFor="po-eta">ETA (as the supplier states)</label><input id="po-eta" type="date" value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} /></div>
          </div>
          <label htmlFor="po-note">Note</label>
          <input id="po-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="action-row"><button type="submit" disabled={busy || picked.length === 0 || !rights.raise_po}>{busy ? 'Raising…' : `Raise draft PO (${picked.length})`}</button></div>
        </Section>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ WF-K3
export function PurchaseOrderPage() {
  const { id } = useParams();
  const { display } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { rights, label } = useProcurementRights();
  const approved = useApprovedRequisitions();
  const [p, setP] = useState<PoDetailRaw | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceReason, setPriceReason] = useState('');
  const [pin, setPin] = useState('');
  const [ship, setShip] = useState({ status: '', eta: '', shipment: '', clearing: '', note: '' });
  const [recv, setRecv] = useState<{ line: string; qty: string; serial: string; batch: string; expiry: string; bin: string } | null>(null);
  const [cancel, setCancel] = useState({ open: false, reason: '', pin: '' });
  const [addReq, setAddReq] = useState('');

  useEffect(() => { setMessage((location.state as { message?: string } | null)?.message ?? ''); }, [location.state]);

  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('purchase_order_detail', { p_id: id });
    if (err) { setP(null); return; }
    setP(data as PoDetailRaw);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (p === undefined) return <div className="page muted">Loading…</div>;
  if (p === null) return <div className="page"><p>This purchase order does not exist or you may not see it.</p></div>;

  const draft = p.status === 'draft';
  const live = ['ordered', 'shipped', 'in_clearing'].includes(p.status);
  const done = (m: string) => { setMessage(m); setError(''); load(); approved.reload(); };
  const fail = (err: unknown) => setError(errorText(err as { message?: string }));

  async function savePrice(line: PoLine) {
    const v = prices[line.id];
    if (v === undefined || v === '') return;
    const { error: err } = await anyActions.rpc('set_po_line_price', { p_line: line.id, p_unit_price: Number(v), p_reason: draft ? null : priceReason });
    if (err) return fail(err);
    setPrices({ ...prices, [line.id]: '' });
    done(`Line ${line.line_no}: price recorded`);
  }
  async function place(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await anyActions.rpc('place_purchase_order', { p_po: p!.id, p_pin: pin });
    if (err) return fail(err);
    setPin('');
    done(`${p!.number} ordered`);
  }
  async function updateShipping(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await anyActions.rpc('update_purchase_order', {
      p_po: p!.id, p_status: ship.status || null, p_eta: ship.eta || null, p_shipment_ref: ship.shipment || null,
      p_clearing_ref: ship.clearing || null, p_note: ship.note || null,
    });
    if (err) return fail(err);
    setShip({ status: '', eta: '', shipment: '', clearing: '', note: '' });
    done('Updated');
  }
  async function receive(e: FormEvent) {
    e.preventDefault();
    if (!recv) return;
    const { data, error: err } = await anyActions.rpc('receive_po_delivery', {
      p_line: recv.line, p_qty: recv.qty ? Number(recv.qty) : null, p_serial: recv.serial || null, p_batch: recv.batch || null,
      p_expiry: recv.expiry || null, p_bin: recv.bin || null, p_part: null,
    });
    if (err) return fail(err);
    navigate(`/stores/receiving/${data as string}`);
  }
  async function removeLine(line: PoLine) {
    const reason = window.prompt(`Why take ${line.requisition_number} off this PO?`);
    if (!reason) return;
    const { error: err } = await anyActions.rpc('remove_po_line', { p_line: line.id, p_reason: reason });
    if (err) return fail(err);
    done(`${line.requisition_number} taken off; it is back to “approved · sourcing”`);
  }
  async function addLine() {
    if (!addReq) return;
    const { error: err } = await anyActions.rpc('add_po_line', { p_po: p!.id, p_req: addReq });
    if (err) return fail(err);
    setAddReq('');
    done('Requisition added');
  }
  async function doCancel(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await anyActions.rpc('cancel_purchase_order', { p_po: p!.id, p_reason: cancel.reason, p_pin: cancel.pin });
    if (err) return fail(err);
    setCancel({ open: false, reason: '', pin: '' });
    done(`${p!.number} cancelled; its requisitions go back to Procurement to re-source`);
  }

  const openLines = p.lines.filter((l) => l.status !== 'cancelled');
  const canBuy = p.can.buy;
  const cur = rights.currency;

  return (
    <div className="page pq-page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: label('purchase_order', true), to: '/procurement/purchase-orders' }, { label: <span className="mono">{p.number}</span> }]} />
      <BackButton to="/procurement/purchase-orders" label={label('purchase_order', true)} />
      <PageHead title={<><span className="mono">{p.number}</span> · {p.supplier.name}</>}
        sub={<>{label('purchase_order')} · raised by <span className="mono">{p.raised_by_code}</span> · {formatDateTime(p.created_at, display)}</>}>
        <PoChip status={p.status} overdue={p.overdue} />
      </PageHead>
      {message && <div className="success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <Section title="Order">
        <dl className="facts">
          <dt>Supplier</dt><dd>{p.supplier.name} <span className="mono small">{p.supplier.code}</span>
            {p.supplier.status !== 'approved' && <> <span className="chip tone-red">{p.supplier.status} by Quality</span></>}</dd>
          {p.supplier_ref && <><dt>Supplier ref</dt><dd className="mono">{p.supplier_ref}</dd></>}
          <dt>ETA</dt><dd>{p.eta ? formatPlainDate(p.eta, display) : '—'}{p.overdue && <span className="danger-text"> · overdue</span>}</dd>
          {p.ordered_at && <><dt>Ordered</dt><dd><span className="mono">{p.ordered_by}</span> · {formatDateTime(p.ordered_at, display)}</dd></>}
          <dt>Shipment, clearing and forwarding</dt><dd>
            {p.shipment_ref ? <>Shipment <span className="mono">{p.shipment_ref}</span></> : 'No shipment reference yet'}
            {p.clearing_ref && <> · Clearing <span className="mono">{p.clearing_ref}</span></>}
            {p.status === 'in_clearing' && <> · in customs since {formatDateTime(p.status_since, display)} ({heldFor(p.status_since)})</>}</dd>
          {p.note && <><dt>Note</dt><dd>{p.note}</dd></>}
          {p.can.view_cost && <><dt>Order value</dt><dd><Money value={p.total} currency={cur} /></dd></>}
          {p.cancel_reason && <><dt>Cancelled</dt><dd>{p.cancel_reason}</dd></>}
        </dl>
      </Section>

      <Section title={`Lines (${openLines.length})`}>
        <ul className="st-cards pq-lines">
          {p.lines.map((l) => (
            <li key={l.id} className={`pq-line${l.status === 'cancelled' ? ' superseded' : ''}`}>
              <div className="pq-line-top">
                <span className="mono">{l.line_no}.</span>
                <span>{qtyText(l.qty)} {l.unit ?? ''} × {l.description ?? ''} <span className="mono small">{l.part_number}</span></span>
                <Link className="mono small" to={`/procurement/requisitions/${l.requisition_id}`}>{l.requisition_number}{l.requisition_version > 1 ? ` v${l.requisition_version}` : ''}</Link>
                {l.tail && <span className="tail">{l.tail}</span>}
                {l.request_number && <span className="small muted">for {l.request_number}</span>}
                <ReqPriorityChip priority={l.priority} />
                <span className="dept-tag">{l.store_code}</span>
                {l.status === 'received' && <span className="chip tone-green">Received</span>}
                {l.status === 'cancelled' && <span className="chip tone-grey">Taken off · {l.cancel_reason}</span>}
                {l.status === 'open' && !draft && <span className="small muted">Received {qtyText(l.received_qty)} of {qtyText(l.qty)}</span>}
              </div>
              {p.can.view_cost && (
                <div className="pq-line-cost small">
                  Agreed unit price: <Money value={l.unit_price} currency={cur} />
                  {l.line_total !== null && <> · line <Money value={l.line_total} currency={cur} /></>}
                  {l.last_price !== null && <> · last paid <Money value={l.last_price} currency={cur} /> on <span className="mono">{l.last_price_ref}</span></>}
                  {l.price_flag !== null && <span className="chip tone-amber">{l.price_flag}% above last price (R-4)</span>}
                </div>
              )}
              {canBuy && p.can.view_cost && l.status === 'open' && p.status !== 'closed' && p.status !== 'cancelled' && (
                <div className="pq-inline-row">
                  <label className="visually-hidden" htmlFor={`pr-${l.id}`}>Agreed unit price</label>
                  <input id={`pr-${l.id}`} inputMode="decimal" placeholder={`Unit price (${cur.code})`} value={prices[l.id] ?? ''}
                    onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value.replace(/[^0-9.]/g, '') })} />
                  {!draft && <input aria-label="Reason the price changed" placeholder="Reason (renegotiation)" value={priceReason} onChange={(e) => setPriceReason(e.target.value)} />}
                  <button type="button" className="secondary" onClick={() => savePrice(l)}>{l.unit_price === null ? 'Set price' : 'Change price'}</button>
                  {draft && <button type="button" className="link-button" onClick={() => removeLine(l)}>Take off PO</button>}
                </div>
              )}
              {l.status === 'open' && ['ordered', 'shipped', 'in_clearing', 'delivered'].includes(p.status) && (
                p.can.receive && l.open_receipt_qty < l.qty ? (
                  recv?.line === l.id ? (
                    <form className="pq-form pq-inline" onSubmit={receive}>
                      <div className="row pq-row">
                        <div><label htmlFor="rv-qty">Quantity arrived</label><input id="rv-qty" inputMode="decimal" value={recv.qty} onChange={(e) => setRecv({ ...recv, qty: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
                        <div><label htmlFor="rv-sn">Serial number</label><input id="rv-sn" value={recv.serial} onChange={(e) => setRecv({ ...recv, serial: e.target.value })} /></div>
                        <div><label htmlFor="rv-b">Batch</label><input id="rv-b" value={recv.batch} onChange={(e) => setRecv({ ...recv, batch: e.target.value })} /></div>
                      </div>
                      <div className="row pq-row">
                        <div><label htmlFor="rv-exp">Shelf life ends (if any)</label><input id="rv-exp" type="date" value={recv.expiry} onChange={(e) => setRecv({ ...recv, expiry: e.target.value })} /></div>
                        <div><label htmlFor="rv-bin">Bin</label><input id="rv-bin" value={recv.bin} onChange={(e) => setRecv({ ...recv, bin: e.target.value })} /></div>
                      </div>
                      <div className="action-row"><button type="submit">Register arrival · start receiving inspection</button>
                        <button type="button" className="secondary" onClick={() => setRecv(null)}>Cancel</button></div>
                    </form>
                  ) : (
                    <div className="action-row"><button type="button" onClick={() => setRecv({ line: l.id, qty: String(l.qty - l.open_receipt_qty), serial: '', batch: '', expiry: '', bin: '' })}>Mark arrived (to receiving)</button></div>
                  )
                ) : p.can.i_am_buyer && rights.receive ? (
                  <p className="small muted">You bought this, so another storekeeper receives it (D-075).</p>
                ) : null
              )}
            </li>
          ))}
        </ul>
        {draft && canBuy && approved.rows && approved.rows.length > 0 && (
          <div className="pq-inline-row">
            <label className="visually-hidden" htmlFor="po-add">Add an approved requisition</label>
            <select id="po-add" value={addReq} onChange={(e) => setAddReq(e.target.value)}>
              <option value="">Add an approved requisition…</option>
              {approved.rows.map((r) => <option key={r.id} value={r.id}>{r.number} · {qtyText(r.qty)} × {r.description ?? r.part_number}</option>)}
            </select>
            <button type="button" className="secondary" onClick={addLine} disabled={!addReq}>Add</button>
          </div>
        )}
        {!['closed', 'cancelled'].includes(p.status) && !p.can.receive && !canBuy && (
          <p className="small muted">Supply registers the arrival and does the receiving inspection (D-074).</p>
        )}
      </Section>

      {draft && canBuy && (
        <Section title="Place the order">
          <form className="pq-form" onSubmit={place}>
            <p className="small">Every line needs its agreed price; the supplier must still be on Quality's approved list (D-148).</p>
            <PinField value={pin} onChange={setPin} id="po-pin" />
            <div className="action-row"><button type="submit">Sign and place order</button></div>
          </form>
        </Section>
      )}

      {live && canBuy && (
        <Section title="Shipment, clearing and forwarding">
          <form className="pq-form" onSubmit={updateShipping}>
            <div className="row pq-row">
              <div><label htmlFor="sh-st">Move to</label>
                <select id="sh-st" value={ship.status} onChange={(e) => setShip({ ...ship, status: e.target.value })}>
                  <option value="">(no change)</option>
                  {p.status === 'ordered' && <option value="shipped">Shipped</option>}
                  {p.status !== 'in_clearing' && <option value="in_clearing">In clearing (customs, D-149)</option>}
                </select></div>
              <div><label htmlFor="sh-eta">ETA</label><input id="sh-eta" type="date" value={ship.eta} onChange={(e) => setShip({ ...ship, eta: e.target.value })} /></div>
            </div>
            <div className="row pq-row">
              <div><label htmlFor="sh-ref">Shipment ref (AWB, tracking)</label><input id="sh-ref" value={ship.shipment} onChange={(e) => setShip({ ...ship, shipment: e.target.value })} /></div>
              <div><label htmlFor="sh-clr">Clearing ref (customs entry, agent)</label><input id="sh-clr" value={ship.clearing} onChange={(e) => setShip({ ...ship, clearing: e.target.value })} /></div>
            </div>
            <label htmlFor="sh-note">Note</label>
            <input id="sh-note" value={ship.note} onChange={(e) => setShip({ ...ship, note: e.target.value })} />
            <div className="action-row"><button type="submit">Update</button></div>
          </form>
        </Section>
      )}

      {p.can.view_cost && (
        <Section title="Invoices">
          <InvoicesSection invoices={p.invoices} currency={cur} canRecord={canBuy && p.status !== 'draft' && p.status !== 'cancelled'}
            purchaseOrderId={p.id} onChange={load} />
        </Section>
      )}

      {p.receipts.length > 0 && (
        <Section title="Receiving">
          <ul className="open-list">
            {p.receipts.map((r) => (
              <li key={r.id}>
                <Link className="mono" to={`/stores/receiving/${r.id}`}>{r.number}</Link>
                <span>{qtyText(r.qty)} at {r.store_code}</span>
                <span className={`chip tone-${r.status === 'accepted' ? 'green' : r.status === 'quarantined' ? 'red' : 'amber'}`}>
                  {{ inspecting: 'Receiving inspection', awaiting_ack: 'Main Store to acknowledge', accepted: 'Accepted to stock', quarantined: 'Quarantined' }[r.status] ?? r.status}</span>
                <span className="small muted">opened by <span className="mono">{r.opened_by}</span>{r.inspected_by && <> · inspected by <span className="mono">{r.inspected_by}</span></>}</span>
                {r.quarantine_reason && <span className="small">{r.quarantine_reason}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Timeline">
        <ol className="timeline">
          {p.events.map((e, i) => (
            <li key={i}><strong>{e.event}</strong>{e.note && ` · ${e.note}`}{e.eta && ` · ETA ${formatPlainDate(e.eta, display)}`}
              <span className="small muted"> · {e.by && <span className="mono">{e.by}</span>} {formatDateTime(e.at, display)}</span></li>
          ))}
        </ol>
      </Section>

      {canBuy && ['draft', 'ordered', 'shipped', 'in_clearing'].includes(p.status) && p.receipts.length === 0 && (
        cancel.open ? (
          <Section title="Cancel purchase order">
            <form className="pq-form" onSubmit={doCancel}>
              <label htmlFor="po-cr">Reason</label>
              <input id="po-cr" value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} required />
              <PinField value={cancel.pin} onChange={(v) => setCancel({ ...cancel, pin: v })} id="po-cpin" />
              <div className="action-row"><button type="submit" className="danger-button">Cancel PO</button>
                <button type="button" className="secondary" onClick={() => setCancel({ open: false, reason: '', pin: '' })}>Keep it</button></div>
            </form>
          </Section>
        ) : <div className="action-row"><button type="button" className="secondary" onClick={() => setCancel({ ...cancel, open: true })}>Cancel purchase order</button></div>
      )}
      {!p.can.view_cost && <NoCostNote />}
    </div>
  );
}
