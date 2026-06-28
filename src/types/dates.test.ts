import { describe, it, expect } from 'vitest';
import {
  formatLocalDate,
  parseLocalDate,
  getDaysUntilExpiration,
  getFreshnessStatus,
} from './index';

// Build a YYYY-MM-DD string an exact number of days from today (local time).
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

describe('formatLocalDate / parseLocalDate', () => {
  it('formats a date as zero-padded YYYY-MM-DD in local time', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips through parseLocalDate without drifting a day', () => {
    const parsed = parseLocalDate('2026-03-09');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2); // March = index 2
    expect(parsed.getDate()).toBe(9);
    expect(formatLocalDate(parsed)).toBe('2026-03-09');
  });
});

describe('getDaysUntilExpiration', () => {
  it('returns 0 for today', () => {
    expect(getDaysUntilExpiration(dateOffset(0))).toBe(0);
  });

  it('counts future and past days', () => {
    expect(getDaysUntilExpiration(dateOffset(5))).toBe(5);
    expect(getDaysUntilExpiration(dateOffset(-3))).toBe(-3);
  });
});

describe('getFreshnessStatus', () => {
  it('flags already-expired items', () => {
    expect(getFreshnessStatus(dateOffset(-1))).toBe('expired');
  });

  it('flags items expiring today or tomorrow', () => {
    expect(getFreshnessStatus(dateOffset(0))).toBe('expiring');
    expect(getFreshnessStatus(dateOffset(1))).toBe('expiring');
  });

  it('bins the remaining freshness windows', () => {
    expect(getFreshnessStatus(dateOffset(3))).toBe('expiring-soon');
    expect(getFreshnessStatus(dateOffset(7))).toBe('good');
    expect(getFreshnessStatus(dateOffset(30))).toBe('fresh');
  });
});
