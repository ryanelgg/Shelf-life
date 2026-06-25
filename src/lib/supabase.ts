import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * The signed-in user's access token, or null if there's no session (e.g. a
 * local-only "guest"). AI edge functions require this token — a bare anon key
 * is rejected — so callers send it as the Authorization bearer.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Typed row shapes (mirrors the SQL tables) ─────────────────────────────────

export interface ProfileRow {
  id: string;
  name: string | null;
  dietary_preferences: string[];
  subscription_tier: string;
  streak_days: number;
  last_active_date: string | null;
  avo_chat_count: number;
  avo_chat_reset_date: string | null;
  onboarding_complete: boolean;
  auth_provider: string;
  email: string | null;
  created_at: string;
}

export interface HouseholdRow {
  id: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface PantryItemRow {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  added_date: string;
  expiration_date: string;
  estimated_value: number;
  notes: string | null;
  frozen: boolean;
  date_type: string | null;
}

export interface WasteLogRow {
  id: string;
  user_id: string;
  household_id: string | null;
  item_name: string;
  category: string;
  action: string;
  date: string;
  estimated_value: number;
  quantity: number;
}
