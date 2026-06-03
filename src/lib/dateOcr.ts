import { formatLocalDate } from '../types';

interface DateOcrResponse {
  date?: string | null;
  error?: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const hostedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/date-ocr`;

/**
 * Sends a packaging photo to the date-ocr Edge Function and returns the
 * detected expiration date as YYYY-MM-DD, or null if none could be read.
 */
export async function scanExpirationDate(base64Image: string): Promise<string | null> {
  const url = import.meta.env.DEV ? '/api/date-ocr' : hostedUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!import.meta.env.DEV) {
    headers['apikey'] = supabaseAnonKey;
    headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image: base64Image,
      today: formatLocalDate(new Date()),
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as DateOcrResponse;
    throw new Error(data.error || `Date scan failed (${response.status})`);
  }

  const data = await response.json() as DateOcrResponse;
  return data.date ?? null;
}
