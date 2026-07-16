import { describe, it, expect } from 'vitest';
import { selectItemsToSchedule, MAX_SCHEDULED_ITEMS } from './notifications';
import type { PantryItem } from '../types';

function item(id: string, expirationDate: string | undefined): PantryItem {
  return {
    id,
    name: id,
    category: 'Other',
    location: 'pantry',
    quantity: 1,
    unit: 'pcs',
    addedDate: '2026-07-01',
    expirationDate: expirationDate as string,
    estimatedValue: 1,
  } as PantryItem;
}

// Dates are computed relative to "now" so the tests stay deterministic
// regardless of the day they run: the scheduler only keeps items whose
// day-of (10am) reminder is still in the future.
function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // midday so tz/DST never flips the calendar day
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('selectItemsToSchedule', () => {
  it('drops items with no expiration date', () => {
    const items = [item('a', daysFromNow(10)), item('b', undefined), item('c', daysFromNow(5))];
    const picked = selectItemsToSchedule(items);
    expect(picked.map(i => i.id)).toEqual(['c', 'a']);
  });

  it('orders by soonest expiration first', () => {
    const items = [item('late', daysFromNow(120)), item('soon', daysFromNow(3)), item('mid', daysFromNow(60))];
    expect(selectItemsToSchedule(items).map(i => i.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('drops already-expired items so they do not consume the cap', () => {
    // 20 expired items would otherwise sort earliest and fill every slot,
    // leaving the real upcoming items with no reminders scheduled.
    const expired = Array.from({ length: 20 }, (_, i) => item(`old${i}`, daysFromNow(-i - 1)));
    const upcoming = [item('future1', daysFromNow(4)), item('future2', daysFromNow(8))];
    const picked = selectItemsToSchedule([...expired, ...upcoming]);
    expect(picked.map(i => i.id)).toEqual(['future1', 'future2']);
  });

  it('caps at MAX_SCHEDULED_ITEMS, keeping the soonest', () => {
    // 30 future items — only the soonest MAX should be kept.
    const items = Array.from({ length: 30 }, (_, i) => item(`d${i}`, daysFromNow(i + 1)));
    const picked = selectItemsToSchedule(items);
    expect(picked.length).toBe(MAX_SCHEDULED_ITEMS);
    expect(picked[0].id).toBe('d0');
    expect(picked[picked.length - 1].id).toBe(`d${MAX_SCHEDULED_ITEMS - 1}`);
  });
});
