import { supabase } from './supabase';
import type { HouseholdRow } from './supabase';
import type { Household, HouseholdMember, HouseholdRole } from '../types';

// All mutations go through SECURITY DEFINER Postgres RPCs (see
// supabase/migrations/0001_households.sql) so the Pro requirement and the
// 4-member cap are enforced server-side and can't be bypassed from the client.

function toHousehold(row: unknown, role: HouseholdRole): Omit<Household, 'ownerIsPro'> {
  // Guard the RPC payload before trusting it. A SECURITY DEFINER RPC can return
  // null (no row), an array, or a row missing fields if the SQL ever changes;
  // a blind `as HouseholdRow` cast would then surface as a raw TypeError
  // ("cannot read id of undefined") and crash the create/join flow. Fail with a
  // clean, catchable error instead so the UI can show a friendly message.
  const r = (Array.isArray(row) ? row[0] : row) as Partial<HouseholdRow> | null | undefined;
  if (!r || typeof r.id !== 'string' || typeof r.invite_code !== 'string' || typeof r.owner_id !== 'string') {
    throw new Error("Couldn't load your household — please try again.");
  }
  return { id: r.id, inviteCode: r.invite_code, ownerId: r.owner_id, role };
}

/**
 * Returns the caller's household, or null if they aren't in one.
 *
 * Throws on a real DB/network error so the caller can tell a transient failure
 * apart from "genuinely not in a household" (null). Collapsing both into null —
 * as this used to — meant a momentary blip on launch silently dropped a member
 * into their solo pantry (shared items vanish, realtime turns off, edits save
 * unlinked) until a restart. App.tsx keeps local data + the persisted household
 * when this throws, mirroring loadProfile / loadAllData.
 */
/**
 * Whether the caller's household owner currently holds Pro, computed
 * server-side (see 0005_household_owner_pro.sql). Free members are exempt
 * from the pantry item cap only while this is true — a free user can't fake
 * it by creating their own household, since create_household already
 * requires Pro. Defaults to false on error or if the caller isn't in one.
 */
export async function getHouseholdOwnerIsPro(): Promise<boolean> {
  const { data, error } = await supabase.rpc('household_owner_is_pro');
  if (error) return false;
  return data === true;
}

export async function getMyHousehold(userId: string): Promise<Household | null> {
  const { data: member, error } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!member) return null;

  const { data: hh, error: hhError } = await supabase
    .from('households')
    .select('id, owner_id, invite_code, created_at')
    .eq('id', member.household_id)
    .maybeSingle();
  if (hhError) throw hhError;
  if (!hh) return null;

  const household = toHousehold(hh as HouseholdRow, member.role as HouseholdRole);
  return { ...household, ownerIsPro: await getHouseholdOwnerIsPro() };
}

/** Create a new household. Throws if the caller isn't Pro or is already in one. */
export async function createHousehold(): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household');
  if (error) throw new Error(error.message);
  // The creator just passed the Pro check server-side to get here.
  return { ...toHousehold(data as HouseholdRow, 'owner'), ownerIsPro: true };
}

/** Join a household by invite code. Throws if invalid, full, or already joined. */
export async function joinHousehold(code: string): Promise<Household> {
  const { data, error } = await supabase.rpc('join_household', { p_code: code });
  if (error) throw new Error(error.message);
  const household = toHousehold(data as HouseholdRow, 'member');
  return { ...household, ownerIsPro: await getHouseholdOwnerIsPro() };
}

/** Leave the current household (disbands it if you're the last member). */
export async function leaveHousehold(): Promise<void> {
  const { error } = await supabase.rpc('leave_household');
  if (error) throw new Error(error.message);
}

/** List the members of the caller's household, with display names. */
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data, error } = await supabase.rpc('household_members_info');
  if (error || !data) return [];
  return (data as { user_id: string; name: string | null; role: string }[]).map(r => ({
    userId: r.user_id,
    name: r.name,
    role: r.role as HouseholdRole,
  }));
}
