import { getAiAuthHeaders } from './authHeaders';

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptOcrResponse {
  items?: ReceiptItem[];
  error?: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const hostedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/receipt-ocr`;

export async function scanReceipt(base64Image: string): Promise<ReceiptItem[]> {
  const url = import.meta.env.DEV ? '/api/receipt-ocr' : hostedUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!import.meta.env.DEV) {
    Object.assign(headers, await getAiAuthHeaders(supabaseAnonKey));
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
