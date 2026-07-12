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

// Image OCR is slower than a chat turn; give it a generous ceiling but never let
// the spinner hang forever on a stalled mobile connection.
const REQUEST_TIMEOUT_MS = 30000;

export async function scanReceipt(base64Image: string): Promise<ReceiptItem[]> {
  const url = import.meta.env.DEV ? '/api/receipt-ocr' : hostedUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!import.meta.env.DEV) {
    Object.assign(headers, await getAiAuthHeaders(supabaseAnonKey));
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Receipt scan timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as ReceiptOcrResponse;
    throw new Error(data.error || `Receipt scan failed (${response.status})`);
  }

  const data = await response.json() as ReceiptOcrResponse;
  return data.items ?? [];
}
