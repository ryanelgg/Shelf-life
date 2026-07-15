import { getAiAuthHeaders } from './authHeaders';

interface FridgeItem {
  name: string;
  quantity?: number;
}

interface FridgeScanResponse {
  items?: FridgeItem[];
  error?: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const hostedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/fridge-scan`;

// Image analysis is slower than a chat turn; give it a generous ceiling but
// never let the spinner hang forever on a stalled mobile connection.
const REQUEST_TIMEOUT_MS = 30000;

/**
 * "Snap your fridge" — send one photo of an open fridge/shelf and get back the
 * food items the AI can see, ready to review and add to the pantry. Mirrors the
 * receipt-OCR pipeline but returns counts instead of prices.
 */
export async function scanFridge(base64Image: string): Promise<FridgeItem[]> {
  const url = import.meta.env.DEV ? '/api/fridge-scan' : hostedUrl;
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
      throw new Error('Fridge scan timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as FridgeScanResponse;
    throw new Error(data.error || `Fridge scan failed (${response.status})`);
  }

  const data = await response.json() as FridgeScanResponse;
  return data.items ?? [];
}
