const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

// Today's date is passed in from the client so the model can disambiguate
// 2-digit years and decide whether a date like "03/15" is past or future.
const datePrompt = (todayISO: string) => `You are a date OCR system. Find the expiration / best-by / use-by date on this food packaging image.

Return ONLY a JSON object: {"date": "YYYY-MM-DD"} or {"date": null} if no date is visible.

Rules:
- Look for labels like "EXP", "BEST BY", "USE BY", "BB", "Sell By", or a bare date.
- If multiple dates are visible, return the one most likely to be expiration (not the manufacture or packaging date).
- 2-digit years assume 2000s. Today is ${todayISO}, so a date that would be more than 5 years in the past is probably next century.
- Common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD MMM YYYY, "MAR 15 2026".
- If the format is ambiguous between MM/DD and DD/MM (e.g. "03/04/2026"), prefer the interpretation that places the date in the future relative to today.
- If you can't read a date clearly, return {"date": null}. Don't guess.
- Return ONLY the JSON object, no other text.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const { image, today } = await request.json() as { image?: string; today?: string };
    if (!image) {
      return json({ error: 'No image provided' }, { status: 400 });
    }

    const todayISO = (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today))
      ? today
      : new Date().toISOString().slice(0, 10);

    let mediaType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 128,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: datePrompt(todayISO) },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return json({ error: details || `Anthropic API error ${response.status}` }, { status: response.status });
    }

    const result = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = result.content?.find(b => b.type === 'text')?.text?.trim() ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ date: null });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { date?: string | null };
    const date = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    return json({ date });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, { status: 500 });
  }
});
