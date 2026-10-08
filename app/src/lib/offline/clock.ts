// Time for offline signatures (D-217, workflows/offline-signing.md §3).
//
// Every time the tablet reaches the server it notes the SERVER's time and the
// browser's elapsed-time counter (performance.now(), which the user cannot
// change). Offline, "now" is:
//   server time at last contact + time elapsed since then   → 'server+elapsed'
// If the app was restarted offline, that counter starts again, so we fall back
// to the tablet clock corrected by the last known difference → 'device+offset'.
// The server adds its own receipt time when the signature arrives.
import { getMeta, setMeta } from './db';

let mark: { server: number; perf: number } | null = null;

export async function noteServerTime(serverIso: string): Promise<void> {
  const server = new Date(serverIso).getTime();
  mark = { server, perf: performance.now() };
  await setMeta('clockOffset', server - Date.now());
  await setMeta('lastContact', server);
}

export type ClockReading = { at: Date; kind: 'server+elapsed' | 'device+offset'; device: Date };

export async function nowEstimate(): Promise<ClockReading> {
  const device = new Date();
  if (mark) {
    return { at: new Date(mark.server + (performance.now() - mark.perf)), kind: 'server+elapsed', device };
  }
  const offset = (await getMeta<number>('clockOffset')) ?? 0;
  return { at: new Date(device.getTime() + offset), kind: 'device+offset', device };
}

// Hours since the server was last reached (for the 72-hour limit, D-217 (d)).
export async function hoursSinceContact(): Promise<number | null> {
  const last = await getMeta<number>('lastContact');
  if (!last) return null;
  const now = (await nowEstimate()).at.getTime();
  return (now - last) / 3_600_000;
}
