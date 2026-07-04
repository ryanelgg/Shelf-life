import { AVO_SYSTEM_PROMPT } from '../../../src/lib/avoPrompt.ts';
import { corsHeaders, json, guardAiRequest } from '../_shared/aiGuard.ts';

type AvoChatMessage = { role: 'user' | 'assistant'; content: string };

// Per-user daily ceiling. Sits ABOVE the in-app free/Pro chat limits — this is
// the abuse/cost backstop, not the product paywall.
const DAILY_LIMIT = 60;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const guard = await guardAiRequest(request, 'avo-chat', DAILY_LIMIT);
  if (!guard.ok) return guard.response;

  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    return json({ error: 'GROQ_API_KEY is not configured for the avo-chat function' }, { status: 500 });
  }

  try {
    const { messages } = await request.json() as { messages?: AvoChatMessage[] };
    if (!messages || messages.length === 0) {
      return json({ error: 'No messages provided' }, { status: 400 });
    }

    // Validate the client payload before forwarding it to Groq. The system
    // prompt is set server-side only: reject any client-supplied 'system' (or
    // otherwise malformed) role so a user can't override Avo's instructions,
    // and cap the count/size so a single request can't run up the token bill.
    const MAX_MESSAGES = 40;
    const MAX_CONTENT_CHARS = 4000;
    // Reject oversized arrays up front so a single huge payload can't burn
    // CPU/memory in the validation loop before we would have trimmed it anyway.
    if (messages.length > MAX_MESSAGES) {
      return json({ error: 'Too many messages in request' }, { status: 400 });
    }
    const safeMessages: AvoChatMessage[] = [];
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return json({ error: 'Invalid message in request' }, { status: 400 });
      }
      safeMessages.push({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) });
    }
    const trimmedMessages = safeMessages.slice(-MAX_MESSAGES);

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
          ...trimmedMessages,
        ],
      }),
    });

    if (!groqResponse.ok) {
      // Log the upstream detail server-side but return a generic message so we
      // don't leak provider internals to the client.
      console.error(`[avo-chat] Groq request failed ${groqResponse.status}:`, await groqResponse.text());
      return json({ error: 'Avo is having trouble right now. Please try again.' }, { status: 502 });
    }

    const payload = await groqResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return json({ error: 'Groq returned an empty response' }, { status: 502 });
    }

    return json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected function error';
    return json({ error: message }, { status: 500 });
  }
});
