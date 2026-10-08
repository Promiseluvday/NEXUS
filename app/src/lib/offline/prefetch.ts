// Saving what an engineer needs offline, while there is a connection.
// For each aircraft type the user can see: the ACTIVE MEL (so an MEL
// deferral can be found and signed offline, D-058, D-217) and the cabin
// zones (cabin items, D-209). Refreshed once per sign-in when online.
import { db } from '../supabase';
import { writeCache, readCache } from './cache';
import type { MelItem } from '../../components/MelSearch';

let doneFor = '';

export async function prefetchForOffline(types: string[]): Promise<void> {
  const key = [...new Set(types)].sort().join(',');
  if (!key || key === doneFor) return;
  for (const type of new Set(types)) {
    const { data, error } = await db.from('mel_item')
      .select('id, item_number, title, category, interval_value, interval_unit, remarks, m_procedure, o_procedure, rev:revision_id!inner (revision, status, aircraft_type_code)')
      .eq('rev.status', 'active').eq('rev.aircraft_type_code', type).order('item_number');
    if (error) return; // offline or refused: try again next time
    const items: MelItem[] = (data ?? []).map((i) => {
      const rev = i.rev as unknown as { revision: string };
      return {
        id: i.id, item_number: i.item_number, title: i.title, category: i.category,
        interval_value: i.interval_value, interval_unit: i.interval_unit, remarks: i.remarks,
        m_procedure: i.m_procedure, o_procedure: i.o_procedure, revision: rev.revision,
      };
    });
    await writeCache(`mel:${type}`, items);
    const zones = await db.from('cabin_zone').select('code, name, is_emergency_equipment').eq('aircraft_type_code', type).order('code');
    if (!zones.error) await writeCache(`zones:${type}`, zones.data);
  }
  doneFor = key;
}

// Offline MEL search over the saved copy: same rules as app.search_mel
// (item number digits, or two or more letters of the title).
export async function searchMelOffline(type: string, query: string): Promise<MelItem[]> {
  const items = (await readCache<MelItem[]>(`mel:${type}`)) ?? [];
  const digits = query.replace(/[^0-9]/g, '');
  const text = query.trim().toLowerCase();
  return items.filter((i) =>
    (digits && i.item_number.replace(/[^0-9]/g, '').startsWith(digits))
    || (text.length >= 2 && i.title.toLowerCase().includes(text))).slice(0, 12);
}
