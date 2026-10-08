// The aircraft dropdown (D-201) and the list behind it.
// Only aircraft inside the user's aircraft scope come back: the database's
// security rules filter the list (D-121), not this screen.
import { useEffect, useState } from 'react';
import { db } from '../lib/supabase';

export type AircraftOption = { id: string; tail: string; type: string };

export function useAircraftList(): AircraftOption[] {
  const [list, setList] = useState<AircraftOption[]>([]);
  useEffect(() => {
    db.from('aircraft')
      .select('id, tail, aircraft_type_code')
      .eq('status', 'active')
      .order('tail')
      .then(({ data }) =>
        setList((data ?? []).map((a) => ({ id: a.id, tail: a.tail, type: a.aircraft_type_code }))),
      );
  }, []);
  return list;
}

type Props = {
  value: string;
  onChange: (id: string) => void;
  aircraft: AircraftOption[];
  placeholder?: string;
  id?: string;
};

export function AircraftPicker({ value, onChange, aircraft, placeholder = 'Choose aircraft', id }: Props) {
  return (
    <select id={id} className="mono" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {aircraft.map((a) => (
        <option key={a.id} value={a.id}>
          {a.tail} · {a.type}
        </option>
      ))}
    </select>
  );
}
