import { describe, it, expect } from 'vitest';
import { predictRestocks, normalizeName, RADAR_HORIZON_DAYS } from './shoppingRadar';
import type { PantryItem, WasteLog } from '../types';

const TODAY = new Date(2026, 6, 14); // 2026-07-14 (local)

function waste(itemName: string, date: string, quantity = 1): WasteLog {
  return { id: `w-${itemName}-${date}`, itemName, category: 'Dairy', action: 'eaten', date, estimatedValue: 3, quantity };
}
function pantry(name: string, addedDate: string, expirationDate: string, quantity = 1): PantryItem {
  return { id: `p-${name}-${addedDate}`, name, category: 'Dairy', location: 'fridge', quantity, unit: 'carton', addedDate, expirationDate };
}

describe('normalizeName', () => {
  it('folds case, whitespace, and simple plurals', () => {
    expect(normalizeName('  Eggs ')).toBe('egg');
    expect(normalizeName('MILK')).toBe('milk');
    expect(normalizeName('glass')).toBe('glass'); // never strips "ss"
  });
});

describe('predictRestocks', () => {
  it('predicts a run-out for a weekly staple whose cadence is about due', () => {
    // Milk used up roughly every 7 days; last consumed 6 days ago (2026-07-08).
    const logs = [
      waste('Milk', '2026-06-10'),
      waste('Milk', '2026-06-17'),
      waste('Milk', '2026-06-24'),
      waste('Milk', '2026-07-01'),
      waste('Milk', '2026-07-08'),
    ];
    const preds = predictRestocks([], logs, TODAY);
    const milk = preds.find(p => p.key === 'milk');
    expect(milk).toBeTruthy();
    expect(milk!.avgIntervalDays).toBe(7);
    expect(milk!.predictedRunOutDate).toBe('2026-07-15'); // 2026-07-08 + 7
    expect(milk!.daysUntilRunOut).toBe(1);
    expect(milk!.confidence).toBe('high'); // 4 gaps
  });

  it('stays quiet when there is not enough history', () => {
    const preds = predictRestocks([], [waste('Milk', '2026-07-01'), waste('Milk', '2026-07-08')], TODAY);
    expect(preds).toHaveLength(0);
  });

  it('does not nag about an item you just restocked (fresh purchase resets the clock)', () => {
    // Same weekly cadence, but a purchase today resets last-activity → next
    // run-out is ~7 days out, beyond the horizon.
    const logs = [waste('Milk', '2026-06-17'), waste('Milk', '2026-06-24'), waste('Milk', '2026-07-01')];
    const items = [pantry('Milk', '2026-07-14', '2026-07-21')];
    const preds = predictRestocks(items, logs, TODAY);
    expect(preds.find(p => p.key === 'milk')).toBeFalsy();
  });

  it('surfaces an overdue staple with a negative daysUntilRunOut', () => {
    const logs = [
      waste('Eggs', '2026-06-01'),
      waste('Eggs', '2026-06-11'),
      waste('Eggs', '2026-06-21'),
      waste('Eggs', '2026-07-01'), // +10-day cadence, so run-out ~2026-07-11 (overdue)
    ];
    const eggs = predictRestocks([], logs, TODAY).find(p => p.key === 'egg');
    expect(eggs).toBeTruthy();
    expect(eggs!.daysUntilRunOut).toBeLessThan(0);
    expect(eggs!.daysUntilRunOut).toBeGreaterThanOrEqual(-RADAR_HORIZON_DAYS - 30);
  });

  it('sorts most-urgent first', () => {
    const logs = [
      // Eggs overdue
      waste('Eggs', '2026-06-01'), waste('Eggs', '2026-06-11'), waste('Eggs', '2026-06-21'), waste('Eggs', '2026-07-01'),
      // Milk due in ~1 day
      waste('Milk', '2026-06-10'), waste('Milk', '2026-06-17'), waste('Milk', '2026-06-24'), waste('Milk', '2026-07-01'), waste('Milk', '2026-07-08'),
    ];
    const preds = predictRestocks([], logs, TODAY);
    expect(preds.length).toBeGreaterThanOrEqual(2);
    expect(preds[0].daysUntilRunOut).toBeLessThanOrEqual(preds[1].daysUntilRunOut);
  });
});
