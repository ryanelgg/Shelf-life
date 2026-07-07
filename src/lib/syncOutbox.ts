import { supabase } from './supabase';
import * as debug from './debug';

// ── Offline sync outbox ─────────────────────────────────────────────────────
//
// Pantry/waste writes are fire-and-forget with a short (~6s) retry window. If
// the device is offline for longer than that, the write is lost and the next
// full cloud load overwrites local state — silently dropping an item the user
// added, or resurrecting one they deleted.
//
// This outbox closes that hole: any write that exhausts its retries is queued
// (serialized) to localStorage, and `flushOutbox()` replays the queue the next
// time we have connectivity — crucially, BEFORE the app reads + overwrites
// local state on boot. Replays are idempotent (adds use upsert; update/delete
// by id are naturally repeatable) so a double-apply is harmless.

const OUTBOX_KEY = 'shelf-life-sync-outbox-v1';
const MAX_ENTRIES = 500; // bound localStorage growth in a long offline stretch
const MAX_ATTEMPTS = 6;  // drop poison entries that never succeed

export type OutboxOp =
  | { kind: 'pantryAdd'; row: Record<string, unknown> }
  | { kind: 'pantryUpdate'; id: string; row: Record<string, unknown> }
  | { kind: 'pantryRemove'; id: string }
  | { kind: 'wasteLogAdd'; row: Record<string, unknown> };

interface OutboxEntry {
  op: OutboxOp;
  attempts: number;
  queuedAt: number;
}

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch (e) {
    debug.error('[outbox] persist failed:', e);
  }
}

/** Queue an operation that failed to sync so it can be replayed later. */
export function enqueueOutbox(op: OutboxOp): void {
  const entries = readOutbox();
  entries.push({ op, attempts: 0, queuedAt: Date.now() });
  // Keep only the most recent MAX_ENTRIES if we somehow overflow.
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  writeOutbox(entries);
  debug.warn(`[outbox] queued ${op.kind} (pending: ${entries.length})`);
}

/** Number of operations currently waiting to be flushed. */
export function outboxPending(): number {
  return readOutbox().length;
}

// ── Pending-add coordination ────────────────────────────────────────────────
//
// An add can still be in flight (retrying) or sitting in the outbox when the
// user edits or deletes the same item after coming back online. Without this,
// the edit/delete would run against a row the server doesn't have yet — a
// silent 0-row no-op — and the still-pending add would then land afterwards
// and either overwrite the edit or resurrect the deleted item. Folding
// same-id edits/deletes into the pending add itself means only one, final
// write ever reaches the server, in the right order.

interface PendingAdd {
  row: Record<string, unknown>;
  cancelled: boolean;
}

const pendingAdds = new Map<string, PendingAdd>();

/** Call when an add write is first attempted, before any retry/enqueue. */
export function trackPendingAdd(id: string, row: Record<string, unknown>): void {
  pendingAdds.set(id, { row, cancelled: false });
}

/** The current row for a still-pending, non-cancelled add, or null. */
export function pendingAddRow(id: string): Record<string, unknown> | null {
  const p = pendingAdds.get(id);
  return p && !p.cancelled ? p.row : null;
}

export function isPendingAddCancelled(id: string): boolean {
  return pendingAdds.get(id)?.cancelled ?? false;
}

/** Call once the add's write has settled (succeeded, or handed to the
 * outbox) — from then on the outbox/server is the source of truth for `id`. */
export function resolvePendingAdd(id: string): void {
  pendingAdds.delete(id);
}

/**
 * Fold an update into a still-pending add (in memory and, if it already got
 * queued, in the persisted outbox too). Returns true if it applied — the
 * caller should skip firing a separate network write in that case.
 */
export function mergeIntoPendingAdd(id: string, updates: Record<string, unknown>): boolean {
  let matched = false;
  const p = pendingAdds.get(id);
  if (p && !p.cancelled) {
    p.row = { ...p.row, ...updates };
    matched = true;
  }
  const entries = readOutbox();
  let changed = false;
  for (const entry of entries) {
    if (entry.op.kind === 'pantryAdd' && entry.op.row.id === id) {
      entry.op.row = { ...entry.op.row, ...updates };
      changed = true;
      matched = true;
    }
  }
  if (changed) writeOutbox(entries);
  return matched;
}

/**
 * Cancel a still-pending add — the item is being deleted before it ever
 * reached the server, so there's nothing to insert (or delete). Cancels both
 * the in-memory tracker and any matching queued outbox entry. Returns true if
 * a pending add was found and cancelled.
 */
export function cancelPendingAdd(id: string): boolean {
  let matched = false;
  const p = pendingAdds.get(id);
  if (p && !p.cancelled) {
    p.cancelled = true;
    matched = true;
  }
  const entries = readOutbox();
  const filtered = entries.filter(e => !(e.op.kind === 'pantryAdd' && e.op.row.id === id));
  if (filtered.length !== entries.length) {
    writeOutbox(filtered);
    matched = true;
  }
  return matched;
}

async function replayOp(op: OutboxOp): Promise<boolean> {
  let error: { message: string } | null = null;
  switch (op.kind) {
    case 'pantryAdd':
      // upsert (not insert) so a replay of a write that actually did land
      // server-side doesn't fail on a duplicate primary key.
      ({ error } = await supabase.from('pantry_items').upsert(op.row));
      break;
    case 'pantryUpdate':
      ({ error } = await supabase.from('pantry_items').update(op.row).eq('id', op.id));
      break;
    case 'pantryRemove':
      ({ error } = await supabase.from('pantry_items').delete().eq('id', op.id));
      break;
    case 'wasteLogAdd':
      ({ error } = await supabase.from('waste_logs').upsert(op.row));
      break;
  }
  return !error;
}

let flushing = false;

/**
 * Replay every queued operation. Successful ops are removed; failed ops keep
 * their place (with an incremented attempt count) and are dropped only after
 * MAX_ATTEMPTS so a permanently-rejected entry can't wedge the queue forever.
 * Safe to call repeatedly and concurrently (guarded).
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  const entries = readOutbox();
  if (entries.length === 0) return;

  flushing = true;
  try {
    const remaining: OutboxEntry[] = [];
    for (const entry of entries) {
      let ok = false;
      try {
        ok = await replayOp(entry.op);
      } catch (e) {
        debug.error(`[outbox] replay ${entry.op.kind} threw:`, e);
      }
      if (ok) continue;

      const attempts = entry.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        debug.error(`[outbox] dropping ${entry.op.kind} after ${attempts} failed attempts`);
        continue;
      }
      remaining.push({ ...entry, attempts });
    }
    writeOutbox(remaining);
    if (remaining.length > 0) {
      debug.warn(`[outbox] ${remaining.length} operation(s) still pending after flush`);
    }
  } finally {
    flushing = false;
  }
}
