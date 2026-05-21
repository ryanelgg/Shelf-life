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
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  } catch (e) {
    if (!isCancelledAuthError(e)) {
      debug.error('signInWithGoogle error:', e);
    }
  } finally {
    // Reset after a short delay so the iOS deep-link callback can close the browser first
    setTimeout(() => { googleSignInInFlight = false; }, 2000);
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
 * click the confirmation link. The caller should show a "check your email"
 * message instead of waiting for SIGNED_IN.
 *
 * Throws EmailAlreadyRegisteredError if the email already has an account —
 * Supabase silently swallows duplicate signups (anti-enumeration), so we
 * detect it by checking that `data.user.identities` is empty.
 *
 * On native, the confirmation link redirects to our custom URL scheme so the
 * deep-link handler in App.tsx can pick up the tokens. On web, we use the
 * current origin + /auth/callback.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const emailRedirectTo = Capacitor.isNativePlatform()
    ? 'com.elghazzali.shelflife://auth/callback'
    : `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;
  // Supabase returns user.identities = [] when the email is already registered.
  // A real new signup has at least one identity entry.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new EmailAlreadyRegisteredError();
  }
  return { needsConfirmation: !data.session };
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
  return data ?? null;
}

export async function upsertProfile(user: User, supabaseUserId: string) {
  await supabase.from('profiles').upsert({
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
  });
}

export async function syncProfileUpdates(
  supabaseUserId: string,
  updates: Partial<ProfileRow>
) {
  await supabase.from('profiles').update(updates).eq('id', supabaseUserId);
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

export async function loadAllData(userId: string): Promise<{
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
}> {
  const [itemsRes, logsRes] = await Promise.all([
    supabase.from('pantry_items').select('*').eq('user_id', userId),
    supabase.from('waste_logs').select('*').eq('user_id', userId),
  ]);

  const pantryItems: PantryItem[] = (itemsRes.data ?? []).map((r: PantryItemRow) => ({
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
  }));

  const wasteLogs: WasteLog[] = (logsRes.data ?? []).map((r: WasteLogRow) => ({
    id: r.id,
    itemName: r.item_name,
    category: r.category as WasteLog['category'],
    action: r.action as WasteLog['action'],
    date: r.date,
    estimatedValue: r.estimated_value,
    quantity: r.quantity,
  }));

  return { pantryItems, wasteLogs };
}

// ── Pantry sync ───────────────────────────────────────────────────────────────

export function syncPantryAdd(item: PantryItem, userId: string) {
  syncWrite(() => supabase.from('pantry_items').insert({
    id: item.id,
    user_id: userId,
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

  syncWrite(() => supabase.from('pantry_items').update(row).eq('id', id), 'pantryUpdate');
}

export function syncPantryRemove(id: string) {
  syncWrite(() => supabase.from('pantry_items').delete().eq('id', id), 'pantryRemove');
}

// ── Waste log sync ────────────────────────────────────────────────────────────

export function syncWasteLog(log: WasteLog, userId: string) {
  syncWrite(() => supabase.from('waste_logs').insert({
    id: log.id,
    user_id: userId,
    item_name: log.itemName,
    category: log.category,
    action: log.action,
    date: log.date,
    estimated_value: log.estimatedValue,
    quantity: log.quantity,
  }), 'wasteLogAdd');
}
