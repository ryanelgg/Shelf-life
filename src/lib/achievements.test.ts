import { describe, it, expect } from 'vitest';
import { computeZeroWasteStreak, computeAchievements } from './achievements';
import type { WasteAction, WasteLog } from '../types';

let seq = 0;
function log(date: string, action: WasteAction, extra: Partial<WasteLog> = {}): WasteLog {
  return {
    id: `w-${seq++}`,
    itemName: 'Item',
    category: 'Dairy',
    action,
    date,
    estimatedValue: 2,
    quantity: 1,
    ...extra,
  };
}

// Helper: build N consecutive clean (saved) days ending on `endDate`.
function cleanRun(endDate: string, days: number): WasteLog[] {
  const out: WasteLog[] = [];
  const [y, m, d] = endDate.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(y, m - 1, d - i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push(log(iso, 'eaten'));
  }
  return out;
}

const TODAY = new Date(2026, 6, 6); // 2026-07-06

describe('computeZeroWasteStreak', () => {
  it('counts consecutive clean days ending today', () => {
    const logs = cleanRun('2026-07-06', 5);
    expect(computeZeroWasteStreak(logs, TODAY)).toEqual({ current: 5, best: 5 });
  });

  it('anchors at yesterday when today has no activity yet', () => {
    const logs = cleanRun('2026-07-05', 4); // nothing logged today
    const s = computeZeroWasteStreak(logs, TODAY);
    expect(s.current).toBe(4);
  });

  it('a tossed item today breaks the current streak', () => {
    const logs = [...cleanRun('2026-07-05', 6), log('2026-07-06', 'tossed')];
    const s = computeZeroWasteStreak(logs, TODAY);
    expect(s.current).toBe(0);
    expect(s.best).toBe(6); // the prior clean run still counts as best-ever
  });

  it('a tossed item mid-run breaks the streak (both segments measured)', () => {
    // 4 clean days, a toss, then 3 clean days ending today.
    const logs = [
      ...cleanRun('2026-06-25', 4),
      log('2026-06-26', 'tossed'),
      ...cleanRun('2026-07-06', 3),
    ];
    const s = computeZeroWasteStreak(logs, TODAY);
    expect(s.current).toBe(3);
    expect(s.best).toBe(4);
  });

  it('a gap day (no logs) breaks the run', () => {
    // clean 07-01..07-02, gap 07-03, clean 07-04..07-06
    const logs = [
      log('2026-07-01', 'eaten'), log('2026-07-02', 'eaten'),
      log('2026-07-04', 'eaten'), log('2026-07-05', 'eaten'), log('2026-07-06', 'eaten'),
    ];
    const s = computeZeroWasteStreak(logs, TODAY);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('a day with both a save and a toss is not clean', () => {
    const logs = [
      ...cleanRun('2026-07-04', 3),
      log('2026-07-05', 'eaten'), log('2026-07-05', 'tossed'),
      log('2026-07-06', 'eaten'),
    ];
    const s = computeZeroWasteStreak(logs, TODAY);
    expect(s.current).toBe(1); // only today is clean
  });

  it('returns zero for no logs', () => {
    expect(computeZeroWasteStreak([], TODAY)).toEqual({ current: 0, best: 0 });
  });
});

describe('computeAchievements', () => {
  it('unlocks Zero-Waste Week after 7 clean days in a row', () => {
    const logs = cleanRun('2026-07-06', 7);
    const { zeroWasteWeek, achievements } = computeAchievements(logs, TODAY);
    expect(zeroWasteWeek.earned).toBe(true);
    const week = achievements.find(a => a.id === 'zero-waste-week')!;
    expect(week.earned).toBe(true);
    expect(week.current).toBe(week.target);
    expect(week.featured).toBe(true);
  });

  it('shows partial week progress before the badge is earned', () => {
    const logs = cleanRun('2026-07-06', 4);
    const { zeroWasteWeek, achievements } = computeAchievements(logs, TODAY);
    expect(zeroWasteWeek.earned).toBe(false);
    expect(zeroWasteWeek.weekProgress).toBe(4);
    const week = achievements.find(a => a.id === 'zero-waste-week')!;
    expect(week.current).toBe(4);
    expect(week.earned).toBe(false);
  });

  it('keeps Zero-Waste Week earned even after a later slip', () => {
    // 7 clean days, then a toss today.
    const logs = [...cleanRun('2026-07-05', 7), log('2026-07-06', 'tossed')];
    const { zeroWasteWeek } = computeAchievements(logs, TODAY);
    expect(zeroWasteWeek.streak.current).toBe(0);
    expect(zeroWasteWeek.earned).toBe(true); // best-ever run unlocked it
  });

  it('earns count- and money-based badges from totals', () => {
    const logs = [
      log('2026-07-01', 'eaten', { estimatedValue: 30, quantity: 1 }),
      log('2026-07-02', 'shared', { estimatedValue: 25, quantity: 1 }),
      log('2026-07-03', 'donated', { estimatedValue: 10, quantity: 1 }),
      log('2026-07-03', 'tossed', { estimatedValue: 99, quantity: 1 }), // excluded from savings
    ];
    const { achievements, earnedCount, total } = computeAchievements(logs, TODAY);
    expect(achievements.find(a => a.id === 'first-rescue')!.earned).toBe(true);
    expect(achievements.find(a => a.id === 'money-50')!.earned).toBe(true); // 30+25+10 = 65
    expect(achievements.find(a => a.id === 'good-neighbor')!.earned).toBe(false); // only 2 shared/donated
    expect(achievements.find(a => a.id === 'warrior-100')!.earned).toBe(false);
    expect(total).toBe(8);
    expect(earnedCount).toBeGreaterThanOrEqual(2);
  });

  it('starts fully locked with no history', () => {
    const { earnedCount } = computeAchievements([], TODAY);
    expect(earnedCount).toBe(0);
  });
});
