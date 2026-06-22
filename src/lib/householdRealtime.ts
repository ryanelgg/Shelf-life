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

export function subscribeHousehold(householdId: string): void {
  // Already listening to this household — nothing to do.
  if (channel && activeHouseholdId === householdId) return;
  unsubscribeHousehold();
  activeHouseholdId = householdId;

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
        // Catch-up reconcile (2A): re-fetch once when the channel goes live so
        // any change a member made in the gap between the initial data load and
        // this subscription is pulled in. After this, live events keep us in sync.
        void reconcileHousehold(householdId);
      }
    });
}

// Re-fetch the shared pantry + waste logs and fold them into the store. Guarded
// so a load that finishes after the user leaves/switches households is ignored,
// and failures keep local data rather than wiping it.
async function reconcileHousehold(householdId: string): Promise<void> {
  if (activeHouseholdId !== householdId) return;
  const userId = useStore.getState().supabaseUserId;
  if (!userId) return;
  try {
    const { pantryItems, wasteLogs } = await loadAllData(userId, householdId);
    if (activeHouseholdId !== householdId) return; // household changed while loading
    useStore.getState().loadCloudData(pantryItems, wasteLogs);
    debug.log('[household] reconciled on subscribe:', {
      pantryCount: pantryItems.length, wasteCount: wasteLogs.length, householdId,
    });
  } catch (err) {
    debug.warn('[household] reconcile failed (keeping local data):', err);
  }
}

export function unsubscribeHousehold(): void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  activeHouseholdId = null;
}
