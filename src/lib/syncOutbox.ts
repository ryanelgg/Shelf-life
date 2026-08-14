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
  uid: string;   // stable identity so a concurrent flush can tell which entries
                 // were appended mid-flush without relying on array position.
  op: OutboxOp;
  attempts: number;
  queuedAt: number;
}

// Monotonic-ish unique id for a queued entry. Combines the clock, a per-session
// counter and randomness so two entries enqueued in the same millisecond (or
// across sessions) never collide.
let uidSeq = 0;
function makeUid(): string {
  uidSeq = (uidSeq + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${uidSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  entries.push({ uid: makeUid(), op, attempts: 0, queuedAt: Date.now() });
  // Keep only the most recent MAX_ENTRIES if we somehow overflow. Dropping the
  // oldest is the least-bad choice (a later edit/delete usually supersedes it),
  // but never do it silently — a dropped write is lost data.
  if (entries.length > MAX_ENTRIES) {
    const dropped = entries.splice(0, entries.length - MAX_ENTRIES);
    debug.warn(`[outbox] overflow: dropped ${dropped.length} oldest queued write(s) (cap ${MAX_ENTRIES})`);
  }
  writeOutbox(entries);
  debug.warn(`[outbox] queued ${op.kind} (pending: ${entries.length})`);
}

/** Number of operations currently waiting to be flushed. */
export function outboxPending(): number {
  return readOutbox().length;
}

/**
 * Discard all queued operations. Call on user-initiated sign-out so one account's
 * pending offline writes can't replay under the next account's session.
 */
export function clearOutbox(): void {
  // Bump the generation so an in-flight flush knows the queue was cleared out
  // from under it (sign-out) and must NOT re-persist its stale snapshot —
  // otherwise the previous account's ops get resurrected after clearOutbox().
  outboxGeneration++;
  try {
    localStorage.removeItem(OUTBOX_KEY);
  } catch (e) {
    debug.error('[outbox] clear failed:', e);
  }
}

/**
 * True when a `pantryAdd` for this item id is still sitting in the outbox (i.e.
 * the row hasn't been created server-side yet). Callers use this to route a
 * later edit/delete through the outbox behind the add, instead of racing a live
 * write that would match 0 rows and be silently lost.
 */
export function outboxHasPendingAdd(id: string): boolean {
  return readOutbox().some(e => e.op.kind === 'pantryAdd' && (e.op.row as { id?: string }).id === id);
}

async function replayOp(op: OutboxOp): Promise<boolean> {
  let error: { message: string } | null = null;
  switch (op.kind) {
    case 'pantryAdd':
      // upsert (not insert) so a replay of a write that actually did land
      // server-side doesn't fail on a duplicate primary key.
      ({ error } = await supabase.from('pantry_items').upsert(op.row));
      break;
    case 'pantryUpdate': {
      // `.select()` so we can tell a real update from a 0-row match. Supabase
      // returns `{error:null}` when `.update().eq('id',X)` matches NOTHING —
      // a vacuous success. That happens when this edit's row hasn't been
      // created server-side yet (its own `pantryAdd` is still queued/failing).
      // Treating that as success would silently DROP the edit; instead return
      // false so it stays queued and retries after the add lands.
      const res = await supabase.from('pantry_items').update(op.row).eq('id', op.id).select();
      if (!res.error && (!res.data || res.data.length === 0)) return false;
      error = res.error;
      break;
    }
    case 'pantryRemove':
      ({ error } = await supabase.from('pantry_items').delete().eq('id', op.id));
      break;
    case 'wasteLogAdd':
      ({ error } = await supabase.from('waste_logs').upsert(op.row));
      break;
  }
  return !error;
}

// The promise of the flush currently in flight (null when idle). Concurrent
// callers AWAIT this same promise instead of returning immediately — the old
// `if (flushing) return;` resolved a second caller instantly, so a boot/reconnect
// path that does `await flushOutbox()` then reads+overwrites cloud state could
// run BEFORE the in-flight flush finished uploading queued offline writes,
// making an offline add/edit/delete vanish until the next full reload.
let flushPromise: Promise<void> | null = null;
// Bumped by clearOutbox(); a flush that sees it change mid-run skips its
// write-back so a concurrent sign-out can't be undone.
let outboxGeneration = 0;

async function flushOnce(): Promise<void> {
  const startGeneration = outboxGeneration;
  const entries = readOutbox();
  if (entries.length === 0) return;

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

  // The outbox was cleared mid-flush (sign-out): do NOT re-persist our snapshot,
  // or we'd resurrect the signed-out account's queued ops.
  if (outboxGeneration !== startGeneration) {
    debug.warn('[outbox] cleared during flush — discarding stale snapshot');
    return;
  }

  // A write enqueued DURING this flush lands in localStorage but not in our
  // `entries` snapshot. Identify those appended entries by uid (NOT by array
  // index): an overflow trim in enqueueOutbox can splice off the oldest
  // entries mid-flush, which would shift positions and make an index-based
  // slice preserve the wrong entries or drop valid ones (data loss).
  const processedUids = new Set(entries.map(e => e.uid));
  const appendedDuringFlush = readOutbox().filter(e => !processedUids.has(e.uid));
  writeOutbox([...remaining, ...appendedDuringFlush]);
  if (remaining.length > 0) {
    debug.warn(`[outbox] ${remaining.length} operation(s) still pending after flush`);
  }
}

/**
 * Replay every queued operation. Successful ops are removed; failed ops keep
 * their place (with an incremented attempt count) and are dropped only after
 * MAX_ATTEMPTS so a permanently-rejected entry can't wedge the queue forever.
 * Safe to call repeatedly and concurrently: concurrent callers share (and await)
 * the same in-flight flush, so `await flushOutbox()` always resolves only after
 * the queued writes have actually been pushed.
 */
export function flushOutbox(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = flushOnce().finally(() => { flushPromise = null; });
  return flushPromise;
}
