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
  return m;
}

// The same connection without the generated type list. Used by screens whose
// database functions are newer than src/lib/database.types.ts; once
// `npm run types` is run they can switch back to `actions` / `db`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const anyActions = actions as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const anyDb = db as any;
