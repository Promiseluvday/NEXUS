import { describe, expect, it } from 'vitest';
import { hideRefs } from './supabase';

describe('decision numbers are never shown', () => {
  it('removes a bracketed reference', () => {
    expect(hideRefs('PIN not accepted (D-094).')).toBe('PIN not accepted.');
    expect(hideRefs('Needs a connection (D-104, D-217).')).toBe('Needs a connection.');
    expect(hideRefs('Minimum PIN length (D-217 (b))')).toBe('Minimum PIN length');
  });
  it('keeps the words inside the brackets', () => {
    expect(hideRefs("Certificate type (Quality's list, D-148)")).toBe("Certificate type (Quality's list)");
  });
  it('removes a leading reference', () => {
    expect(hideRefs('D-123: only a Super Admin approves')).toBe('only a Super Admin approves');
  });
  it('leaves other text alone', () => {
    expect(hideRefs('WO-000214 · NX-201 (G550)')).toBe('WO-000214 · NX-201 (G550)');
  });
});
