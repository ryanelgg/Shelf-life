// Predictive Restock (Pro)
// ─────────────────────────
// Learns how fast the user goes through staples and predicts when they'll run
// out, so we can build a shopping list *before* they notice they're low.
//
// The only persistent, dated per-item history the app keeps is the waste log
// (every 'eaten' / 'tossed' / 'composted' / 'donated' / 'shared' entry is one
// "an item left the pantry" event, stamped with a date). That depletion cadence
// — how often a given staple cycles through — is exactly the rate at which the
// user needs to restock it. Current pantry contents tell us what's on hand right
// now (so we don't tell someone to rebuy milk they just bought, and so we can
// flag "use this before you rebuy" when what they have is about to expire).
//
// This module is intentionally pure (no store / no Date.now() baked in) so the
// prediction logic is unit-tested in isolation.

import type { FoodCategory, PantryItem, WasteLog } from '../types';
import { formatLocalDate, getDaysUntilExpiration, parseLocalDate } from '../types';

export interface RestockSuggestion {
  /** Display name (from the most recent depletion event's original casing). */
  name: string;
  /** Normalized key used to group events across singular/plural spellings. */
  key: string;
  category: FoodCategory;
  /** Typical days between depletion events (median gap). */
  cadenceDays: number;
  /** Predicted run-out date, YYYY-MM-DD. */
  predictedRunOutDate: string;
  /** Days from `today` until predicted run-out (negative = overdue). */
  daysUntilRunOut: number;
  /** How sure we are — 'high' with 3+ events, 'medium' with 2. */
  confidence: 'high' | 'medium';
  /** Number of depletion events the cadence is based on. */
  eventCount: number;
  /** Suggested quantity to buy (median of past event quantities, min 1). */
  suggestedQuantity: number;
  unit: string;
  /** How many units of this staple are on hand right now. */
  inPantryQty: number;
  /**
   * True when the user already has some of this on hand AND it's expiring soon
   * — i.e. use it up before buying more, to avoid double-buying and waste.
   */
  useBeforeRebuy: boolean;
}

export interface RestockOptions {
  /** "Now". Injected so the logic is deterministic in tests. */
  today?: Date;
  /** Suggest a staple once predicted run-out is within this many days. */
  lookaheadDays?: number;
  /** An on-hand item expiring within this many days flags "use before rebuy". */
  useBeforeRebuyWindowDays?: number;
  /** Max suggestions returned (soonest run-out first). */
  limit?: number;
}

const DAY_MS = 86_400_000;

/** Conservative English plural fold, mirroring the recipe matcher in types.ts. */
function foldPlural(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Normalize a food name to a grouping key so "Eggs", "egg", and "Free-Range
 * Eggs " all collapse together. Keeps the multiset of significant words.
 */
export function normalizeStapleName(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(foldPlural)
    .sort()
    .join(' ');
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface Bucket {
  key: string;
  displayName: string;
  category: FoodCategory;
  /** Unique event dates (YYYY-MM-DD) → summed quantity depleted that day. */
  eventQtyByDate: Map<string, number>;
  latestDate: string;
}

/**
 * Compute restock suggestions from depletion history + current pantry.
 *
 * A staple is suggested when we have at least two depletion events (so we can
 * measure a cadence) and its predicted run-out falls within `lookaheadDays`.
 */
export function computeRestockSuggestions(
  pantryItems: PantryItem[],
  wasteLogs: WasteLog[],
  options: RestockOptions = {},
): RestockSuggestion[] {
  const today = startOfDay(options.today ?? new Date());
  const lookaheadDays = options.lookaheadDays ?? 7;
  const useBeforeRebuyWindowDays = options.useBeforeRebuyWindowDays ?? 3;
  const limit = options.limit ?? 12;

  // ── 1. Bucket depletion events by normalized staple name ──────────────────
  const buckets = new Map<string, Bucket>();
  for (const log of wasteLogs) {
    if (!log.itemName || !log.date) continue;
    const key = normalizeStapleName(log.itemName);
    if (!key) continue;

    let b = buckets.get(key);
    if (!b) {
      b = {
        key,
        displayName: log.itemName.trim(),
        category: log.category,
        eventQtyByDate: new Map(),
        latestDate: log.date,
      };
      buckets.set(key, b);
    }
    // Collapse multiple same-day logs into one event (sum their quantities).
    const qty = Math.max(1, Math.round(log.quantity || 1));
    b.eventQtyByDate.set(log.date, (b.eventQtyByDate.get(log.date) ?? 0) + qty);
    // Track the most recent event's metadata for display.
    if (log.date >= b.latestDate) {
      b.latestDate = log.date;
      b.displayName = log.itemName.trim();
      b.category = log.category;
    }
  }

  // ── 2. Index current pantry by the same key (what's on hand right now) ────
  const onHand = new Map<string, { qty: number; soonestExpiryDays: number; unit: string }>();
  for (const item of pantryItems) {
    const key = normalizeStapleName(item.name);
    if (!key) continue;
    const days = getDaysUntilExpiration(item.expirationDate);
    const existing = onHand.get(key);
    if (existing) {
      existing.qty += Math.max(0, item.quantity);
      existing.soonestExpiryDays = Math.min(existing.soonestExpiryDays, days);
    } else {
      onHand.set(key, {
        qty: Math.max(0, item.quantity),
        soonestExpiryDays: days,
        unit: item.unit || 'pcs',
      });
    }
  }

  // ── 3. Turn each bucket with a measurable cadence into a suggestion ────────
  const suggestions: RestockSuggestion[] = [];
  for (const b of buckets.values()) {
    const dates = Array.from(b.eventQtyByDate.keys()).sort();
    if (dates.length < 2) continue; // need >=2 events to measure a cadence

    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const prev = parseLocalDate(dates[i - 1]).getTime();
      const cur = parseLocalDate(dates[i]).getTime();
      const gap = Math.round((cur - prev) / DAY_MS);
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length === 0) continue; // all events same day — no usable cadence

    const cadenceDays = Math.max(1, Math.round(median(gaps.slice().sort((a, z) => a - z))));

    const hand = onHand.get(b.key);
    // Anchor the prediction at the later of: last depletion, or when the
    // on-hand stock was most recently topped up (its date isn't tracked, so we
    // conservatively anchor at the last depletion event).
    const anchor = parseLocalDate(b.latestDate).getTime();
    const predictedRunOut = new Date(anchor + cadenceDays * DAY_MS);
    const daysUntilRunOut = Math.round((startOfDay(predictedRunOut).getTime() - today.getTime()) / DAY_MS);

    if (daysUntilRunOut > lookaheadDays) continue; // not low enough yet

    const qtyValues = Array.from(b.eventQtyByDate.values()).sort((a, z) => a - z);
    const suggestedQuantity = Math.max(1, Math.round(median(qtyValues)));

    const useBeforeRebuy = !!hand
      && hand.qty > 0
      && hand.soonestExpiryDays <= useBeforeRebuyWindowDays;

    suggestions.push({
      name: b.displayName,
      key: b.key,
      category: b.category,
      cadenceDays,
      predictedRunOutDate: formatLocalDate(startOfDay(predictedRunOut)),
      daysUntilRunOut,
      confidence: dates.length >= 3 ? 'high' : 'medium',
      eventCount: dates.length,
      suggestedQuantity,
      unit: hand?.unit ?? 'pcs',
      inPantryQty: hand?.qty ?? 0,
      useBeforeRebuy,
    });
  }

  // Soonest run-out first; ties broken by higher confidence.
  suggestions.sort((a, z) =>
    a.daysUntilRunOut - z.daysUntilRunOut
    || (z.confidence === 'high' ? 1 : 0) - (a.confidence === 'high' ? 1 : 0),
  );

  return suggestions.slice(0, limit);
}

/** Friendly "runs out" phrase for a suggestion. */
export function runOutLabel(daysUntilRunOut: number): string {
  if (daysUntilRunOut < 0) return `likely out ${Math.abs(daysUntilRunOut)}d ago`;
  if (daysUntilRunOut === 0) return 'runs out today';
  if (daysUntilRunOut === 1) return 'runs out tomorrow';
  return `runs out in ~${daysUntilRunOut}d`;
}
