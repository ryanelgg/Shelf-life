import { supabase } from './supabase';

/**
 * Thrown when an AI feature is used without a signed-in account. Callers can
 * catch this to show a friendly "sign in to use Avo" prompt instead of a raw
 * 401. AI now requires sign-in so the server can attribute + rate-limit usage.
 */
export class NotSignedInError extends Error {
  constructor(message = 'Please sign in to use Avo.') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

/**
 * Auth headers for calling an authenticated AI edge function. Sends the
 * current user's access token (NOT the public anon key) so the function can
 * verify who is calling and enforce per-user limits.
 */
export async function getAiAuthHeaders(anonKey: string): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NotSignedInError();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };
}
