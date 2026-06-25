import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Shared CORS + helpers for the AI edge functions.
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

export interface RateLimit {
  /** Logical name recorded in ai_usage so each AI feature is metered separately. */
  fn: string;
  perMinute: number;
  perHour: number;
  perDay: number;
}

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

/**
 * Gate an AI edge function: require a signed-in user (a bare anon key is
 * rejected) and enforce per-user minute/hour/day call ceilings server-side so a
 * leaked anon key or a runaway loop can't run up the AI bill. The in-app tier
 * limits are a UX nicety; THIS is the limit that actually protects the wallet.
 */
export async function guardAi(request: Request, limits: RateLimit): Promise<GuardResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { ok: false, response: json({ error: 'Please sign in to use this feature.' }, { status: 401 }) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, response: json({ error: 'Server auth is not configured.' }, { status: 500 }) };
  }

  // Verify the caller is a real, logged-in user. getUser() returns no user for a
  // bare anon-key bearer — exactly what we want to reject.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, response: json({ error: 'Please sign in to use this feature.' }, { status: 401 }) };
  }
  const userId = userData.user.id;

  // Atomically check + record this call against the per-user ceilings.
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc('check_ai_rate_limit', {
    p_user: userId,
    p_function: limits.fn,
    p_per_minute: limits.perMinute,
    p_per_hour: limits.perHour,
    p_per_day: limits.perDay,
  });

  if (error) {
    // Don't break the feature if the limiter itself hiccups — the sign-in gate
    // above already blocks anonymous abuse. Log it for visibility.
    console.error(`[guardAi] rate-limit RPC failed for ${limits.fn}:`, error.message);
    return { ok: true, userId };
  }
  if (data === false) {
    return {
      ok: false,
      response: json(
        { error: "You've hit the usage limit for now — give it a few minutes and try again." },
        { status: 429 },
      ),
    };
  }
  return { ok: true, userId };
}
