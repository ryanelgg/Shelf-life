import { describe, it, expect } from 'vitest';
import { isAvoTrialActive, avoTrialDaysLeft } from './index';

// Trial started 2026-07-02, 7-day window.
const started = { avoTrialStartedAt: '2026-07-02' };
const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('Avo 7-day trial', () => {
  it('is inactive when never started', () => {
    expect(isAvoTrialActive({ avoTrialStartedAt: null }, day('2026-07-02'))).toBe(false);
    expect(avoTrialDaysLeft({ avoTrialStartedAt: null }, day('2026-07-02'))).toBe(0);
  });

  it('gives a full 7 days on the day it starts', () => {
    expect(avoTrialDaysLeft(started, day('2026-07-02'))).toBe(7);
    expect(isAvoTrialActive(started, day('2026-07-02'))).toBe(true);
  });

  it('counts down day by day', () => {
    expect(avoTrialDaysLeft(started, day('2026-07-05'))).toBe(4);
    expect(isAvoTrialActive(started, day('2026-07-05'))).toBe(true);
  });

  it('expires after 7 days', () => {
    expect(avoTrialDaysLeft(started, day('2026-07-09'))).toBe(0);
    expect(isAvoTrialActive(started, day('2026-07-09'))).toBe(false);
    expect(isAvoTrialActive(started, day('2026-07-20'))).toBe(false);
  });
});
