import { describe, it, expect } from 'vitest';
import { selectItemsToSchedule, MAX_SCHEDULED_ITEMS, notificationIdsForItem } from './notifications';
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

describe('selectItemsToSchedule', () => {
  it('drops items with no expiration date', () => {
    const items = [item('a', '2026-07-10'), item('b', undefined), item('c', '2026-07-05')];
    const picked = selectItemsToSchedule(items);
    expect(picked.map(i => i.id)).toEqual(['c', 'a']);
  });

  it('orders by soonest expiration first', () => {
    const items = [item('late', '2026-12-01'), item('soon', '2026-07-03'), item('mid', '2026-09-01')];
    expect(selectItemsToSchedule(items).map(i => i.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('caps at MAX_SCHEDULED_ITEMS, keeping the soonest', () => {
    // 30 items expiring on days 01..30 — only the soonest MAX should be kept.
    const items = Array.from({ length: 30 }, (_, i) =>
      item(`d${i}`, `2026-08-${String(i + 1).padStart(2, '0')}`),
    );
    const picked = selectItemsToSchedule(items);
    expect(picked.length).toBe(MAX_SCHEDULED_ITEMS);
    expect(picked[0].id).toBe('d0');
    expect(picked[picked.length - 1].id).toBe(`d${MAX_SCHEDULED_ITEMS - 1}`);
  });
});

describe('notificationIdsForItem', () => {
  it('gives an item four distinct reminder ids (incl. finish check-in)', () => {
    const ids = notificationIdsForItem('some-item-id');
    const values = [ids.twoDays, ids.oneDay, ids.dayOf, ids.finish];
    expect(new Set(values).size).toBe(4);
    // finish sits in the +4 slot, one past the day-of reminder.
    expect(ids.finish).toBe(ids.dayOf + 1);
  });

  it('does not collide across different items', () => {
    const a = notificationIdsForItem('item-a');
    const b = notificationIdsForItem('item-b');
    const all = [a.twoDays, a.oneDay, a.dayOf, a.finish, b.twoDays, b.oneDay, b.dayOf, b.finish];
    expect(new Set(all).size).toBe(8);
  });
});
