import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared, hoisted mock state (vi.mock is hoisted above imports).
const h = vi.hoisted(() => ({
  result: { error: null as { message: string } | null },
  calls: [] as string[],
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async () => { h.calls.push(`upsert:${table}`); return h.result; },
      update: () => ({ eq: async () => { h.calls.push(`update:${table}`); return h.result; } }),
      delete: () => ({ eq: async () => { h.calls.push(`delete:${table}`); return h.result; } }),
    }),
  },
}));

vi.mock('./debug', () => ({ error: vi.fn(), warn: vi.fn(), log: vi.fn() }));

import {
  enqueueOutbox,
  flushOutbox,
  outboxPending,
  trackPendingAdd,
  pendingAddRow,
  isPendingAddCancelled,
  resolvePendingAdd,
  mergeIntoPendingAdd,
  cancelPendingAdd,
} from './syncOutbox';

// In-memory localStorage (node has none).
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  installLocalStorage();
  h.result = { error: null };
  h.calls = [];
});

describe('syncOutbox', () => {
  it('queues a failed operation and reports it as pending', () => {
    expect(outboxPending()).toBe(0);
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a1', name: 'Milk' } });
    expect(outboxPending()).toBe(1);
  });

  it('drains the queue when replays succeed', async () => {
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a1', name: 'Milk' } });
    enqueueOutbox({ kind: 'pantryRemove', id: 'a2' });
    h.result = { error: null };

    await flushOutbox();

    expect(outboxPending()).toBe(0);
    expect(h.calls).toEqual(['upsert:pantry_items', 'delete:pantry_items']);
  });

  it('keeps operations queued when the replay fails (offline)', async () => {
    enqueueOutbox({ kind: 'wasteLogAdd', row: { id: 'w1', item_name: 'Bread' } });
    h.result = { error: { message: 'network down' } };

    await flushOutbox();

    expect(outboxPending()).toBe(1); // still pending, retried later
  });

  it('drops a poison entry after repeated failures instead of wedging the queue', async () => {
    enqueueOutbox({ kind: 'pantryUpdate', id: 'p1', row: { name: 'x' } });
    h.result = { error: { message: 'always fails' } };

    // MAX_ATTEMPTS is 6 — flush enough times to exhaust it.
    for (let i = 0; i < 6; i++) await flushOutbox();

    expect(outboxPending()).toBe(0);
  });

  it('uses upsert (not insert) for adds so a re-applied write is idempotent', async () => {
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a1', name: 'Eggs' } });
    await flushOutbox();
    expect(h.calls).toContain('upsert:pantry_items');
  });
});

// ── Pending-add coordination ────────────────────────────────────────────────
//
// Regression tests for the offline add-then-edit/delete bug: an item added
// offline whose insert hasn't reached the server yet must not be raced by a
// later edit/delete for the same id — otherwise the edit/delete no-ops against
// a row the server doesn't have, and the still-pending add then overwrites the
// edit or resurrects the deleted item once it lands.
describe('pending-add coordination', () => {
  it('has no pending add for an id that was never tracked', () => {
    expect(pendingAddRow('never-added')).toBeNull();
    expect(isPendingAddCancelled('never-added')).toBe(false);
  });

  it('folds an edit into a still-pending add instead of losing it', () => {
    trackPendingAdd('a1', { id: 'a1', name: 'Milk', quantity: 1 });
    const applied = mergeIntoPendingAdd('a1', { quantity: 2 });
    expect(applied).toBe(true);
    expect(pendingAddRow('a1')).toEqual({ id: 'a1', name: 'Milk', quantity: 2 });
    resolvePendingAdd('a1');
  });

  it('folds an edit into an add that already made it to the outbox', () => {
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a2', name: 'Bread', quantity: 1 } });
    // Simulate the in-flight tracker having settled (moved to the outbox) —
    // mergeIntoPendingAdd must still find and update the queued entry.
    const applied = mergeIntoPendingAdd('a2', { quantity: 3 });
    expect(applied).toBe(true);

    h.result = { error: null };
    return flushOutbox().then(() => {
      expect(h.calls).toEqual(['upsert:pantry_items']);
    });
  });

  it('cancels a still-pending add on delete so it never reaches the server', () => {
    trackPendingAdd('a3', { id: 'a3', name: 'Eggs' });
    const cancelled = cancelPendingAdd('a3');
    expect(cancelled).toBe(true);
    expect(isPendingAddCancelled('a3')).toBe(true);
    expect(pendingAddRow('a3')).toBeNull();
  });

  it('removes a queued add from the outbox on delete instead of resurrecting it', async () => {
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a4', name: 'Yogurt' } });
    expect(outboxPending()).toBe(1);

    const cancelled = cancelPendingAdd('a4');
    expect(cancelled).toBe(true);
    expect(outboxPending()).toBe(0);

    await flushOutbox();
    expect(h.calls).toEqual([]); // never inserted
  });

  it('reports no match when there is nothing pending for that id', () => {
    expect(mergeIntoPendingAdd('nope', { quantity: 5 })).toBe(false);
    expect(cancelPendingAdd('nope')).toBe(false);
  });

  it('an already-resolved add is untouched by a later edit/delete for the same id', () => {
    trackPendingAdd('a5', { id: 'a5', name: 'Cheese' });
    resolvePendingAdd('a5'); // e.g. the insert already succeeded
    expect(mergeIntoPendingAdd('a5', { quantity: 2 })).toBe(false);
    expect(cancelPendingAdd('a5')).toBe(false);
  });
});
