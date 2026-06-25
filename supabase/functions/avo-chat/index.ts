import { AVO_SYSTEM_PROMPT } from '../../../src/lib/avoPrompt.ts';
import { corsHeaders, json, guardAi } from '../_shared/guard.ts';

type AvoChatMessage = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Require a signed-in user + enforce per-user ceilings. Avo chat is cheap
  // (Groq) so the caps are generous, but still fatal to a runaway loop.
  const gate = await guardAi(request, { fn: 'avo-chat', perMinute: 8, perHour: 60, perDay: 100 });
  if (!gate.ok) return gate.response;

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
