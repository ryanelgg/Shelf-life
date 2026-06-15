import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { AVO_SYSTEM_PROMPT } from '../../../src/lib/avoPrompt.ts';
import { FREE_LIMITS, formatLocalDate } from '../../../src/types/index.ts';

type AvoChatMessage = { role: 'user' | 'assistant'; content: string };

// Server-side guards against an attacker blowing up the bill with one giant call.
// These cap the conversation history forwarded to the model regardless of what
// the client sends. (The model itself is also capped via max_tokens below.)
const MAX_MESSAGES = 16;          // only forward the most recent N turns
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOTAL_CHARS = 16000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

// Trim the conversation to a safe size before it ever reaches the model.
function capMessages(messages: AvoChatMessage[]): AvoChatMessage[] {
  const recent = messages.slice(-MAX_MESSAGES);
  let total = 0;
  const capped: AvoChatMessage[] = [];
  for (const m of recent) {
    const content = String(m.content ?? '').slice(0, MAX_CHARS_PER_MESSAGE);
    if (total + content.length > MAX_TOTAL_CHARS) break;
    total += content.length;
    capped.push({ role: m.role, content });
  }
  return capped;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    return json({ error: 'GROQ_API_KEY is not configured for the avo-chat function' }, { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase credentials are not configured for the avo-chat function' }, { status: 500 });
  }

  // ── 1. Identify the caller ──────────────────────────────────────────────────
  // Require a real user session token, not just the public anon key. Without
  // this, anyone with the (public) anon key could call this function in a loop
  // and run up the AI bill. Guests get an anonymous Supabase session client-side
  // so they have a token too.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, { status: 401 });
  }
  const userId = userData.user.id;

  try {
    const { messages } = await request.json() as { messages?: AvoChatMessage[] };
    if (!messages || messages.length === 0) {
      return json({ error: 'No messages provided' }, { status: 400 });
    }

    // ── 2. Enforce the daily quota server-side ───────────────────────────────
    // Mirrors the client rules in src/store/useStore.ts (incrementAvoChat):
    //   free → 5 chats forever; pro → 20 chats per day (resets on date change).
    // The DB is the source of truth; the client only reflects what we return.
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_tier, avo_chat_count, avo_chat_reset_date')
      .eq('id', userId)
      .maybeSingle();

    const today = formatLocalDate(new Date());
    const tier = profile?.subscription_tier ?? 'free';
    const storedCount = profile?.avo_chat_count ?? 0;

    let usedCount: number;
    let limit: number;
    if (tier === 'pro') {
      // Pro resets daily — a stored count from a previous day counts as 0.
      usedCount = profile?.avo_chat_reset_date === today ? storedCount : 0;
      limit = FREE_LIMITS.proChatPerDay;
    } else {
      // Free is a permanent lifetime cap that never resets.
      usedCount = storedCount;
      limit = FREE_LIMITS.avoChatTotal;
    }

    if (usedCount >= limit) {
      return json(
        { error: 'Daily Avo chat limit reached', code: 'chat_limit_reached', chatCount: usedCount },
        { status: 429 },
      );
    }

    // ── 3. Call the model with a size-capped conversation ────────────────────
    const safeMessages = capMessages(messages);
    if (safeMessages.length === 0) {
      return json({ error: 'No messages provided' }, { status: 400 });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200,
        messages: [
          { role: 'system', content: AVO_SYSTEM_PROMPT },
          ...safeMessages,
        ],
      }),
    });

    if (!groqResponse.ok) {
      const details = await groqResponse.text();
      return json({ error: details || `Groq request failed with ${groqResponse.status}` }, { status: groqResponse.status });
    }

    const payload = await groqResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return json({ error: 'Groq returned an empty response' }, { status: 502 });
    }

    // ── 4. Charge the quota only after a successful call ──────────────────────
    // (A failed model call must not burn the user's allowance.)
    const newCount = usedCount + 1;
    const update: Record<string, unknown> = { avo_chat_count: newCount };
    if (tier === 'pro') update.avo_chat_reset_date = today;
    await admin.from('profiles').update(update).eq('id', userId);

    return json({ text, chatCount: newCount, chatResetDate: tier === 'pro' ? today : profile?.avo_chat_reset_date ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected function error';
    return json({ error: message }, { status: 500 });
  }
});
