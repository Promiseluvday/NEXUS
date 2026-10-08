// MEL item type-ahead (D-058).
// Type an item number ("21-31", "2131") or words from the title ("pack").
// Results come from the ACTIVE MEL revision for this aircraft's type only
// (app.search_mel). The screen shows the item exactly as the MEL states it:
// category, interval, (M) and (O) procedures. It decides nothing (D-020).
import { useEffect, useState } from 'react';
import { actions } from '../lib/supabase';

export type MelItem = {
  id: string;
  item_number: string;
  title: string;
  category: string;
  interval_value: number | null;
  interval_unit: string;
  remarks: string | null;
  m_procedure: boolean;
  o_procedure: boolean;
  revision: string;
};

const UNIT: Record<string, string> = {
  calendar_days: 'calendar days', flight_hours: 'flight hours', cycles: 'cycles', flights: 'flights',
};

export function melInterval(i: MelItem): string {
  if (i.interval_unit === 'as_specified') return 'As specified in the MEL item';
  return `${i.interval_value} ${UNIT[i.interval_unit] ?? i.interval_unit}`;
}

type Props = { aircraftId: string; value: MelItem | null; onChange: (item: MelItem | null) => void };

export function MelSearch({ aircraftId, value, onChange }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<MelItem[]>([]);
  const [searched, setSearched] = useState(false);

  // Wait until typing pauses for a moment, then ask the database.
  useEffect(() => {
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await actions.rpc('search_mel', { p_aircraft: aircraftId, p_query: text, p_limit: 12 });
      setResults((data ?? []) as unknown as MelItem[]);
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [text, aircraftId]);

  if (value) {
    return (
      <div className="mel-chosen">
        <div>
          <span className="mono">{value.item_number}</span> · {value.title}
        </div>
        <div className="small">
          Category <strong>{value.category}</strong> · {melInterval(value)}
          {value.m_procedure && ' · (M)'}{value.o_procedure && ' · (O)'} · MEL rev {value.revision}
        </div>
        {value.remarks && <div className="small muted">{value.remarks}</div>}
        <button type="button" className="link-button" onClick={() => onChange(null)}>Choose a different item</button>
      </div>
    );
  }

  return (
    <div>
      <input
        id="mel-search"
        type="search"
        placeholder="MEL item number or words, e.g. 21-31 or pack"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <ul className="pick-list" role="listbox">
          {results.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onChange(i)}>
                <span className="mono">{i.item_number}</span>
                <span>{i.title}</span>
                <span className="small muted">Cat {i.category} · {melInterval(i)}{i.m_procedure && ' · (M)'}{i.o_procedure && ' · (O)'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && (
        <p className="small muted">No item in the active MEL matches “{text}”. If the item is not in the MEL, use another disposition.</p>
      )}
    </div>
  );
}
