// Is the server reachable? Two signals:
//   * the browser says it has no network (navigator.onLine is false), or
//   * a request just failed to reach the server (Wi-Fi up, server not).
// Screens listen with onNetChange() to show "Offline" and the queue count.

let reachable = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<() => void>();

export function isOnline(): boolean {
  return reachable && (typeof navigator === 'undefined' || navigator.onLine);
}

export function setReachable(ok: boolean): void {
  if (ok !== reachable) {
    reachable = ok;
    listeners.forEach((l) => l());
  }
}

export function onNetChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Did this error happen because the server could not be reached at all?
export function isNetworkError(error: { message?: string; name?: string } | null | undefined): boolean {
  if (!error) return false;
  const m = `${error.name ?? ''} ${error.message ?? ''}`;
  return /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed|ERR_INTERNET|AuthRetryableFetchError/i.test(m);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { reachable = true; listeners.forEach((l) => l()); });
  window.addEventListener('offline', () => listeners.forEach((l) => l()));
}
