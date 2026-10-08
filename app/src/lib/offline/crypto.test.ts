import { describe, expect, it } from 'vitest';
import { checkNibble, fromHex, hmac, pinKey, toHex, xor } from './crypto';

describe('offline signing crypto (D-217)', () => {
  it('mixing twice with the same value gives the key back', () => {
    const key = fromHex('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');
    const mask = fromHex('ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100');
    expect(toHex(xor(xor(key, mask), mask))).toBe(toHex(key));
  });

  it('makes the same HMAC-SHA256 as the server (RFC 4231 test case 2)', async () => {
    const key = new TextEncoder().encode('Jefe');
    expect(await hmac(key, 'what do ya want for nothing?'))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('a wrong PIN gives a different key and never an error', async () => {
    const salt = fromHex('0102030405060708090a0b0c0d0e0f10');
    const right = await pinKey('246813', salt, 1000);
    const wrong = await pinKey('246814', salt, 1000);
    expect(right).toHaveLength(32);
    expect(toHex(right)).not.toBe(toHex(wrong));
  });

  it('the typo check is only 4 bits', async () => {
    const n = await checkNibble(fromHex('aa'.repeat(32)));
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(16);
  });
});
