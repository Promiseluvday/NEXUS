// Offline signing on the tablet (D-217, workflows/offline-signing.md).
//
// SWITCH ON (online): the server hands over a personal key once. The tablet
// keeps only  wrapped = key XOR pinKey(PIN)  plus a 4-bit typo check. The key
// and the PIN are then forgotten.
//
// SIGN (offline): the engineer types the PIN; pinKey(PIN) XOR wrapped gives
// the key back only if the PIN is right. The tablet signs the exact text of
// the action with it (HMAC). A wrong PIN gives a wrong key and a signature
// the server will refuse; the typo check catches most slips on the spot.
import { actions } from '../supabase';
import { local } from './db';
import { checkNibble, fromHex, hmac, pinKey, randomBytes, toHex, xor } from './crypto';
import { hoursSinceContact, nowEstimate } from './clock';
import { checkIn, deviceState } from './device';

export async function enableOfflineSigning(userId: string, pin: string): Promise<string | null> {
  const { deviceId } = deviceState();
  if (!deviceId) return 'Register this tablet first.';
  // Browsers only allow this cryptography on a secure (https) address.
  if (!globalThis.crypto?.subtle) return 'Offline signing needs the secure (https) Nexus address on this tablet.';
  const { data, error } = await actions.rpc('issue_offline_key', { p_device: deviceId, p_pin: pin });
  if (error) return error.message;
  const key = fromHex(data as string);
  const salt = randomBytes(16);
  const wrapped = xor(key, await pinKey(pin, salt));
  await local.keys.put({
    id: `${userId}:${deviceId}`, userId, deviceId, wrapped: toHex(wrapped), salt: toHex(salt),
    check: await checkNibble(key), issuedAt: Date.now(),
  });
  await checkIn();
  return null;
}

// Can this person sign offline on this tablet right now? null = yes.
export async function offlineSigningProblem(userId: string): Promise<string | null> {
  const { deviceId, problem, maxHours } = deviceState();
  if (!deviceId) return 'This tablet is not registered for offline signing.';
  if (problem) return problem;
  const row = await local.keys.get(`${userId}:${deviceId}`).catch(() => undefined);
  if (!row) return 'Offline signing is not switched on for you on this tablet (Account menu ▸ This tablet).';
  const hours = await hoursSinceContact();
  if (hours === null || hours > maxHours) {
    return `This tablet has not reached the server for more than ${maxHours} hours. Offline signing is paused until it reconnects (D-217).`;
  }
  return null;
}

export type SignedItem = { payload: string; signature: string };

export async function signOffline(
  userId: string, pin: string, action: string, args: Record<string, unknown>,
): Promise<SignedItem> {
  const { deviceId } = deviceState();
  const row = await local.keys.get(`${userId}:${deviceId}`);
  if (!row || !deviceId) throw new Error('Offline signing is not switched on for you on this tablet.');
  const key = xor(fromHex(row.wrapped), await pinKey(pin, fromHex(row.salt)));
  if ((await checkNibble(key)) !== row.check) throw new Error('PIN not accepted (D-094).');
  const clock = await nowEstimate();
  const payload = JSON.stringify({
    v: 1, device: deviceId, user: userId, action, args,
    signed_at: clock.at.toISOString(), clock: clock.kind, device_time: clock.device.toISOString(),
    nonce: crypto.randomUUID ? crypto.randomUUID() : toHex(randomBytes(16)).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
  });
  return { payload, signature: await hmac(key, payload) };
}
