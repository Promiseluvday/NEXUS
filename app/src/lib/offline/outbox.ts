// The send queue ("outbox") (D-102, D-103, D-217).
//
// Actions made with no connection wait here, in the order they were made.
// When the connection returns they are sent one by one:
//   rpc     an ordinary action (report snag, attend, work entry). Reports carry
//           a one-off reference, so a re-send never creates a duplicate.
//   signed  an offline signature: the server checks it and runs the action
//           (app.submit_offline_signature). Refused → shown here with the reason.
//   upload  a photo or scan: the file first, then its record (D-026, D-065).
// Only the signed-in person's items are sent: an engineer's offline signature
// waits until that engineer signs in again on the tablet.
import { actions, db } from '../supabase';
import { local, type OutboxItem } from './db';
import { isNetworkError, setReachable } from './net';
import { checkIn } from './device';

const listeners = new Set<() => void>();
export function onOutboxChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
const changed = () => listeners.forEach((l) => l());

export async function enqueue(item: Omit<OutboxItem, 'id' | 'status' | 'createdAt'>): Promise<void> {
  await local.outbox.add({ ...item, status: 'queued', createdAt: Date.now() });
  changed();
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  try {
    return (await local.outbox.where('userId').equals(userId).sortBy('createdAt'));
  } catch {
    return [];
  }
}

export async function retry(id: number): Promise<void> {
  await local.outbox.update(id, { status: 'queued', error: undefined });
  changed();
}

// Removes an item that failed from THIS TABLET only. It was never a record on
// the server, so nothing official is deleted (D-023). The paper tech log
// entry still stands.
export async function removeFailed(id: number): Promise<void> {
  const item = await local.outbox.get(id);
  if (item?.status === 'failed') await local.outbox.delete(id);
  changed();
}

let running = false;

export async function syncNow(userId: string | undefined): Promise<void> {
  if (!userId || running) return;
  running = true;
  try {
    if (!(await checkIn())) return;               // server not reachable
    const items = (await listOutbox(userId)).filter((i) => i.status === 'queued' || i.status === 'sending');
    for (const item of items) {
      await local.outbox.update(item.id!, { status: 'sending' });
      changed();
      const outcome = await send(item);
      if (outcome === 'offline') {
        await local.outbox.update(item.id!, { status: 'queued' });
        setReachable(false);
        break;
      }
      await local.outbox.update(item.id!, outcome === 'sent'
        ? { status: 'sent', sentAt: Date.now(), error: undefined, file: undefined }
        : { status: 'failed', error: outcome.error });
      changed();
    }
  } finally {
    running = false;
    changed();
  }
}

async function send(item: OutboxItem): Promise<'sent' | 'offline' | { error: string }> {
  if (item.kind === 'rpc') {
    const { error } = await actions.rpc(item.action as 'report_snag', item.args as never);
    if (isNetworkError(error)) return 'offline';
    return error ? { error: error.message } : 'sent';
  }
  if (item.kind === 'signed') {
    const { data, error } = await actions.rpc('submit_offline_signature', {
      p_payload: item.payload!, p_signature: item.signature!,
    });
    if (isNetworkError(error)) return 'offline';
    if (error) return { error: error.message };
    const r = data as { ok: boolean; reason?: string };
    return r.ok ? 'sent' : { error: `Refused by the server: ${r.reason ?? 'no reason given'}` };
  }
  // upload: the file first, then its record
  const a = item.args as { record_table: string; record_id: string; kind: string; file_name: string;
    mime_type: string; size_bytes: number; storage_path: string; uploaded_by: string; device_time: string };
  const up = await db.storage.from('attachments').upload(a.storage_path, item.file!, { contentType: a.mime_type });
  if (up.error && isNetworkError(up.error)) return 'offline';
  if (up.error && !/already exists|Duplicate/i.test(up.error.message)) return { error: up.error.message };
  const row = await db.from('attachment').insert(a);
  if (isNetworkError(row.error)) return 'offline';
  if (row.error && !/duplicate key/i.test(row.error.message)) return { error: row.error.message };
  return 'sent';
}

// Send automatically: when the connection comes back, and every 30 seconds
// while something is waiting.
export function startAutoSync(getUserId: () => string | undefined): () => void {
  const go = () => syncNow(getUserId());
  window.addEventListener('online', go);
  const timer = setInterval(async () => {
    const id = getUserId();
    if (id && (await listOutbox(id)).some((i) => i.status === 'queued')) go();
  }, 30_000);
  go();
  return () => {
    window.removeEventListener('online', go);
    clearInterval(timer);
  };
}
