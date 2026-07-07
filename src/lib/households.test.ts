import { describe, it, expect, beforeEach, vi } from 'vitest';

// A FIFO queue of results the mocked Supabase chain returns, one per
// `.maybeSingle()` call (first = household_members query, second = households).
const h = vi.hoisted(() => ({
  queue: [] as Array<{ data: unknown; error: unknown }>,
  ownerIsProResult: { data: false as unknown, error: null as unknown },
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => h.queue.shift() ?? { data: null, error: null },
        }),
      }),
    }),
    rpc: async () => h.ownerIsProResult,
  },
}));

import { getMyHousehold } from './households';

beforeEach(() => {
  h.queue = [];
  h.ownerIsProResult = { data: false, error: null };
});

describe('getMyHousehold', () => {
  it('THROWS on a real DB/network error (does not masquerade as "not in a household")', async () => {
    h.queue = [{ data: null, error: { message: 'network blip' } }];
    await expect(getMyHousehold('u1')).rejects.toBeTruthy();
  });

  it('returns null only when the user genuinely has no household row', async () => {
    h.queue = [{ data: null, error: null }];
    await expect(getMyHousehold('u1')).resolves.toBeNull();
  });

  it('returns the household when membership + household rows load cleanly', async () => {
    h.queue = [
      { data: { household_id: 'hh1', role: 'member' }, error: null },
      { data: { id: 'hh1', invite_code: 'ABC123', owner_id: 'u9', created_at: '2026-01-01' }, error: null },
    ];
    h.ownerIsProResult = { data: true, error: null };
    await expect(getMyHousehold('u1')).resolves.toEqual({
      id: 'hh1',
      inviteCode: 'ABC123',
      ownerId: 'u9',
      role: 'member',
      ownerIsPro: true,
    });
  });

  it('THROWS when the household lookup itself errors', async () => {
    h.queue = [
      { data: { household_id: 'hh1', role: 'member' }, error: null },
      { data: null, error: { message: 'blip' } },
    ];
    await expect(getMyHousehold('u1')).rejects.toBeTruthy();
  });
});
