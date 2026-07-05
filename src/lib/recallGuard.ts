import { checkPantryForRecalls } from './recallApi';
import type { RecallMatch } from './recallApi';
import { scheduleRecallAlert } from './notifications';
import * as debug from './debug';

// ── Avo Recall Guard ─────────────────────────────────────────────────────────
//
// Runs the dual-feed recall check and, for Pro users, pushes an immediate local
// alert the moment a NEW recall matches something in their pantry — so they find
// out even when the app is closed, instead of only when they next open it. Free
// users still get the in-app banner (populated from the returned matches); the
// push is the paid upgrade.

export interface RecallGuardOptions {
  itemNames: string[];
  isPro: boolean;
  guardEnabled: boolean;
  notificationsEnabled: boolean | null;
  notifiedIds: string[];
}

export interface RecallGuardResult {
  matches: RecallMatch[];
  /** Recall ids we just alerted on this run — caller persists these so we don't re-notify. */
  newlyNotifiedIds: string[];
}

/**
 * Pure: which matched recalls are new (not already notified)? De-duped by id.
 * Exported for unit testing the de-dup logic without network or notifications.
 */
export function selectNewRecalls(matches: RecallMatch[], notifiedIds: string[]): RecallMatch[] {
  const seen = new Set(notifiedIds);
  const out: RecallMatch[] = [];
  const usedThisRun = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.id) || usedThisRun.has(m.id)) continue;
    usedThisRun.add(m.id);
    out.push(m);
  }
  return out;
}

export async function runRecallGuard(opts: RecallGuardOptions): Promise<RecallGuardResult> {
  if (opts.itemNames.length === 0) {
    return { matches: [], newlyNotifiedIds: [] };
  }
  const matches = await checkPantryForRecalls(opts.itemNames);

  // Push alerts are the Pro upgrade, and only when the guard + notifications are
  // on. Everyone still gets `matches` back for the in-app banner.
  const canPush = opts.isPro && opts.guardEnabled && opts.notificationsEnabled === true;
  if (!canPush) return { matches, newlyNotifiedIds: [] };

  const fresh = selectNewRecalls(matches, opts.notifiedIds);
  if (fresh.length === 0) return { matches, newlyNotifiedIds: [] };

  try {
    await scheduleRecallAlert(fresh);
  } catch (e) {
    debug.warn('[recallGuard] alert failed:', e);
  }
  return { matches, newlyNotifiedIds: fresh.map(m => m.id) };
}
