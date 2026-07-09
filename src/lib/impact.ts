import type { WasteLog } from '../types';
import { formatLocalDate } from '../types';

// Centralised impact math so the Impact screen, the weekly card, and the badge
// engine all agree on what "saved" means. Anything that wasn't tossed counts as
// a save (eaten / composted / shared / donated).

export interface ImpactStats {
  totalItems: number;
  tossed: number;
  itemsSaved: number;
  moneySaved: number;
  co2Kg: number;
  saveRate: number;      // 0..100
  sharedCount: number;   // shared + donated
  compostedCount: number;
}

// Matches the estimate already shown on the Impact screen (~0.5 kg CO₂e per
// item kept out of landfill). Kept here so every surface uses one number.
export const CO2_PER_ITEM_KG = 0.5;

export function computeImpactStats(logs: WasteLog[]): ImpactStats {
  let tossed = 0;
  let moneySaved = 0;
  let sharedCount = 0;
  let compostedCount = 0;

  for (const w of logs) {
    if (w.action === 'tossed') {
      tossed++;
      continue;
    }
    moneySaved += w.estimatedValue * w.quantity;
    if (w.action === 'shared' || w.action === 'donated') sharedCount++;
    if (w.action === 'composted') compostedCount++;
  }

  const totalItems = logs.length;
  const itemsSaved = totalItems - tossed;
  return {
    totalItems,
    tossed,
    itemsSaved,
    moneySaved,
    co2Kg: itemsSaved * CO2_PER_ITEM_KG,
    saveRate: totalItems > 0 ? (itemsSaved / totalItems) * 100 : 0,
    sharedCount,
    compostedCount,
  };
}

// Monday-anchored start of the week containing `date` (local time).
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

// A stable id for the week containing `date`, e.g. "2026-06-22" (the Monday).
// Used to show the weekly Impact Card at most once per calendar week.
export function weekId(date: Date): string {
  return formatLocalDate(startOfWeek(date));
}

// "Jun 22–28" style label for the week containing `date`.
export function weekRangeLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  if (start.getMonth() === end.getMonth()) {
    return `${month(start)} ${start.getDate()}–${end.getDate()}`;
  }
  return `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

// Logs dated on/after the Monday of the current week (WasteLog.date is a local
// "YYYY-MM-DD" string, so a lexical compare is a date compare).
export function logsThisWeek(logs: WasteLog[], now: Date = new Date()): WasteLog[] {
  const weekStart = formatLocalDate(startOfWeek(now));
  return logs.filter((w) => w.date >= weekStart);
}
