import { supabase } from './supabase';
import * as debug from './debug';
import type { FoodCategory } from '../types';

export interface CommunityProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: FoodCategory;
}

export interface ProductDraft {
  name: string;
  brand: string;
  category: FoodCategory;
}

export async function lookupCommunityProduct(barcode: string): Promise<CommunityProduct | null> {
  const { data } = await supabase
    .from('community_products')
    .select('barcode, name, brand, category')
    .eq('barcode', barcode)
    .maybeSingle();
  if (!data) return null;
  return {
    barcode: data.barcode,
    name: data.name,
    brand: data.brand ?? null,
    category: data.category as FoodCategory,
  };
}

// ── AI validation ──────────────────────────────────────────────────────────
//
// Runs the user's typed entry through Avo's model (server-side, via the
// validate-product Edge Function) to reject junk and normalize the name/brand/
// category before it lands in the shared database. The model can't look up the
// barcode itself — it only cleans up and sanity-checks the text the user typed.

export interface ValidationResult {
  valid: boolean;
  name: string;
  brand: string | null;
  category: FoodCategory;
  reason: string;
  /** True only when the model actually ran. On network/server failure we
   *  fail open (checked=false) so a real contribution is never blocked. */
  checked: boolean;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const validateUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/validate-product`;

export async function validateCommunityProduct(
  barcode: string,
  draft: ProductDraft,
): Promise<ValidationResult> {
  const failOpen: ValidationResult = {
    valid: true,
    name: draft.name.trim(),
    brand: draft.brand.trim() || null,
    category: draft.category,
    reason: '',
    checked: false,
  };

  try {
    const res = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ barcode, ...draft }),
    });
    if (!res.ok) {
      debug.warn('[community] validation request failed', res.status);
      return failOpen;
    }
    const data = await res.json() as Partial<ValidationResult>;
    return {
      valid: data.valid !== false,
      name: (data.name ?? draft.name).trim(),
      brand: data.brand ? String(data.brand).trim() : null,
      category: (data.category as FoodCategory) ?? draft.category,
      reason: data.reason ?? '',
      checked: true,
    };
  } catch (err) {
    debug.warn('[community] validation error', err);
    return failOpen;
  }
}

// ── Submission ─────────────────────────────────────────────────────────────

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

/**
 * Save a contributed product. Prefers the `submit_community_product` RPC, which
 * counts confirmations and refuses to let an unverified entry overwrite a
 * different, already-stored one (stops the "last write wins" corruption). If
 * that RPC isn't deployed yet, falls back to the original plain upsert so
 * submissions keep working.
 *
 * `verified` should be the AI validation's `valid && checked` result.
 */
export async function submitCommunityProduct(
  barcode: string,
  product: ProductDraft,
  verified = false,
): Promise<SubmitResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const name = product.name.trim();
  const brand = product.brand.trim() || null;

  const rpc = await supabase.rpc('submit_community_product', {
    p_barcode: barcode,
    p_name: name,
    p_brand: brand,
    p_category: product.category,
    p_verified: verified,
    p_submitted_by: user?.id ?? null,
  });
  if (!rpc.error) return { ok: true };

  // RPC missing (migration not applied) or any RPC failure → fall back to the
  // original upsert against the base columns so contributions still land.
  debug.warn('[community] submit RPC failed, falling back to upsert', rpc.error.message);
  const { error } = await supabase.from('community_products').upsert({
    barcode,
    name,
    brand,
    category: product.category,
    submitted_by: user?.id ?? null,
  });
  if (error) {
    debug.error('[community] submit failed', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
