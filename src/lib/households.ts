import { supabase } from './supabase';
import type { HouseholdRow } from './supabase';
import type { Household, HouseholdMember, HouseholdRole } from '../types';

// All mutations go through SECURITY DEFINER Postgres RPCs (see
// supabase/migrations/0001_households.sql) so the Pro requirement and the
// 4-member cap are enforced server-side and can't be bypassed from the client.

function toHousehold(row: HouseholdRow, role: HouseholdRole): Household {
  return { id: row.id, inviteCode: row.invite_code, ownerId: row.owner_id, role };
}

/** Returns the caller's household, or null if they aren't in one. */
export async function getMyHousehold(userId: string): Promise<Household | null> {
  const { data: member, error } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !member) return null;

  const { data: hh } = await supabase
    .from('households')
    .select('id, owner_id, invite_code, created_at')
    .eq('id', member.household_id)
    .maybeSingle();
  if (!hh) return null;

  return toHousehold(hh as HouseholdRow, member.role as HouseholdRole);
}

/** Create a new household. Throws if the caller isn't Pro or is already in one. */
export async function createHousehold(): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household');
  if (error) throw new Error(error.message);
  return toHousehold(data as HouseholdRow, 'owner');
}

/** Join a household by invite code. Throws if invalid, full, or already joined. */
export async function joinHousehold(code: string): Promise<Household> {
  const { data, error } = await supabase.rpc('join_household', { p_code: code });
  if (error) throw new Error(error.message);
  return toHousehold(data as HouseholdRow, 'member');
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
