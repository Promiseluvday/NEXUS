// A date picker that shows dates the Nexus way on every device (D-204):
// "12 Oct 2026", never 10/12/2026 or 12/10/2026.
//
// Why not the browser's own date box? It works, but it shows the date in the
// DEVICE's format (a laptop set to US shows 10/12/2026). Two engineers could
// read the same date differently. This picker always shows DD Mmm YYYY.
//
// The value it hands back is "2026-10-12" (year-month-day), which is what the
// database stores. No library: a month grid, previous / next, and Today.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { formatPlainDate } from '../lib/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// The days to draw for one month, starting on Monday; blanks before day 1.
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  const blanks = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(blanks).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

type Props = {
  id?: string;
  value: string;                 // "2026-10-12" or ""
  onChange: (value: string) => void;
  min?: string;                  // earliest allowed, "YYYY-MM-DD"
};

export function DateField({ id, value, onChange, min }: Props) {
  const { display } = useAuth();
  const [open, setOpen] = useState(false);
  // "Today" in the operator's time zone, not the device's.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: display.timeZone }).format(new Date());
  const start = value || today;
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const [month, setMonth] = useState(Number(start.slice(5, 7)) - 1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const step = (delta: number) => {
    const m = month + delta;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12);
  };
  return (
    <div className="date-field" ref={box}>
      <button id={id} type="button" className="date-button" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <span className={value ? 'mono' : 'muted'}>{value ? formatPlainDate(value, display) : 'Choose a date'}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="calendar" role="dialog" aria-label="Choose a date">
          <div className="calendar-head">
            <button type="button" className="secondary" aria-label="Previous month" onClick={() => step(-1)}>‹</button>
            <strong>{MONTHS[month]} {year}</strong>
            <button type="button" className="secondary" aria-label="Next month" onClick={() => step(1)}>›</button>
          </div>
          <div className="calendar-grid">
            {DAYS.map((d) => <span key={d} className="calendar-dow">{d}</span>)}
            {monthGrid(year, month).map((d, i) => {
              if (d === null) return <span key={`b${i}`} />;
              const v = iso(year, month, d);
              const disabled = Boolean(min && v < min);
              return (
                <button key={v} type="button" disabled={disabled}
                  className={`calendar-day${v === value ? ' chosen' : ''}${v === today ? ' today' : ''}`}
                  aria-label={formatPlainDate(v, display)}
                  onClick={() => { onChange(v); setOpen(false); }}>
                  {d}
                </button>
              );
            })}
          </div>
          <div className="calendar-foot">
            <button type="button" className="link-button" onClick={() => { onChange(today); setOpen(false); }}>Today</button>
            {value && <button type="button" className="link-button" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}
