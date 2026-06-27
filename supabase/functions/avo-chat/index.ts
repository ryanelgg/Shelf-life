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
          ...messages,
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

    return json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected function error';
    return json({ error: message }, { status: 500 });
  }
});
