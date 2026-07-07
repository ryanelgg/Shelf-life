import { describe, it, expect } from 'vitest';
import {
  computeRestockSuggestions,
  normalizeStapleName,
  runOutLabel,
} from './predictiveRestock';
import type { PantryItem, WasteLog } from '../types';

function waste(itemName: string, date: string, extra: Partial<WasteLog> = {}): WasteLog {
  return {
    id: `w-${itemName}-${date}`,
    itemName,
    category: 'Dairy',
    action: 'eaten',
    date,
    estimatedValue: 3,
    quantity: 1,
    ...extra,
  };
}

function pantry(name: string, expirationDate: string, extra: Partial<PantryItem> = {}): PantryItem {
  return {
    id: `p-${name}-${expirationDate}`,
    name,
    category: 'Dairy',
    location: 'fridge',
    quantity: 1,
    unit: 'carton',
    addedDate: '2026-07-01',
    expirationDate,
    estimatedValue: 3,
    ...extra,
  };
}

const TODAY = new Date(2026, 6, 6); // 2026-07-06 (local)

describe('normalizeStapleName', () => {
  it('folds plurals and casing so variants collapse together', () => {
    expect(normalizeStapleName('Eggs')).toBe(normalizeStapleName('egg'));
    expect(normalizeStapleName('Free-Range Eggs ')).toBe(normalizeStapleName('eggs free range'));
    expect(normalizeStapleName('Tomatoes')).toBe(normalizeStapleName('tomato'));
  });

  it('ignores punctuation and empty input', () => {
    expect(normalizeStapleName('   ')).toBe('');
    expect(normalizeStapleName('2% Milk')).toBe('2 milk');
  });
});

describe('computeRestockSuggestions', () => {
  it('predicts run-out from a weekly depletion cadence and suggests restock', () => {
    // Milk depleted roughly every 7 days; last event 2026-07-02.
    const logs = [
      waste('Milk', '2026-06-11'),
      waste('Milk', '2026-06-18'),
      waste('Milk', '2026-06-25'),
      waste('Milk', '2026-07-02'),
    ];
    const [s, ...rest] = computeRestockSuggestions([], logs, { today: TODAY });
    expect(rest).toHaveLength(0);
    expect(s.name).toBe('Milk');
    expect(s.cadenceDays).toBe(7);
    expect(s.confidence).toBe('high'); // 4 events
    // last event 07-02 + 7d cadence = 07-09 → 3 days from 07-06
    expect(s.predictedRunOutDate).toBe('2026-07-09');
    expect(s.daysUntilRunOut).toBe(3);
  });

  it('needs at least two events to measure a cadence', () => {
    const logs = [waste('Olive Oil', '2026-07-01')];
    expect(computeRestockSuggestions([], logs, { today: TODAY })).toHaveLength(0);
  });

  it('marks two-event predictions as medium confidence', () => {
    const logs = [waste('Butter', '2026-06-29'), waste('Butter', '2026-07-04')];
    const [s] = computeRestockSuggestions([], logs, { today: TODAY });
    expect(s.confidence).toBe('medium');
    expect(s.eventCount).toBe(2);
    expect(s.cadenceDays).toBe(5);
  });

  it('excludes staples whose predicted run-out is beyond the lookahead window', () => {
    // Depleted every ~30 days, last event just a few days ago → not due soon.
    const logs = [
      waste('Rice', '2026-05-05', { category: 'Grains' }),
      waste('Rice', '2026-06-04', { category: 'Grains' }),
      waste('Rice', '2026-07-04', { category: 'Grains' }),
    ];
    expect(computeRestockSuggestions([], logs, { today: TODAY, lookaheadDays: 7 })).toHaveLength(0);
    // Widen the window and it appears.
    expect(computeRestockSuggestions([], logs, { today: TODAY, lookaheadDays: 40 })).toHaveLength(1);
  });

  it('flags "use before you rebuy" when on-hand stock is expiring soon', () => {
    const logs = [
      waste('Milk', '2026-06-18'),
      waste('Milk', '2026-06-25'),
      waste('Milk', '2026-07-02'),
    ];
    // A carton is already on hand and expires in 2 days.
    const onHand = [pantry('Milk', '2026-07-08')];
    const [s] = computeRestockSuggestions(onHand, logs, { today: TODAY });
    expect(s.inPantryQty).toBe(1);
    expect(s.useBeforeRebuy).toBe(true);
    expect(s.unit).toBe('carton'); // unit resolved from the on-hand item
  });

  it('does not flag use-before-rebuy when on-hand stock is still fresh', () => {
    const logs = [
      waste('Milk', '2026-06-18'),
      waste('Milk', '2026-06-25'),
      waste('Milk', '2026-07-02'),
    ];
    const onHand = [pantry('Milk', '2026-07-30')]; // fresh
    const [s] = computeRestockSuggestions(onHand, logs, { today: TODAY });
    expect(s.useBeforeRebuy).toBe(false);
  });

  it('collapses multiple same-day depletions and sums their quantity', () => {
    const logs = [
      waste('Yogurt', '2026-06-22', { quantity: 2 }),
      waste('Yogurt', '2026-06-22', { quantity: 1 }), // same day
      waste('Yogurt', '2026-06-29', { quantity: 3 }),
      waste('Yogurt', '2026-07-04', { quantity: 3 }),
    ];
    const [s] = computeRestockSuggestions([], logs, { today: TODAY });
    // 3 distinct event days → high confidence, not 4.
    expect(s.eventCount).toBe(3);
    expect(s.confidence).toBe('high');
    expect(s.suggestedQuantity).toBeGreaterThanOrEqual(3);
  });

  it('sorts soonest-to-run-out first', () => {
    const logs = [
      // Bread runs out sooner (last event older relative to cadence)
      waste('Bread', '2026-06-20', { category: 'Bakery' }),
      waste('Bread', '2026-06-24', { category: 'Bakery' }),
      waste('Bread', '2026-06-28', { category: 'Bakery' }), // +4d cadence → out 07-02 (overdue)
      waste('Milk', '2026-06-18'),
      waste('Milk', '2026-06-25'),
      waste('Milk', '2026-07-02'), // +7d → out 07-09
    ];
    const result = computeRestockSuggestions([], logs, { today: TODAY, lookaheadDays: 10 });
    expect(result.map(s => s.name)).toEqual(['Bread', 'Milk']);
    expect(result[0].daysUntilRunOut).toBeLessThan(result[1].daysUntilRunOut);
  });

  it('respects the result limit', () => {
    const logs: WasteLog[] = [];
    for (let n = 0; n < 20; n++) {
      logs.push(waste(`Item${n}`, '2026-06-25'), waste(`Item${n}`, '2026-07-01'));
    }
    expect(computeRestockSuggestions([], logs, { today: TODAY, limit: 5 })).toHaveLength(5);
  });
});

describe('runOutLabel', () => {
  it('phrases the countdown in plain language', () => {
    expect(runOutLabel(-2)).toBe('likely out 2d ago');
    expect(runOutLabel(0)).toBe('runs out today');
    expect(runOutLabel(1)).toBe('runs out tomorrow');
    expect(runOutLabel(4)).toBe('runs out in ~4d');
  });
});
