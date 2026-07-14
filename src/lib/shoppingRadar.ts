import type { FoodCategory, PantryItem, WasteLog } from '../types';
import { parseLocalDate, formatLocalDate } from '../types';

// ── Avo's Shopping Radar (Predictive Restock) — PREMIUM ──────────────────────
//
// Learns how fast you go through each staple from the history you already have
// — when items were added to the pantry and when they left (waste logs, any
// action) — then predicts when you'll run out and offers to build a shopping
// list. Fully local + deterministic: no AI call, no server, no extra cost.
//
// The signal is the cadence of activity for a normalized item name. Buying an
// item is an "activity" that resets the clock; using it up is another. The mean
// gap between activity dates approximates how often you replenish it, so
// last activity + mean gap ≈ your next run-out. Because a fresh purchase resets
// "last activity" to today, an item you just restocked is naturally pushed out
// of the horizon and won't nag you.

/** Minimum distinct activity dates before we'll predict (→ at least 2 gaps). */
export const RADAR_MIN_EVENTS = 3;
/** Surface an item when it's predicted to run out within this many days (incl. overdue). */
export const RADAR_HORIZON_DAYS = 4;

const DAY_MS = 86_400_000;

export interface RestockPrediction {
  key: string;                 // normalized match key
  name: string;                // freshest display name
  category: FoodCategory;
  unit: string;
  quantity: number;            // suggested quantity to buy
  avgIntervalDays: number;     // learned restock cadence
  lastActivityDate: string;    // YYYY-MM-DD
  predictedRunOutDate: string; // YYYY-MM-DD
  daysUntilRunOut: number;     // negative = overdue
  confidence: 'high' | 'medium' | 'low';
  inPantry: boolean;           // still have unexpired stock on hand
}

/** Lowercase, collapse whitespace, and lightly singularize so "Eggs"/"egg" fold together. */
export function normalizeName(raw: string): string {
  let s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s;
}

function addDaysStr(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

function daysBetween(fromStr: string, toStr: string): number {
  return Math.round((parseLocalDate(toStr).getTime() - parseLocalDate(fromStr).getTime()) / DAY_MS);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Agg {
  key: string;
  name: string;
  nameDate: string;      // date the display name was last seen (freshest wins)
  category: FoodCategory;
  catDate: string;
  unit: string;
  unitDate: string;      // unit only comes from pantry items
  quantities: number[];
  dates: Set<string>;
  freshInPantry: boolean;
}

/**
 * Predict which staples are about to run out, most-urgent first. Pure and
 * deterministic — pass a fixed `today` in tests. Returns [] when there isn't
 * enough history to be useful (we'd rather stay quiet than guess).
 */
export function predictRestocks(
  pantryItems: PantryItem[],
  wasteLogs: WasteLog[],
  today: Date = new Date(),
): RestockPrediction[] {
  const todayStr = formatLocalDate(today);
  const map = new Map<string, Agg>();

  const ensure = (key: string, name: string, category: FoodCategory): Agg => {
    let agg = map.get(key);
    if (!agg) {
      agg = { key, name, nameDate: '', category, catDate: '', unit: '', unitDate: '', quantities: [], dates: new Set(), freshInPantry: false };
      map.set(key, agg);
    }
    return agg;
  };

  for (const it of pantryItems) {
    const key = normalizeName(it.name);
    if (!key) continue;
    const agg = ensure(key, it.name, it.category);
    agg.dates.add(it.addedDate);
    agg.quantities.push(it.quantity);
    if (it.addedDate >= agg.nameDate) { agg.name = it.name; agg.nameDate = it.addedDate; }
    if (it.addedDate >= agg.catDate) { agg.category = it.category; agg.catDate = it.addedDate; }
    if (it.addedDate >= agg.unitDate) { agg.unit = it.unit; agg.unitDate = it.addedDate; }
    if (it.expirationDate >= todayStr) agg.freshInPantry = true;
  }

  for (const w of wasteLogs) {
    const key = normalizeName(w.itemName);
    if (!key) continue;
    const agg = ensure(key, w.itemName, w.category);
    agg.dates.add(w.date);
    if (w.quantity > 0) agg.quantities.push(w.quantity);
    if (w.date >= agg.nameDate) { agg.name = w.itemName; agg.nameDate = w.date; }
    if (w.date >= agg.catDate) { agg.category = w.category; agg.catDate = w.date; }
  }

  const predictions: RestockPrediction[] = [];
  for (const agg of map.values()) {
    const dates = [...agg.dates].sort();
    if (dates.length < RADAR_MIN_EVENTS) continue;

    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const g = daysBetween(dates[i - 1], dates[i]);
      if (g > 0) gaps.push(g);
    }
    if (gaps.length < 2) continue;

    const avgIntervalDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    if (avgIntervalDays <= 0) continue;

    const lastActivityDate = dates[dates.length - 1];
    const predictedRunOutDate = addDaysStr(lastActivityDate, avgIntervalDays);
    const daysUntilRunOut = daysBetween(todayStr, predictedRunOutDate);
    if (daysUntilRunOut > RADAR_HORIZON_DAYS) continue;

    const qty = Math.max(1, Math.round(median(agg.quantities)));
    const confidence: RestockPrediction['confidence'] =
      gaps.length >= 4 ? 'high' : gaps.length >= 3 ? 'medium' : 'low';

    predictions.push({
      key: agg.key,
      name: agg.name,
      category: agg.category,
      unit: agg.unit,
      quantity: qty,
      avgIntervalDays,
      lastActivityDate,
      predictedRunOutDate,
      daysUntilRunOut,
      confidence,
      inPantry: agg.freshInPantry,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  predictions.sort((a, b) =>
    a.daysUntilRunOut - b.daysUntilRunOut || rank[a.confidence] - rank[b.confidence] || a.name.localeCompare(b.name),
  );
  return predictions;
}
