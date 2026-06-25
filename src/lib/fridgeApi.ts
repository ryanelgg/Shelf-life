interface FridgeItem {
  name: string;
  quantity?: number;
}

interface FridgeScanResponse {
  items?: FridgeItem[];
  error?: string;
}

import { getAccessToken } from './supabase';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const hostedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/fridge-scan`;

/**
 * "Snap your fridge" — send one photo of an open fridge/shelf and get back the
 * food items the AI can see, ready to review and add to the pantry. Mirrors the
 * receipt-OCR pipeline but returns counts instead of prices.
 */
export async function scanFridge(base64Image: string): Promise<FridgeItem[]> {
  const url = import.meta.env.DEV ? '/api/fridge-scan' : hostedUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!import.meta.env.DEV) {
    // User token so the function can identify + rate-limit the caller; the anon
    // key fallback is rejected server-side (sign-in required).
    const token = await getAccessToken();
    headers['apikey'] = supabaseAnonKey;
    headers['Authorization'] = `Bearer ${token ?? supabaseAnonKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as FridgeScanResponse;
    throw new Error(data.error || `Fridge scan failed (${response.status})`);
  }

  const data = await response.json() as FridgeScanResponse;
  return data.items ?? [];
}
