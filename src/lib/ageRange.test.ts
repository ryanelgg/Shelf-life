import { describe, it, expect } from 'vitest';
import { interpretAgeRange, type DeclaredAgeRangeResult } from './ageRange';

const shared = (lowerBound: number | null, upperBound: number | null): DeclaredAgeRangeResult => ({
  status: 'shared',
  lowerBound,
  upperBound,
});

describe('interpretAgeRange — maps a declared range to Pantre flags', () => {
  it('treats declined/unavailable as no signal (keeps the self-declared gate)', () => {
    expect(interpretAgeRange({ status: 'declined' })).toEqual({
      isUnder13: false,
      isMinor: false,
      shared: false,
    });
    expect(interpretAgeRange({ status: 'unavailable' })).toEqual({
      isUnder13: false,
      isMinor: false,
      shared: false,
    });
  });

  it('flags under-13 (COPPA) — upper bound below 13', () => {
    const s = interpretAgeRange(shared(null, 12));
    expect(s.isUnder13).toBe(true);
    expect(s.isMinor).toBe(true); // under 13 is necessarily a minor
    expect(s.shared).toBe(true);
  });

  it('flags 13–17 as a minor but not under-13', () => {
    const s = interpretAgeRange(shared(13, 17));
    expect(s.isUnder13).toBe(false);
    expect(s.isMinor).toBe(true);
  });

  it('treats "18 or older" (no upper bound) as neither', () => {
    const s = interpretAgeRange(shared(18, null));
    expect(s.isUnder13).toBe(false);
    expect(s.isMinor).toBe(false);
  });

  it('flags a 16–17 bucket as a minor', () => {
    const s = interpretAgeRange(shared(16, 17));
    expect(s.isMinor).toBe(true);
    expect(s.isUnder13).toBe(false);
  });
});
