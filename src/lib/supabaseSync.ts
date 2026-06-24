import { supabase } from './supabase';
import type { ProfileRow, PantryItemRow, WasteLogRow } from './supabase';
import type { User, PantryItem, WasteLog } from '../types';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from './appleSignIn';
import * as debug from './debug';

/**
 * Fire-and-forget Supabase write with automatic retry.
 * Retries up to `maxRetries` times with exponential back-off (2s, 4s).
 * Errors are surfaced via debug.error so they're visible in production logs.
 */
function syncWrite(
  fn: () => PromiseLike<{ error: { message: string } | null }>,
  label: string,
  maxRetries = 2,
  delayMs = 2000,
): void {
  void (async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, delayMs * attempt));
      const { error } = await fn();
      if (!error) return;
      if (attempt === maxRetries) {
        debug.error(`[sync] ${label} failed after ${maxRetries + 1} attempts:`, error.message);
      }
    }
  })();
}

/**
 * Awaitable Supabase write with retry + visible error logging.
 * Unlike syncWrite (fire-and-forget), this resolves only after the write
 * succeeds or all retries are exhausted, so callers that `await` it (e.g. a
 * subscription-tier change) get a settled result. Failures are logged rather
 * than thrown — a transient blip must never crash the caller — but they are no
 * longer silently swallowed. Returns true on success, false if all retries fail.
 */
async function awaitableWrite(
  fn: () => PromiseLike<{ error: { message: string } | null }>,
  label: string,
  maxRetries = 2,
  delayMs = 1000,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, delayMs * attempt));
    const { error } = await fn();
    if (!error) return true;
    if (attempt === maxRetries) {
      debug.error(`[sync] ${label} failed after ${maxRetries + 1} attempts:`, error.message);
    }
  }
  return false;
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomString(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62])
    .join('');
}

function isCancelledAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = 'code' in error ? error.code : null;
  const maybeMessage = 'message' in error ? error.message : null;
  return maybeCode === '1001'
    || (typeof maybeMessage === 'string' && maybeMessage.toLowerCase().includes('cancel'));
}

// ── Auth ──────────────────────────────────────────────────────────────────────

let googleSignInInFlight = false;

export async function signInWithGoogle() {
  if (googleSignInInFlight) return;
  googleSignInInFlight = true;
  try {
    if (Capacitor.isNativePlatform()) {
      // Native: use Supabase OAuth via in-app browser
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.elghazzali.shelflife://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data.url) {
        // Clear the in-flight guard when the in-app browser is actually
        // dismissed (success deep-link OR user cancel), not on a fixed timer.
        // A real OAuth flow can take far longer than the old 2s reset, which
        // let a second tap start a duplicate flow.
        const handle = await Browser.addListener('browserFinished', () => {
          googleSignInInFlight = false;
          void handle.remove();
        });
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      } else {
        googleSignInInFlight = false;
      }
    } else {
      // Web: the page navigates away to the provider, tearing down this JS
      // context, so the guard resets naturally on redirect.
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  } catch (e) {
    googleSignInInFlight = false;
    if (!isCancelledAuthError(e)) {
      debug.error('signInWithGoogle error:', e);
      throw e;
    }
  }
}

export async function signInWithApple() {
  try {
    if (Capacitor.isNativePlatform()) {
      const rawNonce = randomString();
      const hashedNonce = await sha256hex(rawNonce);

      const result = await SignInWithApple.authorize({
        clientId: 'com.elghazzali.shelflife',
        redirectURI: 'com.elghazzali.shelflife://auth/callback',
        scopes: 'name email',
        nonce: hashedNonce,
      });

      const { identityToken } = result.response;
      if (!identityToken) throw new Error('No identity token from Apple');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: window.location.origin },
      });
    }
  } catch (error: unknown) {
    if (!isCancelledAuthError(error)) {
      debug.error('signInWithApple error:', error);
      throw error;
    }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Error thrown when signUpWithEmail detects the email is already registered.
 * Supabase returns a 200 with a fake user object in this case (to prevent
 * email enumeration), so we have to sniff it ourselves and surface a real
 * error to the UI.
 */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('This email is already registered. Please sign in instead.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Returns { needsConfirmation: true } when Supabase has email confirmation
 * enabled — in that case the user is created but not signed in until they
 * verify the 6-digit code from the confirmation email. The caller should show
 * the code-entry UI and then call verifyEmailOtp().
 *
 * Throws EmailAlreadyRegisteredError if the email already has an account —
 * Supabase silently swallows duplicate signups (anti-enumeration), so we
 * detect it by checking that `data.user.identities` is empty.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // Supabase returns user.identities = [] when the email is already registered.
  // A real new signup has at least one identity entry.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new EmailAlreadyRegisteredError();
  }
  return { needsConfirmation: !data.session };
}

/**
 * Verifies the 6-digit code from the signup confirmation email. On success a
 * session is created, which fires the SIGNED_IN listener in App.tsx and routes
 * the user into onboarding — no deep link or password re-entry needed.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: token.trim(),
    type: 'signup',
  });
  if (error) throw error;
}

/** Re-sends the signup confirmation code to the given email. */
export async function resendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// Tracks whether the most recent SIGNED_OUT event came from a user tapping
// "Sign Out" vs. a passive session expiry / token failure. The auth listener
// reads this to decide whether to wipe local data.
let _userInitiatedSignOut = false;

export function wasSignOutUserInitiated(): boolean {
  return _userInitiatedSignOut;
}

export function clearUserInitiatedSignOutFlag(): void {
  _userInitiatedSignOut = false;
}

export async function signOut() {
  // scope: 'global' revokes the refresh token server-side so a stale session
  // can't silently re-hydrate after a SIGNED_OUT event.
  _userInitiatedSignOut = true;
  await supabase.auth.signOut({ scope: 'global' });
}

export async function deleteAccount(): Promise<void> {
  // Calls the delete-account Edge Function which uses service role to wipe
  // pantry_items, waste_logs, profiles, and the auth.users row.
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw new Error(error.message || 'Failed to delete account');
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  // Sign out locally; the server-side user no longer exists so the token is invalid.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // ignore — user is already gone server-side
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  debug.log('[loadProfile] querying for userId:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  debug.log('[loadProfile] result:', { hasData: !!data, errorCode: error?.code, errorMsg: error?.message });
  // Throw on a real DB/network error so callers can tell it apart from a
  // genuinely missing row (null). A returning user must NOT be treated as new
  // — and pushed back into onboarding — just because the network blipped.
  if (error) throw error;
  return data ?? null;
}

export async function upsertProfile(user: User, supabaseUserId: string) {
  // Retried + logged: a dropped profile upsert here means onboarding_complete
  // never lands, which sends the user back through onboarding next launch.
  await awaitableWrite(() => supabase.from('profiles').upsert({
    id: supabaseUserId,
    name: user.name,
    email: user.email ?? null,
    auth_provider: user.authProvider,
    dietary_preferences: user.dietaryPreferences,
    subscription_tier: user.subscriptionTier,
    streak_days: user.streakDays,
    last_active_date: user.lastActiveDate,
    avo_chat_count: user.avoChatCount,
    avo_chat_reset_date: user.avoChatResetDate,
    onboarding_complete: user.onboardingComplete,
  }), 'upsertProfile');
}

export async function syncProfileUpdates(
  supabaseUserId: string,
  updates: Partial<ProfileRow>
) {
  await awaitableWrite(
    () => supabase.from('profiles').update(updates).eq('id', supabaseUserId),
    'syncProfileUpdates',
  );
}

export async function resetCloudUserData(userId: string) {
  const [pantryRes, wasteRes, profileRes] = await Promise.all([
    supabase.from('pantry_items').delete().eq('user_id', userId),
    supabase.from('waste_logs').delete().eq('user_id', userId),
    supabase.from('profiles').update({
      dietary_preferences: [],
      streak_days: 0,
      last_active_date: null,
      avo_chat_count: 0,
      avo_chat_reset_date: null,
      onboarding_complete: false,
    }).eq('id', userId),
  ]);

  const error = pantryRes.error ?? wasteRes.error ?? profileRes.error;
  if (error) throw error;
}

// ── Data loading ──────────────────────────────────────────────────────────────

// Row → app-type mappers (shared by the initial load and the realtime listener).
export function rowToPantryItem(r: PantryItemRow): PantryItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as PantryItem['category'],
    location: r.location as PantryItem['location'],
    quantity: r.quantity,
    unit: r.unit,
    addedDate: r.added_date,
    expirationDate: r.expiration_date,
    estimatedValue: r.estimated_value,
    notes: r.notes ?? undefined,
    frozen: r.frozen,
    dateType: (r.date_type as PantryItem['dateType']) ?? undefined,
  };
}

export function rowToWasteLog(r: WasteLogRow): WasteLog {
  return {
    id: r.id,
    itemName: r.item_name,
    category: r.category as WasteLog['category'],
    action: r.action as WasteLog['action'],
    date: r.date,
    estimatedValue: r.estimated_value,
    quantity: r.quantity,
  };
}

export async function loadAllData(userId: string, householdId?: string | null): Promise<{
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
}> {
  // In a household, load the shared pantry (every member's items live under the
  // same household_id). Solo users still load by user_id.
  const [itemsRes, logsRes] = await Promise.all([
    householdId
      ? supabase.from('pantry_items').select('*').eq('household_id', householdId)
      : supabase.from('pantry_items').select('*').eq('user_id', userId),
    householdId
      ? supabase.from('waste_logs').select('*').eq('household_id', householdId)
      : supabase.from('waste_logs').select('*').eq('user_id', userId),
  ]);

  // Throw on error rather than coercing to []. A failed read must not look
  // identical to "0 items" — otherwise the caller would overwrite a populated
  // local pantry with a blank one on a network blip.
  if (itemsRes.error) throw itemsRes.error;
  if (logsRes.error) throw logsRes.error;

  const pantryItems: PantryItem[] = (itemsRes.data ?? []).map((r: PantryItemRow) => rowToPantryItem(r));
  const wasteLogs: WasteLog[] = (logsRes.data ?? []).map((r: WasteLogRow) => rowToWasteLog(r));

  return { pantryItems, wasteLogs };
}

// ── Pantry sync ───────────────────────────────────────────────────────────────

export function syncPantryAdd(item: PantryItem, userId: string, householdId?: string | null) {
  syncWrite(() => supabase.from('pantry_items').insert({
    id: item.id,
    user_id: userId,
    household_id: householdId ?? null,
    name: item.name,
    category: item.category,
    location: item.location,
    quantity: item.quantity,
    unit: item.unit,
    added_date: item.addedDate,
    expiration_date: item.expirationDate,
    estimated_value: item.estimatedValue,
    notes: item.notes ?? null,
    frozen: item.frozen ?? false,
    date_type: item.dateType ?? null,
  }), 'pantryAdd');
}

export function syncPantryUpdate(id: string, updates: Partial<PantryItem>) {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined)            row.name = updates.name;
  if (updates.category !== undefined)        row.category = updates.category;
  if (updates.location !== undefined)        row.location = updates.location;
  if (updates.quantity !== undefined)        row.quantity = updates.quantity;
  if (updates.unit !== undefined)            row.unit = updates.unit;
  if (updates.addedDate !== undefined)       row.added_date = updates.addedDate;
  if (updates.expirationDate !== undefined)  row.expiration_date = updates.expirationDate;
  if (updates.estimatedValue !== undefined)  row.estimated_value = updates.estimatedValue;
  if (updates.notes !== undefined)           row.notes = updates.notes ?? null;
  if (updates.frozen !== undefined)          row.frozen = updates.frozen;
  if (updates.dateType !== undefined)        row.date_type = updates.dateType ?? null;

  syncWrite(() => supabase.from('pantry_items').update(row).eq('id', id), 'pantryUpdate');
}

export function syncPantryRemove(id: string) {
  syncWrite(() => supabase.from('pantry_items').delete().eq('id', id), 'pantryRemove');
}

// ── Waste log sync ────────────────────────────────────────────────────────────

export function syncWasteLog(log: WasteLog, userId: string, householdId?: string | null) {
  syncWrite(() => supabase.from('waste_logs').insert({
    id: log.id,
    user_id: userId,
    household_id: householdId ?? null,
    item_name: log.itemName,
    category: log.category,
    action: log.action,
    date: log.date,
    estimated_value: log.estimatedValue,
    quantity: log.quantity,
  }), 'wasteLogAdd');
}
