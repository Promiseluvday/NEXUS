// Choosing an aircraft (D-201).
//
// useAircraftList(): the aircraft this user may see, with the status an
//   engineer set. The database filters the list by aircraft scope (D-121).
// AircraftPicker: a plain dropdown, used inside forms (works well on phones).
// TailSearch: the rail's "Go to a tail" box. Type part of a tail ("203") and
//   pick from the matches; each shows its status chip, so status stays
//   visible even inside the list.
import { useEffect, useMemo, useRef, useState } from 'react';
import { actions } from '../lib/supabase';
import { cached } from '../lib/offline/cache';
import { SnagChip, TailStatusChip } from './StatusChip';

export type AircraftOption = {
  id: string;
  tail: string;
  type: string;
  status: string | null;
  snagDisplay: string | null;
};

export function useAircraftList(): AircraftOption[] {
  const [list, setList] = useState<AircraftOption[]>([]);
  useEffect(() => {
    const load = () =>
      cached('fleet_board', () => actions.rpc('fleet_board')).then(({ data }) =>
        setList(
          ((data ?? []) as unknown as Record<string, string | null>[]).map((r) => ({
            id: r.aircraft_id as string,
            tail: r.tail as string,
            type: r.aircraft_type as string,
            status: r.status,
            snagDisplay: r.snag_display,
          })),
        ),
      );
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);
  return list;
}

type PickerProps = {
  value: string;
  onChange: (id: string) => void;
  aircraft: AircraftOption[];
  placeholder?: string;
  id?: string;
};

export function AircraftPicker({ value, onChange, aircraft, placeholder = 'Choose aircraft', id }: PickerProps) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {aircraft.map((a) => (
        <option key={a.id} value={a.id}>
          {a.tail} · {a.type}
        </option>
      ))}
    </select>
  );
}

type SearchProps = { aircraft: AircraftOption[]; onPick: (id: string) => void };

export function TailSearch({ aircraft, onPick }: SearchProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return aircraft.filter((a) =>
      !q || a.tail.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q) || a.type.toLowerCase().includes(q),
    );
  }, [aircraft, text]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  function pick(a: AircraftOption) {
    onPick(a.id);
    setText('');
    setOpen(false);
  }

  return (
    <div className="tail-search" ref={box}>
      <input
        id="tail-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="tail-search-list"
        aria-autocomplete="list"
        placeholder={`Go to a tail (${aircraft.length})…`}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, matches.length - 1));
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
          else if (e.key === 'Enter' && matches[active]) pick(matches[active]);
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id="tail-search-list" className="tail-search-list" role="listbox">
          {matches.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'active' : ''} onClick={() => pick(a)}>
                <span className="tail">{a.tail}</span>
                <span className="small muted">{a.type}</span>
                <span className="chips">
                  <TailStatusChip status={a.status} short />
                  <SnagChip display={a.snagDisplay} />
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="small muted" style={{ padding: 10 }}>No tail matches “{text}”.</li>}
        </ul>
      )}
    </div>
  );
}
