// Badge Achievements
// ──────────────────
// Milestones the user unlocks purely from their waste-log history — no extra
// persisted state, so badges stay in sync across devices/household for free.
//
// The headline badge is **Zero-Waste Week**: seven calendar days in a row where
// the user saved food (any non-toss action) and tossed nothing. A single tossed
// item, or a day with no activity, breaks the run. We surface both the current
// run (for "X / 7 this week" progress) and the best-ever run (which is what
// actually unlocks the badge, so it stays earned even after a later slip).

import type { WasteAction, WasteLog } from '../types';
import { formatLocalDate, parseLocalDate } from '../types';

const SAVE_ACTIONS: WasteAction[] = ['eaten', 'composted', 'shared', 'donated'];

export interface ZeroWasteStreak {
  /** Current consecutive zero-waste days, anchored at today or yesterday. */
  current: number;
  /** Longest zero-waste run ever achieved (what unlocks the week/month badge). */
  best: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  /** Plain-language "how you earn it". */
  description: string;
  /** Goal value for the progress bar. */
  target: number;
  /** Progress toward the goal (already clamped to [0, target] for display). */
  current: number;
  earned: boolean;
  /** The one badge we spotlight with a dedicated progress card. */
  featured?: boolean;
}

export interface AchievementsResult {
  achievements: Achievement[];
  earnedCount: number;
  total: number;
  zeroWasteWeek: {
    streak: ZeroWasteStreak;
    /** Days completed toward the current 7-day week (0–7). */
    weekProgress: number;
    earned: boolean;
  };
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Compute the current and best zero-waste streaks from the logs.
 * A day is "clean" when it has ≥1 save action and no tossed action.
 */
export function computeZeroWasteStreak(logs: WasteLog[], today: Date = new Date()): ZeroWasteStreak {
  const saveDays = new Set<string>();
  const tossDays = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const log of logs) {
    if (!log.date) continue;
    if (log.action === 'tossed') tossDays.add(log.date);
    else if (SAVE_ACTIONS.includes(log.action)) saveDays.add(log.date);
    if (minDate === null || log.date < minDate) minDate = log.date;
    if (maxDate === null || log.date > maxDate) maxDate = log.date;
  }

  const isClean = (d: Date): boolean => {
    const key = formatLocalDate(d);
    return saveDays.has(key) && !tossDays.has(key);
  };

  // ── Current streak: anchor at today, or yesterday if today has no activity ──
  let current = 0;
  const start = startOfDay(today);
  let cursor = start;
  const todayKey = formatLocalDate(start);
  if (!isClean(cursor)) {
    // A toss today breaks the streak outright; otherwise (no activity yet)
    // allow the run to still count through yesterday.
    if (!tossDays.has(todayKey) && !saveDays.has(todayKey)) {
      cursor = addDays(cursor, -1);
    } else {
      cursor = null as unknown as Date;
    }
  }
  while (cursor && isClean(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // ── Best streak: scan every calendar day across the logged range ────────────
  let best = 0;
  if (minDate && maxDate) {
    let running = 0;
    let d = parseLocalDate(minDate);
    const end = parseLocalDate(maxDate);
    // Bounded by the logged date range; guard against pathological inputs.
    for (let i = 0; d.getTime() <= end.getTime() && i < 20000; i++) {
      if (isClean(d)) {
        running++;
        if (running > best) best = running;
      } else {
        running = 0;
      }
      d = addDays(d, 1);
    }
  }
  best = Math.max(best, current);

  return { current, best };
}

/**
 * Build the full badge set from the user's waste logs.
 * `moneySaved` mirrors ImpactScreen's definition (value × quantity of non-toss).
 */
export function computeAchievements(logs: WasteLog[], today: Date = new Date()): AchievementsResult {
  const itemsSaved = logs.filter(l => l.action !== 'tossed').length;
  const moneySaved = logs
    .filter(l => l.action !== 'tossed')
    .reduce((sum, l) => sum + l.estimatedValue * l.quantity, 0);
  const sharedDonated = logs.filter(l => l.action === 'shared' || l.action === 'donated').length;

  const streak = computeZeroWasteStreak(logs, today);
  const weekEarned = streak.best >= 7;
  const monthEarned = streak.best >= 30;

  // For streak badges, progress toward earning uses the *current* run; once
  // earned it reads as complete regardless of a later slip.
  const streakProgress = (target: number, earned: boolean) =>
    earned ? target : Math.min(streak.current, target);

  const count = (value: number, target: number) => Math.min(Math.round(value), target);

  const achievements: Achievement[] = [
    {
      id: 'first-rescue', emoji: '🌱', title: 'First Rescue',
      description: 'Save your first item from the bin',
      target: 1, current: count(itemsSaved, 1), earned: itemsSaved >= 1,
    },
    {
      id: 'zero-waste-week', emoji: '🥑', title: 'Zero-Waste Week',
      description: '7 days in a row saving food with nothing tossed',
      target: 7, current: streakProgress(7, weekEarned), earned: weekEarned, featured: true,
    },
    {
      id: 'rescuer-25', emoji: '♻️', title: 'Rescuer',
      description: 'Save 25 items before they expire',
      target: 25, current: count(itemsSaved, 25), earned: itemsSaved >= 25,
    },
    {
      id: 'money-50', emoji: '💰', title: 'Fifty Saved',
      description: 'Save $50 worth of food',
      target: 50, current: count(moneySaved, 50), earned: moneySaved >= 50,
    },
    {
      id: 'zero-waste-month', emoji: '🔥', title: 'Zero-Waste Month',
      description: '30-day zero-waste streak',
      target: 30, current: streakProgress(30, monthEarned), earned: monthEarned,
    },
    {
      id: 'good-neighbor', emoji: '🤝', title: 'Good Neighbor',
      description: 'Share or donate 5 items',
      target: 5, current: count(sharedDonated, 5), earned: sharedDonated >= 5,
    },
    {
      id: 'warrior-100', emoji: '🏆', title: 'Waste Warrior',
      description: 'Save 100 items in total',
      target: 100, current: count(itemsSaved, 100), earned: itemsSaved >= 100,
    },
    {
      id: 'money-250', emoji: '💎', title: 'Big Saver',
      description: 'Save $250 worth of food',
      target: 250, current: count(moneySaved, 250), earned: moneySaved >= 250,
    },
  ];

  return {
    achievements,
    earnedCount: achievements.filter(a => a.earned).length,
    total: achievements.length,
    zeroWasteWeek: {
      streak,
      weekProgress: Math.min(streak.current, 7),
      earned: weekEarned,
    },
  };
}
