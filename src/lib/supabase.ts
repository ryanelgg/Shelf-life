import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  avatar?: string | null;
  best_streak?: number;
  card_theme?: string | null;
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
  updated_at?: string;
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
