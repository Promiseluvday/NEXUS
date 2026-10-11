// Operator settings the screens need beyond the display settings (D-025).
// Read once per screen from operator_setting_current, saved for offline use,
// with a default until the setting is loaded.
import { useCallback, useEffect, useState } from 'react';
import { db } from './supabase';
import { cached } from './offline/cache';

function useNumberSetting(key: string, fallback: number): number {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    cached(`setting:${key}`, () => db.from('operator_setting_current').select('value').eq('key', key).maybeSingle())
      .then((r) => {
        const v = Number((r.data as { value?: unknown } | null)?.value);
        if (Number.isFinite(v) && v >= 0) setValue(v);
      });
  }, [key]);
  return value;
}

// How many days before a recorded due time an item is flagged "Approaching"
// (one-aircraft page) and listed under Needs attention (dashboard).
export const useApproachingDays = () => useNumberSetting('attention.approaching_days', 3);

// How a corrected work order shows its number (D-220): the operator's
// revision style, e.g. "{NUMBER} R{REV}" gives "WO-000002 R1". An
// uncorrected work order shows its number alone.
export function useWorkOrderLabel(): (number: string, revision?: number | null) => string {
  const [format, setFormat] = useState('{NUMBER} R{REV}');
  useEffect(() => {
    cached('setting:work_order.revision_format', () =>
      db.from('operator_setting_current').select('value').eq('key', 'work_order.revision_format').maybeSingle())
      .then((r) => {
        const v = (r.data as { value?: unknown } | null)?.value;
        if (typeof v === 'string' && v.includes('{NUMBER}')) setFormat(v);
      });
  }, []);
  return useCallback(
    (number: string, revision?: number | null) =>
      revision ? format.replace('{NUMBER}', number).replace('{REV}', String(revision)) : number,
    [format],
  );
}
