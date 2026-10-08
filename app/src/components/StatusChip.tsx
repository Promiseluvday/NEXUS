// Coloured chips that always pair a colour with a word (D-091).
//
// TailStatusChip: the status an ENGINEER set (D-046). Never worked out by
//   the system.
// SnagChip: blue "Snag open" when a report is waiting for an engineer, amber
//   "Snag attended" once an engineer has started (D-200). Neither one is a
//   serviceability status.

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey';

// Long label for desktop, short label for mobile. Labels may later come from
// operator settings (D-025, O-7); these are the defaults.
export const TAIL_STATUS: Record<string, { long: string; short: string; tone: Tone }> = {
  SVC:      { long: 'Serviceable',       short: 'SVC',       tone: 'green' },
  SVC_MEL:  { long: 'Serviceable · MEL', short: 'SVC · MEL', tone: 'amber' },
  US:       { long: 'Unserviceable',     short: 'U/S',       tone: 'red' },
  AOG:      { long: 'AOG',               short: 'AOG',       tone: 'red' },
  IN_CHECK: { long: 'In check',          short: 'In check',  tone: 'blue' },
};

export function TailStatusChip({ status, short = false }: { status: string | null; short?: boolean }) {
  if (!status) return <span className="chip tone-grey">No status recorded</span>;
  const s = TAIL_STATUS[status] ?? { long: status, short: status, tone: 'grey' as Tone };
  return <span className={`chip tone-${s.tone}`}>{short ? s.short : s.long}</span>;
}

export function SnagChip({ display }: { display: string | null }) {
  if (display === 'snag_open') return <span className="chip tone-blue">Snag open</span>;
  if (display === 'snag_attended') return <span className="chip tone-amber">Snag attended</span>;
  return null;
}
