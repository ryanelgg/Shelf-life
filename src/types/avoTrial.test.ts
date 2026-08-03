import { describe, it, expect } from 'vitest';
import { isAvoTrialActive, avoTrialDaysLeft, initialTrialStamp, TRIAL_USED_SENTINEL } from './index';

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

describe('initialTrialStamp — onboarding trial sentinel (regression: onboard-into-Pro handed a free trial on cancel)', () => {
  it('a free onboarding leaves the trial unstarted (lazy start on first chat)', () => {
    expect(initialTrialStamp('free')).toBeNull();
  });

  it('onboarding straight into Pro pre-marks the trial used', () => {
    expect(initialTrialStamp('pro')).toBe(TRIAL_USED_SENTINEL);
  });

  it('the sentinel reads as an expired (inactive) trial', () => {
    // So a user who onboards Pro, then cancels to free, does NOT get a fresh
    // 7-day Avo trial: their avoTrialStartedAt already looks spent.
    const stamped = { avoTrialStartedAt: initialTrialStamp('pro') };
    expect(isAvoTrialActive(stamped, day('2026-07-02'))).toBe(false);
    expect(avoTrialDaysLeft(stamped, day('2026-07-02'))).toBe(0);
  });
});
