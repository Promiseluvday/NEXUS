// Operator settings the screens need beyond the display settings (D-025).
// Read once per screen from operator_setting_current, saved for offline use,
// with a default until the setting is loaded.
import { useEffect, useState } from 'react';
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
