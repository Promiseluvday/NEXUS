// Shared pieces for the parts and stores screens (Phase 2, area D).
//
// The database does all the checking (migration 0029); these helpers only
// load data and show it in words:
//   * LINE_STATE   what each part request line state means, with its colour
//   * StoresTabs   the stores section tabs from the wireframes (WF-J1 ... WF-FWD1)
//   * useMyStores  the stores this user holds (D-152)
//   * usePartRequestLines / usePartRequestSummary   lists and counts for a tail
//     or a work order, with who holds each line and since when (D-094)
//
// The new database functions are not in database.types.ts yet, so these
// screens use the untyped client (anyActions / anyDb) from lib/supabase.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../../lib/auth';
import { anyActions, anyDb, errorText } from '../../lib/supabase';
import '../../styles/p2-stores.css';

export type Store = { code: string; name: string; is_store_of_record: boolean };

export type RequestLine = {
  line_id: string; request_id: string; request_number: string; line_no: number; request_type: string;
  aircraft_id: string | null; tail: string | null; work_order_id: string | null; work_order_number: string | null;
  work_order_status: string | null; purpose: string | null; store_code: string; store_name: string;
  part_id: string | null; part_number: string; description: string | null; unit: string | null;
  qty: number; priority: 'AOG' | 'URGENT' | 'ROUTINE'; aog_confirmed: boolean; request_status: string;
  state: string; state_reason: string | null; holder: string | null; held_since: string;
  lot_id: string | null; bin: string | null; serial_no: string | null; batch_no: string | null;
  lot_problem: string | null; issue_voucher: string | null; requested_by_code: string; requested_at: string;
  required_by: string | null; fit_position: string | null; ipc_ref: string | null; removed_part: string;
  remarks: string | null; split_from: string | null; requisition_id: string | null;
};

// Part request line states in words (workflows/part-request.md §4).
export const LINE_STATE: Record<string, { label: string; tone: string }> = {
  submitted:         { label: 'Waiting for Supply', tone: 'amber' },
  reserved:          { label: 'Reserved, awaiting issue', tone: 'blue' },
  needs_requisition: { label: 'Not in stock · requisition needed', tone: 'red' },
  on_order:          { label: 'On order', tone: 'amber' },
  issued:            { label: 'Issued', tone: 'green' },
  returning:         { label: 'Being returned to stores', tone: 'amber' },
  fitted:            { label: 'Closed · fitted / used', tone: 'grey' },
  returned:          { label: 'Closed · returned unused', tone: 'grey' },
  cancelled:         { label: 'Cancelled', tone: 'grey' },
};

export function lineStateLabel(l: Pick<RequestLine, 'state' | 'work_order_status'>): string {
  // D-068: reserved before the work order is approved; issue waits for it.
  if (l.state === 'reserved' && (l.work_order_status === 'requested' || l.work_order_status === 'pre_approved')) {
    return 'Reserved · issue after WO approval';
  }
  return LINE_STATE[l.state]?.label ?? l.state;
}

export function LineStateChip({ line }: { line: Pick<RequestLine, 'state' | 'work_order_status'> }) {
  const s = LINE_STATE[line.state] ?? { tone: 'grey' };
  return <span className={`chip tone-${s.tone}`}>{lineStateLabel(line)}</span>;
}

// AOG / Urgent / Routine. Unconfirmed AOG says so (D-147).
export function PriorityChip({ priority, confirmed }: { priority: string; confirmed?: boolean }) {
  if (priority === 'AOG') {
    return confirmed
      ? <span className="chip tone-aog">AOG</span>
      : <span className="chip tone-red" title="Waiting for the tail to be set U/S or AOG, or a certifying engineer">AOG · unconfirmed</span>;
  }
  if (priority === 'URGENT') return <span className="chip tone-amber">Urgent</span>;
  return <span className="chip tone-grey">Routine</span>;
}

// Stock condition and certificate, always as words (D-091).
export function StockFlags({ condition, certificate, expiresOn, cautionDays = 30 }: {
  condition: string; certificate: string; expiresOn: string | null; cautionDays?: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const caution = new Date(Date.now() + cautionDays * 86400000).toISOString().slice(0, 10);
  return (
    <span className="st-flags">
      {condition === 'quarantine' && <span className="chip tone-amber">Quarantine</span>}
      {condition === 'unserviceable' && <span className="chip tone-red">U/S</span>}
      {certificate !== 'valid' && <span className="chip tone-red">No certificate</span>}
      {expiresOn && expiresOn < today && <span className="chip tone-red">Shelf life ended</span>}
      {expiresOn && expiresOn >= today && expiresOn <= caution && <span className="chip tone-amber">Shelf life ends soon</span>}
    </span>
  );
}

// The stores this user holds by grant (D-152). Read access for oversight is
// not "holding" a store, so they see stock but get no store actions.
export function useMyStores(): { stores: Store[]; held: string[]; loaded: boolean } {
  const { me } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!me) return;
    Promise.all([
      anyDb.from('store').select('code, name, is_store_of_record').order('is_store_of_record', { ascending: false }),
      anyDb.from('access_grant').select('store_code').eq('person_id', me.personId).eq('grant_type', 'store').is('revoked_at', null),
    ]).then(([s, g]) => {
      setStores((s.data ?? []) as Store[]);
      setHeld(((g.data ?? []) as { store_code: string }[]).map((x) => x.store_code));
      setLoaded(true);
    });
  }, [me]);
  return { stores, held, loaded };
}

// What the person may do in stores. The database checks again on every action.
export function useSupplyRights() {
  const { me } = useAuth();
  const [perms, setPerms] = useState<string[]>([]);
  useEffect(() => {
    if (!me) return;
    anyDb.from('access_grant').select('permission_code').eq('person_id', me.personId)
      .eq('grant_type', 'permission').is('revoked_at', null)
      .then(({ data }: { data: { permission_code: string }[] | null }) => setPerms((data ?? []).map((p) => p.permission_code)));
  }, [me]);
  const supply = Boolean(me?.departments.some((d) => d.code === 'SUP'));
  return {
    isSupply: supply,
    isEngineer: Boolean(me?.departments.some((d) => d.code === 'ENG')),
    canIssue: supply && perms.includes('ISSUE_PARTS'),
    canReceive: supply && perms.includes('RECEIVE_PARTS'),
  };
}

// Part request lines from the server, with holder and held-since.
export function usePartRequestLines(filter: { aircraftId?: string; workOrderId?: string; requestId?: string; openOnly?: boolean }) {
  const [lines, setLines] = useState<RequestLine[] | null>(null);
  const [error, setError] = useState('');
  const { aircraftId, workOrderId, requestId, openOnly = true } = filter;
  const load = useCallback(async () => {
    const { data, error: err } = await anyActions.rpc('part_request_lines', {
      p_aircraft: aircraftId ?? null, p_work_order: workOrderId ?? null,
      p_request: requestId ?? null, p_open_only: openOnly,
    });
    if (err) setError(errorText(err));
    else setError('');
    setLines((data ?? []) as RequestLine[]);
  }, [aircraftId, workOrderId, requestId, openOnly]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);   // stock and states change on the server (D-071)
    return () => clearInterval(t);
  }, [load]);
  return { lines, error, reload: load };
}

// For the aircraft page tile "Part requests": open lines on this tail.
//   const s = usePartRequestSummary(aircraftId);
//   <Tile n={s.open ?? '…'} label="Part requests" to={`/part-requests?aircraft=${aircraftId}`} />
export function usePartRequestSummary(aircraftId: string | undefined) {
  // (No tail yet: ask for an id that matches nothing rather than every tail.)
  const { lines } = usePartRequestLines({ aircraftId: aircraftId ?? '00000000-0000-0000-0000-000000000000' });
  if (!aircraftId || lines === null) return { open: null as number | null, notInStock: 0, reserved: 0, issued: 0, aog: 0 };
  return {
    open: lines.length,
    notInStock: lines.filter((l) => l.state === 'needs_requisition' || l.state === 'on_order').length,
    reserved: lines.filter((l) => l.state === 'reserved').length,
    issued: lines.filter((l) => l.state === 'issued').length,
    aog: lines.filter((l) => l.priority === 'AOG').length,
  };
}

// The stores section tabs (WF-J1 ... WF-FWD1).
export function StoresTabs() {
  const tabs = [
    { to: '/stores', label: 'Stores search', end: true },
    { to: '/stores/issue', label: 'Issue parts' },
    { to: '/stores/receiving', label: 'Receiving inspection' },
    { to: '/stores/quarantine', label: 'Quarantine' },
    { to: '/stores/us-returns', label: 'U/S returns' },
    { to: '/stores/transfers', label: 'Transfers' },
  ];
  return (
    <nav aria-label="Stores sections" className="tail-tabs">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end ?? false}>{t.label}</NavLink>
      ))}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted st-empty">{children}</p>;
}

export function qtyText(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '');
}
