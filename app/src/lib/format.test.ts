import { describe, expect, it } from 'vitest';
import { defaultDisplay, formatDate, formatDateTime, formatPlainDate, formatTime, heldFor } from './format';

describe('dates and times (D-204)', () => {
  it('shows dates as DD Mmm YYYY', () => {
    expect(formatDate('2026-10-07T09:00:00Z')).toBe('07 Oct 2026');
  });
  it('shows 24-hour times in the operator time zone (Lagos is UTC+1)', () => {
    expect(formatTime('2026-10-07T13:05:00Z')).toBe('14:05');
  });
  it('uses the operator date, not the UTC date, near midnight', () => {
    expect(formatDateTime('2026-10-07T23:30:00Z')).toBe('08 Oct 2026 00:30');
  });
  it('follows a different date format when the operator sets one', () => {
    expect(formatDate('2026-10-07T09:00:00Z', { ...defaultDisplay, dateFormat: 'YYYY-MM-DD' })).toBe('2026-10-07');
  });
  it('shows a plain calendar date without shifting it', () => {
    expect(formatPlainDate('2026-10-12')).toBe('12 Oct 2026');
  });
  it('shows nothing for a missing value', () => {
    expect(formatDate(null)).toBe('');
  });
});

describe('held for', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  it('shows days and hours', () => {
    expect(heldFor('2026-10-05T08:00:00Z', now)).toBe('2d 4h');
  });
  it('shows hours and minutes', () => {
    expect(heldFor('2026-10-07T08:50:00Z', now)).toBe('3h 10m');
  });
  it('shows minutes', () => {
    expect(heldFor('2026-10-07T11:48:00Z', now)).toBe('12m');
  });
});
