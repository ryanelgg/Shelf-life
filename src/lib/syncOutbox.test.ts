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

import { enqueueOutbox, flushOutbox, outboxPending, outboxHasPendingAdd } from './syncOutbox';

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

  it('outboxHasPendingAdd detects a queued add for an id', () => {
    expect(outboxHasPendingAdd('a1')).toBe(false);
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a1', name: 'Milk' } });
    expect(outboxHasPendingAdd('a1')).toBe(true);
    expect(outboxHasPendingAdd('a2')).toBe(false);
  });

  it('replays a queued add BEFORE a later edit/delete for the same id (ordering)', async () => {
    // Simulates the offline add→edit/delete fix: an edit queued behind an add
    // must replay after it, so the add can never clobber the edit.
    enqueueOutbox({ kind: 'pantryAdd', row: { id: 'a1', name: 'Milk' } });
    enqueueOutbox({ kind: 'pantryUpdate', id: 'a1', row: { name: 'Oat Milk' } });
    enqueueOutbox({ kind: 'pantryRemove', id: 'a1' });

    await flushOutbox();

    expect(h.calls).toEqual(['upsert:pantry_items', 'update:pantry_items', 'delete:pantry_items']);
  });
});
