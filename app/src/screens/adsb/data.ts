// ADs and SBs: what the screens read, and the words they show (D-016, D-021, D-028).
//
// Everything comes from two database views (migration 0028):
//   adsb_document_current    the register: the version of each AD / SB in force
//   adsb_compliance_current  each aircraft's entry in force, with its document,
//                            who entered it, Quality's decision ("awaiting"
//                            until there is one) and the D-028 flags.
// Older versions stay in the adsb_compliance table (history, D-023).
// The database filters by department and aircraft scope (D-121, D-125).
//
// The new functions are not in database.types.ts yet, so this uses the
// untyped connection (anyDb / anyActions) as lib/supabase.ts explains.
import { useCallback, useEffect, useState } from 'react';
import { anyDb } from '../../lib/supabase';
import { formatPlainDate } from '../../lib/format';

export type AdSbDocument = {
  id: string; document_key: string; version: number; doc_type: 'AD' | 'SB';
  reference: string; title: string; issuing_authority: string; aircraft_type_code: string;
  applies_to_note: string | null; revision: string | null; effective_on: string | null;
  correction_reason: string | null; entered_by_tlc: string | null; created_at: string;
};

export type Flag = 'approaching' | 'reached' | null;

export type AdSbEntry = {
  id: string; entry_key: string; version: number; aircraft_id: string; tail: string; aircraft_type_code: string;
  document_key: string; document_id: string; doc_type: 'AD' | 'SB'; reference: string; title: string;
  issuing_authority: string; assessed_revision: string | null; current_revision: string | null; document_revised: boolean;
  applicability: 'applicable' | 'not_applicable'; not_applicable_reason: string | null;
  compliance_method: string | null; status: Status;
  last_complied_on: string | null; last_complied_hours: number | null; last_complied_cycles: number | null;
  next_due_on: string | null; next_due_hours: number | null; next_due_cycles: number | null; next_due_text: string | null;
  compliance_reference: string | null; remarks: string | null; correction_reason: string | null;
  entered_by_tlc: string | null; entered_by: string; entered_at: string;
  verification_state: 'awaiting' | 'verified' | 'rejected'; verification_note: string | null;
  verified_at: string | null; verified_by_tlc: string | null;
  date_flag: Flag; hours_flag: Flag; cycles_flag: Flag; due_flag: Flag;
  current_hours: number | null; current_cycles: number | null; totals_available: boolean;
};

// One past or present version of an entry, for the History table.
export type AdSbVersion = {
  id: string; version: number; status: Status; applicability: string; not_applicable_reason: string | null;
  compliance_method: string | null; last_complied_on: string | null; last_complied_hours: number | null;
  last_complied_cycles: number | null; next_due_on: string | null; next_due_hours: number | null;
  next_due_cycles: number | null; next_due_text: string | null; correction_reason: string | null; entered_at: string;
  enterer: { three_letter_code: string } | null;
  document: { revision: string | null } | null;
  verification: { decision: string; note: string | null; decided_at: string; decider: { three_letter_code: string } | null }[]
    | { decision: string; note: string | null; decided_at: string; decider: { three_letter_code: string } | null } | null;
};

export type Status = 'open' | 'recurring' | 'complied' | 'not_applicable';

export const STATUS_LABEL: Record<Status, string> = {
  open: 'Open', recurring: 'Recurring', complied: 'Complied', not_applicable: 'Not applicable',
};
export const STATUS_TONE: Record<Status, string> = {
  open: 'blue', recurring: 'grey', complied: 'green', not_applicable: 'grey',
};
export const VERIFY_LABEL = { awaiting: 'Awaiting verification', verified: 'Verified', rejected: 'Rejected by Quality' } as const;
export const VERIFY_TONE = { awaiting: 'amber', verified: 'green', rejected: 'red' } as const;
export const FLAG_LABEL = { approaching: 'Approaching', reached: 'Reached' } as const;
export const FLAG_TONE = { approaching: 'amber', reached: 'red' } as const;

// Suggestions for the compliance method box when the operator has not set
// adsb.compliance_methods. Engineers can always type their own words.
export const DEFAULT_METHODS = ['Modification embodied', 'Repetitive inspection', 'Terminating action', 'Inspection, no findings'];

const num = (n: number | null) => (n === null || n === undefined ? '' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 1 }));

// "19,000 FH · 9,500 cyc" — the figures exactly as entered, nothing worked out.
export function figures(hours: number | null, cycles: number | null): string {
  return [hours !== null && hours !== undefined ? `${num(hours)} FH` : '', cycles !== null && cycles !== undefined ? `${num(cycles)} cyc` : '']
    .filter(Boolean).join(' · ');
}

export const ENTRY_SELECT = '*';

// The entries in force: one tail (aircraftId) or every tail in scope.
export function useAdSbEntries(aircraftId?: string | null) {
  const [rows, setRows] = useState<AdSbEntry[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    let q = anyDb.from('adsb_compliance_current').select(ENTRY_SELECT).order('doc_type').order('reference');
    if (aircraftId) q = q.eq('aircraft_id', aircraftId);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setRows((data ?? []) as AdSbEntry[]);
  }, [aircraftId]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, reload: load };
}

// The register: documents in force, optionally for one aircraft type.
export function useAdSbDocuments(typeCode?: string | null) {
  const [docs, setDocs] = useState<AdSbDocument[] | null>(null);
  const load = useCallback(async () => {
    let q = anyDb.from('adsb_document_current').select('*').order('doc_type').order('reference');
    if (typeCode) q = q.eq('aircraft_type_code', typeCode);
    const { data } = await q;
    setDocs((data ?? []) as AdSbDocument[]);
  }, [typeCode]);
  useEffect(() => { load(); }, [load]);
  return { docs, reload: load };
}

// Compliance-method suggestions (setting adsb.compliance_methods, D-025).
export function useComplianceMethods(): string[] {
  const [list, setList] = useState<string[]>(DEFAULT_METHODS);
  useEffect(() => {
    anyDb.from('operator_setting_current').select('value').eq('key', 'adsb.compliance_methods').maybeSingle()
      .then(({ data }: { data: { value?: unknown } | null }) => {
        if (Array.isArray(data?.value)) setList(data!.value as string[]);
      });
  }, []);
  return list;
}

// -------------------------------------------------------------------------
// For the aircraft page (the lead wires these in AircraftPage.tsx):
//
//   const adsb = useAdSbSummary(id);
//   <Tile n={adsb.loading ? '…' : adsb.adsRecurring} label="ADs recurring" to={`/ads-sbs?aircraft=${id}&status=recurring&type=AD`} />
//   <Tile n={adsb.loading ? '…' : adsb.sbsOpen} label="SBs open" to={`/ads-sbs?aircraft=${id}&status=open&type=SB`} />
//   ...the "ADs and SBs" panel body: <AdSbPanelBody aircraftId={id} /> (adsb/parts.tsx)
//   ...Due items panel rows: adsb.dueItems (each has item, due text, by, flag, to)
// -------------------------------------------------------------------------
export type AdSbDueItem = {
  key: string; item: string; due: string; nextDueOn: string | null; by: string; enteredAt: string;
  flag: Flag; to: string;
};

export type AdSbSummary = {
  loading: boolean;
  total: number;
  adsRecurring: number; adsOpen: number; sbsOpen: number;
  awaitingVerification: number; rejected: number;
  approaching: number; reached: number; flagged: number;
  rows: AdSbEntry[];
  dueItems: AdSbDueItem[];   // open and recurring entries with a next due entered
  reload: () => void;
};

export function useAdSbSummary(aircraftId: string | null | undefined): AdSbSummary {
  const { rows, reload } = useAdSbEntries(aircraftId ?? undefined);
  const list = aircraftId ? rows ?? [] : [];
  const live = list.filter((r) => r.status === 'open' || r.status === 'recurring');
  const dueItems: AdSbDueItem[] = live
    .filter((r) => r.next_due_on || r.next_due_hours !== null || r.next_due_cycles !== null || r.next_due_text)
    .map((r) => ({
      key: `adsb-${r.entry_key}`,
      item: `${r.doc_type} ${r.reference}`,
      due: nextDueText(r, (d) => formatPlainDate(d)),
      nextDueOn: r.next_due_on,
      by: r.entered_by_tlc ?? '—',
      enteredAt: r.entered_at,
      flag: r.due_flag,
      to: `/ads-sbs?aircraft=${r.aircraft_id}&entry=${r.entry_key}`,
    }));
  return {
    loading: Boolean(aircraftId) && rows === null,
    total: list.length,
    adsRecurring: list.filter((r) => r.doc_type === 'AD' && r.status === 'recurring').length,
    adsOpen: list.filter((r) => r.doc_type === 'AD' && r.status === 'open').length,
    sbsOpen: list.filter((r) => r.doc_type === 'SB' && r.status === 'open').length,
    awaitingVerification: list.filter((r) => r.verification_state === 'awaiting').length,
    rejected: list.filter((r) => r.verification_state === 'rejected').length,
    approaching: live.filter((r) => r.due_flag === 'approaching').length,
    reached: live.filter((r) => r.due_flag === 'reached').length,
    flagged: live.filter((r) => r.due_flag).length,
    rows: list,
    dueItems,
    reload,
  };
}

// Next due as entered: the date (DD Mmm YYYY is applied by the screen),
// the figures and the words, joined. Used where a plain string is needed.
export function nextDueText(r: Pick<AdSbEntry, 'next_due_on' | 'next_due_hours' | 'next_due_cycles' | 'next_due_text'>,
  formatDay: (d: string) => string = (d) => d): string {
  const parts = [r.next_due_on ? formatDay(r.next_due_on) : '', figures(r.next_due_hours, r.next_due_cycles)].filter(Boolean);
  const head = parts.join(' · ');
  if (r.next_due_text && head) return `${head} (${r.next_due_text})`;
  return head || r.next_due_text || '—';
}
