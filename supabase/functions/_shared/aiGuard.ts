// Shared auth + rate-limit guard for the AI edge functions.
//
// Closes the "anyone with the public anon key can burn our AI budget" hole:
//   1. Requires a real signed-in user (the anon key is NOT a user token, so
//      auth.getUser() rejects it).
//   2. Enforces a per-user, per-day ceiling via the increment_ai_usage RPC.
//
// Usage in a function:
//   const guard = await guardAiRequest(request, 'avo-chat', 60);
//   if (!guard.ok) return guard.response;   // 401 / 429 / 500 already built
//   const userId = guard.userId;            // verified caller

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export async function guardAiRequest(
  request: Request,
  kind: string,
  dailyLimit: number,
): Promise<GuardResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { ok: false, response: json({ error: 'Please sign in to use Avo.' }, { status: 401 }) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, response: json({ error: 'Server is not configured for authentication.' }, { status: 500 }) };
  }

  // Verify the caller's JWT. The anon key has no user, so getUser() fails for it.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, response: json({ error: 'Please sign in to use Avo.' }, { status: 401 }) };
  }
  const userId = userData.user.id;

  // Count this use and check the per-user daily ceiling (service role bypasses RLS).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: rl, error: rlError } = await admin.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_kind: kind,
    p_limit: dailyLimit,
  });
  if (rlError) {
    return { ok: false, response: json({ error: 'Could not verify usage limit. Please try again.' }, { status: 500 }) };
  }
  const row = Array.isArray(rl) ? rl[0] : rl;
  if (!row || row.allowed !== true) {
    return {
      ok: false,
      response: json(
        { error: "You've hit today's limit for this feature. It resets tomorrow." },
        { status: 429 },
      ),
    };
  }

  return { ok: true, userId };
}

/**
 * Refund one counted use when the downstream provider call fails, so a user
 * isn't charged against their daily ceiling for a request that never produced a
 * result. Best-effort: a failed refund must never turn into a failed response.
 */
export async function refundAiUsage(userId: string, kind: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.rpc('decrement_ai_usage', { p_user_id: userId, p_kind: kind });
  } catch {
    // swallow — the user already got their error; don't compound it
  }
}
