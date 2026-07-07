import { describe, it, expect } from 'vitest';
import { nextStreak } from './index';

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('nextStreak', () => {
  it('starts a streak of 1 on the first logged day', () => {
    const result = nextStreak({ streakDays: 0, lastActiveDate: '' }, 'eaten', day('2026-07-07'));
    expect(result).toEqual({ streakDays: 1, lastActiveDate: '2026-07-07' });
  });

  it('extends the streak when the last active day was yesterday', () => {
    const result = nextStreak({ streakDays: 4, lastActiveDate: '2026-07-06' }, 'eaten', day('2026-07-07'));
    expect(result).toEqual({ streakDays: 5, lastActiveDate: '2026-07-07' });
  });

  it('resets to 1 when a day was missed', () => {
    const result = nextStreak({ streakDays: 5, lastActiveDate: '2026-07-01' }, 'donated', day('2026-07-07'));
    expect(result).toEqual({ streakDays: 1, lastActiveDate: '2026-07-07' });
  });

  it('is a no-op for a second log on the same day', () => {
    const current = { streakDays: 3, lastActiveDate: '2026-07-07' };
    expect(nextStreak(current, 'eaten', day('2026-07-07'))).toEqual(current);
  });

  it('resets the streak to 0 on a tossed action, without touching lastActiveDate', () => {
    const result = nextStreak({ streakDays: 5, lastActiveDate: '2026-07-06' }, 'tossed', day('2026-07-07'));
    expect(result).toEqual({ streakDays: 0, lastActiveDate: '2026-07-06' });
  });
});
