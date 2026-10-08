// How dates, times and durations are shown (D-204).
//   Dates: DD Mmm YYYY  → 07 Oct 2026   (same on every device)
//   Times: HH:MM 24-hour → 14:05
// The patterns and the operator's time zone are settings (D-025), read from
// the database at sign-in. These are the defaults until they load.

export type DisplaySettings = {
  dateFormat: string; // tokens: DD, Mmm, MM, YYYY
  timeFormat: string; // tokens: HH, MM
  timeZone: string;   // e.g. Africa/Lagos
};

export const defaultDisplay: DisplaySettings = {
  dateFormat: 'DD Mmm YYYY',
  timeFormat: 'HH:MM',
  timeZone: 'Africa/Lagos',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The date and time parts as seen in the operator's time zone, not the
// device's. A tablet set to the wrong zone still shows hangar time.
function parts(value: string | Date, timeZone: string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

export function formatDate(value: string | Date | null | undefined, s: DisplaySettings = defaultDisplay): string {
  if (!value) return '';
  const p = parts(value, s.timeZone);
  return s.dateFormat
    .replace('YYYY', p.year)
    .replace('Mmm', MONTHS[Number(p.month) - 1])
    .replace('MM', p.month)
    .replace('DD', p.day);
}

export function formatTime(value: string | Date | null | undefined, s: DisplaySettings = defaultDisplay): string {
  if (!value) return '';
  const p = parts(value, s.timeZone);
  return s.timeFormat.replace('HH', p.hour).replace('MM', p.minute);
}

export function formatDateTime(value: string | Date | null | undefined, s: DisplaySettings = defaultDisplay): string {
  if (!value) return '';
  return `${formatDate(value, s)} ${formatTime(value, s)}`;
}

// A plain calendar date from the database ("2026-10-12"), shown without any
// time-zone shift.
export function formatPlainDate(value: string | null | undefined, s: DisplaySettings = defaultDisplay): string {
  if (!value) return '';
  return formatDate(`${value}T12:00:00Z`, { ...s, timeZone: 'UTC' });
}

// How long something has been held: "2d 4h", "3h 10m", "12m".
// Simple subtraction of two recorded times; nothing is predicted (D-020).
export function heldFor(since: string | null | undefined, now: Date = new Date()): string {
  if (!since) return '';
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
