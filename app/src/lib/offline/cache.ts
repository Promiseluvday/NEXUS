// Offline copies of what the screens load (D-102, D-103).
//
// cached(key, run): asks the server; on success saves a copy and returns it;
// if the server cannot be reached, returns the last saved copy instead, with
// the time it was saved, so the screen can say "showing data as at 08:42"
// (fleet board data contract §5). Counts and statuses are never adjusted
// on the tablet: what you see is what the server last said.
import { local } from './db';
import { isNetworkError, setReachable } from './net';

export type Cached<T> = {
  data: T | null;
  error: { message?: string } | null;
  fromCache: boolean;
  savedAt: number | null;
};

export async function cached<T>(
  key: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
): Promise<Cached<T>> {
  let result: { data: T | null; error: { message?: string } | null };
  try {
    result = await run();
  } catch (e) {
    result = { data: null, error: { message: String(e) } };
  }
  if (!result.error) {
    setReachable(true);
    try { await local.cache.put({ key, value: result.data, savedAt: Date.now() }); } catch { /* no storage */ }
    return { data: result.data, error: null, fromCache: false, savedAt: Date.now() };
  }
  if (isNetworkError(result.error)) {
    setReachable(false);
    try {
      const row = await local.cache.get(key);
      if (row) return { data: row.value as T, error: null, fromCache: true, savedAt: row.savedAt };
    } catch { /* no storage */ }
    return { data: null, error: { message: 'No connection, and nothing saved on this tablet yet.' }, fromCache: true, savedAt: null };
  }
  return { data: null, error: result.error, fromCache: false, savedAt: null };
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    return (await local.cache.get(key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try { await local.cache.put({ key, value, savedAt: Date.now() }); } catch { /* no storage */ }
}
