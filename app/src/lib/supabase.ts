// The one connection from the screens to the database.
// Every screen imports `db` from here, so there is one place to look if the
// address or key ever changes. The values come from .env.local (never in Git).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configMissing = !url || !key;

export const db = createClient<Database>(url ?? 'http://127.0.0.1:54321', key ?? 'missing-key');

// Workflow actions live in the "app" area of the database (report_snag,
// fleet_board...). Each one checks who you are before doing anything.
export const actions = db.schema('app');

// Turn a database error into a sentence for the user. The database's own
// messages are already written for people (e.g. "Only an engineer can set a
// tail status (D-046)."), so show them as they are.
export function errorText(error: { message?: string } | null | undefined): string {
  if (!error) return '';
  const m = error.message ?? 'Something went wrong.';
  if (m.includes('Failed to fetch')) return 'Cannot reach the Nexus server. Check your connection.';
  if (m.includes('Invalid login credentials')) return 'Username or password not recognised.';
  return hideRefs(m);
}

// Decision numbers (D-xxx) are Liebetag's private design log and are never
// shown to users. The database's messages and some older stored text still
// carry them, so text from the server passes through this before display:
// "PIN not accepted (D-094)." -> "PIN not accepted."
// "(Quality's list, D-148)"   -> "(Quality's list)"
const REF_LIST = String.raw`D-\d{3}(?:\s*(?:,|and|to)\s*D-\d{3})*`;
const REF_ALONE = new RegExp(String.raw`\s*\((?:see )?${REF_LIST}(?:\s*\([^()]*\))?\)`, 'g');
const REF_TAIL = new RegExp(String.raw`[,;]\s*${REF_LIST}(?=\))`, 'g');
const REF_LEAD = new RegExp(String.raw`(^|\s)${REF_LIST}:\s+`, 'g');
export function hideRefs(text: string): string {
  return text.replace(REF_ALONE, '').replace(REF_TAIL, '').replace(REF_LEAD, '$1');
}

// The same connection without the generated type list. Used by screens whose
// database functions are newer than src/lib/database.types.ts; once
// `npm run types` is run they can switch back to `actions` / `db`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const anyActions = actions as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const anyDb = db as any;
