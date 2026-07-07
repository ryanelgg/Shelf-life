import { describe, it, expect } from 'vitest';
import { isAvoTrialActive, avoTrialDaysLeft, nextAvoTrialStartedAt, AVO_TRIAL_USED_SENTINEL } from './index';

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

describe('nextAvoTrialStartedAt (cancel-Pro trial hole)', () => {
  it('stamps the used sentinel when a never-trialed user becomes Pro', () => {
    const result = nextAvoTrialStartedAt({ avoTrialStartedAt: null }, 'pro');
    expect(result).toBe(AVO_TRIAL_USED_SENTINEL);
    // and that sentinel reads as an already-expired trial, not an active one
    expect(isAvoTrialActive({ avoTrialStartedAt: result }, day('2026-07-07'))).toBe(false);
  });

  it('cancelling Pro no longer grants a fresh trial', () => {
    // Pro from day one: never started a trial, then cancels.
    const proFromSignup = nextAvoTrialStartedAt({ avoTrialStartedAt: null }, 'pro');
    const afterCancel = nextAvoTrialStartedAt({ avoTrialStartedAt: proFromSignup }, 'free');
    expect(afterCancel).toBe(AVO_TRIAL_USED_SENTINEL);
    expect(isAvoTrialActive({ avoTrialStartedAt: afterCancel }, day('2026-07-07'))).toBe(false);
  });

  it('leaves a real, already-used trial date untouched on cancel', () => {
    const result = nextAvoTrialStartedAt({ avoTrialStartedAt: '2026-07-02' }, 'free');
    expect(result).toBe('2026-07-02');
  });

  it('does nothing when upgrading a user who already ran a real trial', () => {
    const result = nextAvoTrialStartedAt({ avoTrialStartedAt: '2026-07-02' }, 'pro');
    expect(result).toBe('2026-07-02');
  });
});
