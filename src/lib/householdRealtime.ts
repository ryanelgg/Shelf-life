import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { PantryItemRow, WasteLogRow } from './supabase';
import { rowToPantryItem, rowToWasteLog, loadAllData } from './supabaseSync';
import { useStore } from '../store/useStore';
import * as debug from './debug';

// Live sync for a shared household pantry. While a member is in a household we
// subscribe to Postgres changes scoped to that household_id and fold them into
// the local store. RLS still applies, so members only receive rows they may see.
//
// Writes made on THIS device are echoed back here too, but the apply-local
// store actions are idempotent (upsert by id / dedupe by id), so re-applying a
// change we already made is a no-op — no sync loop.

let channel: RealtimeChannel | null = null;
let activeHouseholdId: string | null = null;
let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
let resubscribeAttempts = 0;
let hadDrop = false;

function clearResubscribeTimer(): void {
  if (resubscribeTimer) { clearTimeout(resubscribeTimer); resubscribeTimer = null; }
}

// After a reconnect we may have missed INSERT/UPDATE/DELETE events, so pull the
// shared pantry fresh once we're subscribed again.
async function reloadSharedPantry(householdId: string): Promise<void> {
  const { supabaseUserId, loadCloudData } = useStore.getState();
  if (!supabaseUserId) return;
  try {
    const { pantryItems, wasteLogs } = await loadAllData(supabaseUserId, householdId);
    loadCloudData(pantryItems, wasteLogs);
  } catch (e) {
    debug.error('[household] reload after reconnect failed', e);
  }
}

function openChannel(householdId: string): void {
  const filter = `household_id=eq.${householdId}`;

  channel = supabase
    .channel(`household:${householdId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pantry_items', filter },
      (payload) => {
        const store = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<PantryItemRow>)?.id;
          if (id) store.removePantryItemLocal(id);
        } else {
          store.upsertPantryItemLocal(rowToPantryItem(payload.new as PantryItemRow));
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'waste_logs', filter },
      (payload) => {
        useStore.getState().addWasteLogLocal(rowToWasteLog(payload.new as WasteLogRow));
      },
    )
    .subscribe((status) => {
      debug.log('[household] realtime status:', status, householdId);
      if (status === 'SUBSCRIBED') {
        const recovering = hadDrop;
        hadDrop = false;
        resubscribeAttempts = 0;
        // Only reload if this was a recovery — a first, clean subscribe already
        // has fresh data from the initial load.
        if (recovering) void reloadSharedPantry(householdId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Routine on mobile (backgrounding, wifi→cellular). Rebuild the channel
        // so the shared pantry doesn't silently freeze until an app restart.
        // Guard against a CLOSED fired by our own unsubscribe.
        if (activeHouseholdId !== householdId) return;
        hadDrop = true;
        scheduleResubscribe(householdId);
      }
    });
}

function scheduleResubscribe(householdId: string): void {
  clearResubscribeTimer();
  const delay = Math.min(30_000, 1_000 * 2 ** resubscribeAttempts);
  resubscribeAttempts += 1;
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null;
    if (activeHouseholdId !== householdId) return;
    if (channel) { void supabase.removeChannel(channel); channel = null; }
    openChannel(householdId);
  }, delay);
}

export function subscribeHousehold(householdId: string): void {
  // Already listening to this household — nothing to do.
  if (channel && activeHouseholdId === householdId) return;
  unsubscribeHousehold();
  activeHouseholdId = householdId;
  resubscribeAttempts = 0;
  hadDrop = false;
  openChannel(householdId);
}

export function unsubscribeHousehold(): void {
  clearResubscribeTimer();
  activeHouseholdId = null;
  resubscribeAttempts = 0;
  hadDrop = false;
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}
