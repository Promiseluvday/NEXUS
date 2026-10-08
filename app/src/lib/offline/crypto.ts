// The small pieces of cryptography offline signing needs, all built into the
// browser (Web Crypto). No library.
//
//   pinKey(pin, salt)  turns a PIN into 32 bytes, slowly on purpose
//                      (PBKDF2, 210 000 rounds), so each guess costs time
//   xor(a, b)          mixes two equal-length byte strings; mixing again
//                      with the same value gets the original back
//   hmac(key, text)    the signature: a code only someone with the key can make
//   checkNibble(key)   4 bits derived from the key: catches 15 of 16 typos,
//                      but leaves a thief with no way to confirm a guess
//
// Why XOR and not normal encryption? Normal encryption tells you when the
// password is wrong. That would let a thief test PINs on a stolen tablet.
// XOR never says "wrong": every PIN produces some key, and only the server
// can tell the real one (workflows/offline-signing.md, S-1).

const enc = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new Error('Lengths differ');
  return a.map((x, i) => x ^ b[i]);
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export const PBKDF2_ROUNDS = 210_000;

export async function pinKey(pin: string, salt: Uint8Array, rounds = PBKDF2_ROUNDS): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds }, base, 256);
  return new Uint8Array(bits);
}

export async function hmac(key: Uint8Array, text: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text))));
}

export async function checkNibble(key: Uint8Array): Promise<number> {
  return parseInt((await hmac(key, 'nexus-pin-check')).slice(0, 1), 16);
}
