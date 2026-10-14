// Shared pieces for the procurement screens (Phase 2, area E).
//
// The database does all the checking (migration 0030, procurement); these
// helpers only load data and show it in words:
//   * useProcurementRights  what the signed-in person may do, the currency
//                           and the operator's document names (D-149)
//   * Money                 a price, or nothing at all for people who may
//                           not see cost (the server already sends no price
//                           to them, D-077, D-121, D-127)
//   * chips                 requisition, PO and outside-MRO states as words
//                           with a colour (D-091)
//   * ProcurementTabs       the section tabs
//
// The new database functions are not in database.types.ts yet, so these
// screens use the untyped client (anyActions) from lib/supabase.
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions } from '../../lib/supabase';
import '../../styles/p2-procurement.css';

export type Currency = { code: string; symbol?: string; decimals?: number; name?: string };

export type Rights = {
  view_cost: boolean; raise_requisition: boolean; receive: boolean; raise_po: boolean; manage_mro: boolean;
  maintain_suppliers: boolean; technical_acceptance: boolean; see_purchase_orders: boolean;
  stores: string[]; currency: Currency; labels: Record<string, string>;
};

const NO_RIGHTS: Rights = {
  view_cost: false, raise_requisition: false, receive: false, raise_po: false, manage_mro: false,
  maintain_suppliers: false, technical_acceptance: false, see_purchase_orders: false,
  stores: [], currency: { code: 'XXX' }, labels: {},
};

// Default document names; the operator's own terms come from the setting
// "labels.documents" (D-149).
const DEFAULT_LABELS: Record<string, string> = {
  part_request: 'Part request', requisition: 'Requisition', purchase_order: 'Purchase order',
  issue_voucher: 'Issue voucher', stock_receipt: 'Receiving record', outside_mro_job: 'Outside-MRO job',
  supplier_invoice: 'Invoice',
};

// Kept for the session so every screen does not ask again; per user.
let cached: { userId: string; rights: Rights } | null = null;

export function useProcurementRights(): { rights: Rights; loaded: boolean; label: (key: string, plural?: boolean) => string } {
  const { me } = useAuth();
  const mine = cached && me && cached.userId === me.userId ? cached.rights : null;
  const [rights, setRights] = useState<Rights>(mine ?? NO_RIGHTS);
  const [loaded, setLoaded] = useState(Boolean(mine));
  useEffect(() => {
    if (!me) return;
    anyActions.rpc('my_procurement_rights').then(({ data }: { data: Rights | null }) => {
      if (data) {
        const r = { ...NO_RIGHTS, ...data };
        cached = { userId: me.userId, rights: r };
        setRights(r);
      }
      setLoaded(true);
    });
  }, [me]);
  const label = (key: string, plural = false) => {
    const l = rights.labels?.[key] ?? DEFAULT_LABELS[key] ?? key;
    return plural ? `${l}s` : l;
  };
  return { rights, loaded, label };
}

// A price in the operator's currency. Null (no "View cost") shows nothing.
export function money(value: number | string | null | undefined, c: Currency): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  const decimals = c.decimals ?? 2;
  const s = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${c.symbol ?? ''}${c.symbol ? '' : `${c.code} `}${s}`.trim();
}

export function Money({ value, currency }: { value: number | string | null | undefined; currency: Currency }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return <span className="mono pq-money">{money(value, currency)}</span>;
}

// For screens where cost is hidden: say why, once (D-121, D-127).
export function NoCostNote() {
  return <p className="small muted pq-nocost">Prices are shown only to people with “View cost”.</p>;
}

// ---------------------------------------------------------------- states
const REQ_TONE: Record<string, string> = {
  in_approval: 'amber', approved: 'blue', ordered: 'blue', received: 'green', rejected: 'red', cancelled: 'grey',
};
export function RequisitionChip({ status, stage }: { status: string; stage?: string }) {
  return <span className={`chip tone-${REQ_TONE[status] ?? 'grey'}`}>{stage ?? status.replace('_', ' ')}</span>;
}

export const PO_STATE: Record<string, { label: string; tone: string }> = {
  draft:       { label: 'Draft', tone: 'grey' },
  ordered:     { label: 'Ordered', tone: 'blue' },
  shipped:     { label: 'Shipped · in transit', tone: 'blue' },
  in_clearing: { label: 'In clearing (customs)', tone: 'amber' },
  delivered:   { label: 'Arrived · receiving inspection', tone: 'amber' },
  closed:      { label: 'Closed · received', tone: 'green' },
  cancelled:   { label: 'Cancelled', tone: 'grey' },
};
export function PoChip({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = PO_STATE[status] ?? { label: status, tone: 'grey' };
  return (
    <span className="pq-chips">
      <span className={`chip tone-${s.tone}`}>{s.label}</span>
      {overdue && <span className="chip tone-red">Overdue</span>}
    </span>
  );
}

export const MRO_STATE: Record<string, { label: string; tone: string }> = {
  quoting:   { label: 'Quoting', tone: 'amber' },
  agreed:    { label: 'Cost agreed', tone: 'blue' },
  in_work:   { label: 'In work at MRO', tone: 'blue' },
  returned:  { label: 'Returned', tone: 'green' },
  closed:    { label: 'Closed', tone: 'grey' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};
export function MroChip({ status }: { status: string }) {
  const s = MRO_STATE[status] ?? { label: status, tone: 'grey' };
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function ReqPriorityChip({ priority }: { priority: string }) {
  return priority === 'AOG' ? <span className="chip tone-aog">AOG</span> : <span className="chip tone-grey">Routine</span>;
}

// ------------------------------------------------------------------ tabs
export function ProcurementTabs() {
  const { rights, label } = useProcurementRights();
  const tabs = [
    { to: '/procurement', label: 'Board', end: true, show: rights.see_purchase_orders },
    { to: '/procurement/requisitions', label: label('requisition', true), show: true },
    { to: '/procurement/purchase-orders', label: label('purchase_order', true), show: rights.see_purchase_orders },
    { to: '/procurement/suppliers', label: 'Suppliers', show: rights.see_purchase_orders || rights.maintain_suppliers },
    { to: '/procurement/outside-mro', label: 'Outside-MRO jobs', show: true },
  ].filter((t) => t.show);
  return (
    <nav aria-label="Procurement sections" className="tail-tabs">
      {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.end ?? false}>{t.label}</NavLink>)}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted pq-empty">{children}</p>;
}

export function qtyText(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}

// Today as YYYY-MM-DD (dates compared, nothing predicted, D-020).
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
