import { supabase } from './supabase';
import type { FoodCategory } from '../types';
import * as debug from './debug';

export interface CommunityProduct {
  barcode: string;
  name: string;
  brand: string | null;
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

export async function submitCommunityProduct(
  barcode: string,
  product: { name: string; brand: string; category: FoodCategory },
): Promise<void> {
  // Don't write blank/garbage rows that would then be served to other users.
  const cleanBarcode = barcode.trim();
  const cleanName = product.name.trim();
  if (!cleanBarcode || !cleanName) {
    debug.warn('[communityProducts] skipped submit: empty barcode or name');
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  // insert-if-absent (ON CONFLICT DO NOTHING): a barcode's FIRST crowd-sourced
  // entry wins and is never overwritten. Previously this upserted on the
  // barcode key, so any later re-scan — including a mistyped or wrong-category
  // one — clobbered a good existing entry that's served to every other user.
  // ignoreDuplicates keeps the known-good row; corrections are a moderation
  // concern, not something a single re-scan should silently do.
  const { error } = await supabase.from('community_products').upsert({
    barcode: cleanBarcode,
    name: cleanName,
    brand: product.brand.trim() || null,
    category: product.category,
    submitted_by: user?.id ?? null,
  }, { onConflict: 'barcode', ignoreDuplicates: true });
  // Previously the result was discarded, so a rejected write (RLS, NOT NULL on
  // submitted_by for guests, network) failed completely silently. Surface it.
  if (error) debug.warn('[communityProducts] submit failed:', error.message);
}
