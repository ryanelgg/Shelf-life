interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptOcrResponse {
  items?: ReceiptItem[];
  error?: string;
}

import { getAccessToken } from './supabase';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const hostedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/receipt-ocr`;

export async function scanReceipt(base64Image: string): Promise<ReceiptItem[]> {
  const url = import.meta.env.DEV ? '/api/receipt-ocr' : hostedUrl;
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
    const data = await response.json().catch(() => ({})) as ReceiptOcrResponse;
    throw new Error(data.error || `Receipt scan failed (${response.status})`);
  }

  const data = await response.json() as ReceiptOcrResponse;
  return data.items ?? [];
}
