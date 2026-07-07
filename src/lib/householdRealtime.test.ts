import { describe, it, expect, beforeEach, vi } from 'vitest';

// Captures the postgres_changes handlers registered via .on() so tests can
// fire a synthetic payload directly, without a real Supabase realtime socket.
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (payload: unknown) => void>,
  storeState: {
    notificationsEnabled: true as boolean | null,
    user: { name: 'Rayan' } as { name: string } | null,
    upsertPantryItemLocal: vi.fn(),
    removePantryItemLocal: vi.fn(),
    addWasteLogLocal: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    channel: () => {
      const chain = {
        on: (_event: string, config: { table: string }, cb: (payload: unknown) => void) => {
          h.handlers[config.table] = cb;
          return chain;
        },
        subscribe: () => chain,
      };
      return chain;
    },
    removeChannel: () => {},
  },
}));

vi.mock('./supabaseSync', () => ({
  rowToPantryItem: (r: Record<string, unknown>) => ({ id: r.id, name: r.name, expirationDate: r.expiration_date }),
  rowToWasteLog: (r: Record<string, unknown>) => ({ id: r.id, itemName: r.item_name }),
}));

vi.mock('../store/useStore', () => ({
  useStore: { getState: () => h.storeState },
}));

vi.mock('./notifications', () => ({
  cancelItemNotifications: vi.fn(),
  rescheduleItemNotifications: vi.fn(),
}));

vi.mock('./debug', () => ({ error: vi.fn(), warn: vi.fn(), log: vi.fn() }));

import { subscribeHousehold, unsubscribeHousehold } from './householdRealtime';
import { cancelItemNotifications, rescheduleItemNotifications } from './notifications';

beforeEach(() => {
  h.handlers = {};
  h.storeState.notificationsEnabled = true;
  vi.clearAllMocks();
  // Force a fresh subscribe each test — subscribeHousehold no-ops for the
  // same household id if a channel is already active.
  unsubscribeHousehold();
  subscribeHousehold('hh1');
});

describe('household realtime — expiry reminders for every member', () => {
  it('schedules a reminder on this device when another member adds an item', () => {
    h.handlers.pantry_items({
      eventType: 'INSERT',
      new: { id: 'p1', name: 'Milk', expiration_date: '2026-07-10' },
    });
    expect(h.storeState.upsertPantryItemLocal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
    expect(rescheduleItemNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      'Rayan',
    );
  });

  it('reschedules the reminder when another member edits an item', () => {
    h.handlers.pantry_items({
      eventType: 'UPDATE',
      new: { id: 'p1', name: 'Milk', expiration_date: '2026-07-15' },
    });
    expect(rescheduleItemNotifications).toHaveBeenCalledTimes(1);
  });

  it('cancels the local reminder when another member deletes an item', () => {
    h.handlers.pantry_items({ eventType: 'DELETE', old: { id: 'p1' } });
    expect(h.storeState.removePantryItemLocal).toHaveBeenCalledWith('p1');
    expect(cancelItemNotifications).toHaveBeenCalledWith('p1');
  });

  it('does not schedule anything when this device has notifications disabled', () => {
    h.storeState.notificationsEnabled = false;
    h.handlers.pantry_items({
      eventType: 'INSERT',
      new: { id: 'p2', name: 'Eggs', expiration_date: '2026-07-12' },
    });
    expect(rescheduleItemNotifications).not.toHaveBeenCalled();
  });
});
