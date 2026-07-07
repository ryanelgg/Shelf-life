import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { PantryItemRow, WasteLogRow } from './supabase';
import { rowToPantryItem, rowToWasteLog } from './supabaseSync';
import { useStore } from '../store/useStore';
import { cancelItemNotifications, rescheduleItemNotifications } from './notifications';
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
          if (id) {
            store.removePantryItemLocal(id);
            void cancelItemNotifications(id);
          }
        } else {
          const item = rowToPantryItem(payload.new as PantryItemRow);
          store.upsertPantryItemLocal(item);
          // Without this, only the member who added/edited an item ever gets
          // its expiry reminder scheduled on their device — everyone else in
          // the household stays silent. Reschedule (cancel + schedule) here
          // too so every member's device carries its own local notification.
          if (store.notificationsEnabled) {
            void rescheduleItemNotifications(item, store.user?.name);
          }
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
    });
}

export function unsubscribeHousehold(): void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  activeHouseholdId = null;
}
