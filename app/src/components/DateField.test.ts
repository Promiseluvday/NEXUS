import { describe, expect, it } from 'vitest';
import { monthGrid } from './DateField';

describe('date picker month grid', () => {
  it('starts October 2026 on a Thursday (3 blanks before day 1)', () => {
    const g = monthGrid(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, 1]);
    expect(g.filter((d) => d !== null)).toHaveLength(31);
  });
  it('knows February 2028 has 29 days', () => {
    expect(monthGrid(2028, 1).filter((d) => d !== null)).toHaveLength(29);
  });
});
