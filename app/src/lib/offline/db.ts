// The tablet's own storage (IndexedDB, through Dexie) (D-102).
//
//   cache    copies of what the screens last loaded, so they still show
//            something with no signal, with the time they were saved
//   outbox   actions waiting to be sent: reports, attends, work entries,
//            files, and offline signatures (D-217), in the order they were made
//   keys     the person's offline signing key, stored only MIXED WITH THE PIN
//            (see signing.ts); never the key itself, never the PIN
//   meta     small values: this tablet's id, last server time, clock offset
//
// Nothing here is the official record. The server is (D-023, D-024).
import Dexie, { type Table } from 'dexie';

export type CacheRow = { key: string; value: unknown; savedAt: number };

export type OutboxItem = {
  id?: number;
  userId: string;
  kind: 'rpc' | 'signed' | 'upload';
  action: string;                  // e.g. report_snag, apply_mel, upload
  args: Record<string, unknown>;   // never contains a PIN
  label: string;                   // what the person sees: "Defer SNAG-000004 under MEL 21-31-01"
  recordPath?: string;             // where to look: /snags/<id>
  aircraftId?: string;
  payload?: string;                // signed actions: the exact signed text
  signature?: string;
  file?: Blob;                     // uploads
  createdAt: number;
  status: 'queued' | 'sending' | 'failed' | 'sent';
  error?: string;
  sentAt?: number;
};

export type KeyRow = {
  id: string;            // `${userId}:${deviceId}`
  userId: string;
  deviceId: string;
  wrapped: string;       // key XOR value-from-PIN, hex
  salt: string;          // hex
  check: number;         // 0..15, catches most typos, useless to a thief
  issuedAt: number;
};

export type MetaRow = { key: string; value: unknown };

class NexusDb extends Dexie {
  cache!: Table<CacheRow, string>;
  outbox!: Table<OutboxItem, number>;
  keys!: Table<KeyRow, string>;
  meta!: Table<MetaRow, string>;
  constructor() {
    super('nexus-mro');
    this.version(1).stores({
      cache: 'key, savedAt',
      outbox: '++id, userId, status, createdAt',
      keys: 'id, userId, deviceId',
      meta: 'key',
    });
  }
}

export const local = new NexusDb();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    return (await local.meta.get(key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    await local.meta.put({ key, value });
  } catch {
    /* storage unavailable (private window): carry on without it */
  }
}
