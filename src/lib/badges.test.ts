import { describe, it, expect } from 'vitest';
import { computeImpactStats, weekId, logsThisWeek } from './impact';
import { badgeStandings, firstNewBadge, tierId } from './badges';
import { formatLocalDate } from '../types';
import type { WasteLog } from '../types';

function log(partial: Partial<WasteLog>): WasteLog {
  return {
    id: Math.random().toString(36),
    itemName: 'Item',
    category: 'Produce',
    action: 'eaten',
    date: '2026-06-28',
    estimatedValue: 5,
    quantity: 1,
    ...partial,
  };
}

describe('computeImpactStats', () => {
  it('counts everything except tossed as a save', () => {
    const stats = computeImpactStats([
      log({ action: 'eaten', estimatedValue: 4, quantity: 2 }),     // $8 saved
      log({ action: 'tossed', estimatedValue: 10, quantity: 1 }),    // wasted
      log({ action: 'composted', estimatedValue: 3, quantity: 1 }),  // $3 saved
      log({ action: 'donated', estimatedValue: 6, quantity: 1 }),    // $6 saved
    ]);
    expect(stats.totalItems).toBe(4);
    expect(stats.tossed).toBe(1);
    expect(stats.itemsSaved).toBe(3);
    expect(stats.moneySaved).toBe(17);
    expect(stats.compostedCount).toBe(1);
    expect(stats.sharedCount).toBe(1); // donated counts as shared
    expect(stats.saveRate).toBe(75);
    expect(stats.co2Kg).toBeCloseTo(1.5);
  });

  it('is all zero with no logs', () => {
    const stats = computeImpactStats([]);
    expect(stats.itemsSaved).toBe(0);
    expect(stats.saveRate).toBe(0);
  });
});

describe('badgeStandings', () => {
  it('awards the highest reached tier and points to the next', () => {
    // 30 saved items → 15 kg CO₂ → Carbon Forest "Sapling" (8) reached, "Tree" (20) next
    const stats = computeImpactStats(
      Array.from({ length: 30 }, () => log({ action: 'eaten' })),
    );
    const forest = badgeStandings(stats, 0).find((s) => s.track.id === 'carbon-forest')!;
    expect(forest.current?.name).toBe('Sapling');
    expect(forest.next?.name).toBe('Tree');
    expect(forest.emoji).toBe('🌿');
    expect(forest.earnedTierIds).toContain(tierId('carbon-forest', 1));
    expect(forest.earnedTierIds).toContain(tierId('carbon-forest', 2));
    expect(forest.earnedTierIds).not.toContain(tierId('carbon-forest', 3));
  });

  it('uses best streak for the evergreen track', () => {
    const standings = badgeStandings(computeImpactStats([]), 14);
    const evergreen = standings.find((s) => s.track.id === 'evergreen')!;
    expect(evergreen.current?.name).toBe('Tree');
  });

  it('gives no current tier below the first threshold', () => {
    const forest = badgeStandings(computeImpactStats([]), 0).find((s) => s.track.id === 'carbon-forest')!;
    expect(forest.current).toBeNull();
    expect(forest.next?.name).toBe('Sprout');
  });
});

describe('firstNewBadge', () => {
  it('returns the first earned tier not yet seen', () => {
    const stats = computeImpactStats(Array.from({ length: 30 }, () => log({ action: 'eaten' })));
    const standings = badgeStandings(stats, 0);
    const seen = [tierId('carbon-forest', 1)]; // Sprout already celebrated
    const fresh = firstNewBadge(standings, seen);
    expect(fresh?.name).toBe('Sapling');
  });

  it('returns null when everything earned has been seen', () => {
    const standings = badgeStandings(computeImpactStats([]), 0);
    expect(firstNewBadge(standings, [])).toBeNull();
  });
});

describe('weekId / logsThisWeek', () => {
  it('buckets a Monday and the following Sunday into the same week', () => {
    expect(weekId(new Date(2026, 5, 22))).toBe(weekId(new Date(2026, 5, 28))); // Mon..Sun
    expect(weekId(new Date(2026, 5, 22))).not.toBe(weekId(new Date(2026, 5, 29))); // next Mon
  });

  it('only includes logs dated within the current week', () => {
    const now = new Date(2026, 5, 25); // Thursday
    const thisWeek = formatLocalDate(new Date(2026, 5, 23));
    const lastWeek = formatLocalDate(new Date(2026, 5, 15));
    const result = logsThisWeek([log({ date: thisWeek }), log({ date: lastWeek })], now);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe(thisWeek);
  });
});
