import type { ImpactStats } from './impact';

// Nature-themed achievement tracks. Every track is a *growth* metaphor: the
// more you save, the more your icon grows (a sprout → a mighty tree, a seed →
// a full harvest). Tiers are ordered ascending by threshold.

export interface BadgeTier {
  level: number;     // 1-based rank within the track
  name: string;
  emoji: string;
  threshold: number; // metric value needed to reach this tier
  blurb: string;
}

export type BadgeMetric = 'co2' | 'money' | 'rescued' | 'streak' | 'shared' | 'composted';

export interface BadgeTrack {
  id: string;
  title: string;
  metric: BadgeMetric;
  unit: string;      // shown next to the number, e.g. 'kg', 'items', 'days'
  tiers: BadgeTier[];
}

export interface BadgeStanding {
  track: BadgeTrack;
  value: number;          // current metric value
  current: BadgeTier | null;  // highest tier reached (null = none yet)
  next: BadgeTier | null;     // next tier to reach (null = maxed out)
  emoji: string;          // icon to display now (current tier, or the seed if none)
  earnedTierIds: string[];
}

export const BADGE_TRACKS: BadgeTrack[] = [
  {
    // The flagship "growing tree" track.
    id: 'carbon-forest',
    title: 'Carbon Forest',
    metric: 'co2',
    unit: 'kg CO₂',
    tiers: [
      { level: 1, name: 'Sprout',      emoji: '🌱', threshold: 2,  blurb: 'Kept 2 kg of CO₂ out of the air.' },
      { level: 2, name: 'Sapling',     emoji: '🌿', threshold: 8,  blurb: 'A young plant — 8 kg saved.' },
      { level: 3, name: 'Tree',        emoji: '🌳', threshold: 20, blurb: 'A real tree now — 20 kg saved.' },
      { level: 4, name: 'Old-Growth',  emoji: '🌲', threshold: 50, blurb: 'A towering evergreen — 50 kg saved.' },
    ],
  },
  {
    id: 'bountiful-harvest',
    title: 'Bountiful Harvest',
    metric: 'money',
    unit: '$',
    tiers: [
      { level: 1, name: 'Seedling',    emoji: '🌱', threshold: 10,  blurb: 'Saved your first $10 from the bin.' },
      { level: 2, name: 'Budding',     emoji: '🌷', threshold: 50,  blurb: '$50 saved — it’s blooming.' },
      { level: 3, name: 'Flourishing', emoji: '🌻', threshold: 150, blurb: '$150 saved — in full bloom.' },
      { level: 4, name: 'Harvest',     emoji: '🧺', threshold: 500, blurb: 'A full basket — $500 saved!' },
    ],
  },
  {
    id: 'food-rescuer',
    title: 'Food Rescuer',
    metric: 'rescued',
    unit: 'items',
    tiers: [
      { level: 1, name: 'Forager',  emoji: '🍃', threshold: 10,  blurb: 'Rescued 10 items from going to waste.' },
      { level: 2, name: 'Gatherer', emoji: '🥕', threshold: 40,  blurb: '40 items rescued.' },
      { level: 3, name: 'Provider', emoji: '🧺', threshold: 100, blurb: '100 items rescued.' },
      { level: 4, name: 'Steward',  emoji: '🌾', threshold: 250, blurb: '250 items rescued — a true steward.' },
    ],
  },
  {
    id: 'evergreen',
    title: 'Evergreen Streak',
    metric: 'streak',
    unit: 'days',
    tiers: [
      { level: 1, name: 'Sprout',     emoji: '🌱', threshold: 3,   blurb: '3-day streak.' },
      { level: 2, name: 'Sapling',    emoji: '🌿', threshold: 7,   blurb: 'A full week.' },
      { level: 3, name: 'Tree',       emoji: '🌳', threshold: 14,  blurb: 'Two weeks strong.' },
      { level: 4, name: 'Evergreen',  emoji: '🌲', threshold: 30,  blurb: 'A whole month!' },
      { level: 5, name: 'Mountain',   emoji: '🏔️', threshold: 100, blurb: '100 days — unstoppable.' },
    ],
  },
  {
    id: 'good-neighbor',
    title: 'Good Neighbor',
    metric: 'shared',
    unit: 'shared',
    tiers: [
      { level: 1, name: 'Friendly Bee', emoji: '🐝', threshold: 1,  blurb: 'Shared or donated your first item.' },
      { level: 2, name: 'Blossom',      emoji: '🌼', threshold: 5,  blurb: 'Shared 5 items with others.' },
      { level: 3, name: 'Honey Maker',  emoji: '🍯', threshold: 15, blurb: 'Shared 15 items — sweet.' },
    ],
  },
  {
    id: 'earth-friend',
    title: 'Earth Friend',
    metric: 'composted',
    unit: 'composted',
    tiers: [
      { level: 1, name: 'Fallen Leaf', emoji: '🍂', threshold: 5,  blurb: 'Composted 5 items.' },
      { level: 2, name: 'Earthworm',   emoji: '🪱', threshold: 20, blurb: 'Composted 20 items.' },
      { level: 3, name: 'Whole Earth', emoji: '🌍', threshold: 50, blurb: 'Composted 50 items — the soil thanks you.' },
    ],
  },
];

export function tierId(trackId: string, level: number): string {
  return `${trackId}:${level}`;
}

function metricValue(stats: ImpactStats, bestStreak: number, metric: BadgeMetric): number {
  switch (metric) {
    case 'co2': return stats.co2Kg;
    case 'money': return stats.moneySaved;
    case 'rescued': return stats.itemsSaved;
    case 'streak': return bestStreak;
    case 'shared': return stats.sharedCount;
    case 'composted': return stats.compostedCount;
  }
}

export function badgeStandings(stats: ImpactStats, bestStreak: number): BadgeStanding[] {
  return BADGE_TRACKS.map((track) => {
    const value = metricValue(stats, bestStreak, track.metric);
    let current: BadgeTier | null = null;
    let next: BadgeTier | null = null;
    const earnedTierIds: string[] = [];
    for (const tier of track.tiers) {
      if (value >= tier.threshold) {
        current = tier;
        earnedTierIds.push(tierId(track.id, tier.level));
      } else if (next === null) {
        next = tier;
      }
    }
    return {
      track,
      value,
      current,
      next,
      emoji: current?.emoji ?? track.tiers[0].emoji,
      earnedTierIds,
    };
  });
}

export function allEarnedTierIds(standings: BadgeStanding[]): string[] {
  return standings.flatMap((s) => s.earnedTierIds);
}

// Given the tiers the user has already seen celebrated, return the first newly
// earned tier (for the "New badge!" moment on the weekly card / toast).
export function firstNewBadge(
  standings: BadgeStanding[],
  seenTierIds: string[],
): { emoji: string; name: string; trackTitle: string } | null {
  const seen = new Set(seenTierIds);
  for (const s of standings) {
    for (const tier of s.track.tiers) {
      const id = tierId(s.track.id, tier.level);
      if (s.earnedTierIds.includes(id) && !seen.has(id)) {
        return { emoji: tier.emoji, name: tier.name, trackTitle: s.track.title };
      }
    }
  }
  return null;
}
