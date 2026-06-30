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
  const { data: { user } } = await supabase.auth.getUser();
  // onConflict: 'barcode' targets the community_products_pkey so a re-scan of
  // a known barcode updates the existing row instead of inserting a duplicate.
  const { error } = await supabase.from('community_products').upsert({
    barcode,
    name: product.name.trim(),
    brand: product.brand.trim() || null,
    category: product.category,
    submitted_by: user?.id ?? null,
  }, { onConflict: 'barcode' });
  // Previously the result was discarded, so a rejected write (RLS, NOT NULL on
  // submitted_by for guests, network) failed completely silently. Surface it.
  if (error) debug.warn('[communityProducts] submit failed:', error.message);
}
