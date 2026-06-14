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
  const { data, error } = await supabase
    .from('community_products')
    .select('barcode, name, brand, category')
    .eq('barcode', barcode)
    .maybeSingle();
  // A network/RLS error returns null data too — log it so a transient failure
  // isn't silently indistinguishable from a genuine "no match".
  if (error) debug.warn('[community] lookup failed:', error.message);
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
  const { error } = await supabase.from('community_products').upsert({
    barcode,
    name: product.name.trim(),
    brand: product.brand.trim() || null,
    category: product.category,
    submitted_by: user?.id ?? null,
  });
  // Don't throw (callers treat this as fire-and-forget), but surface failures.
  if (error) debug.warn('[community] submit failed:', error.message);
}
