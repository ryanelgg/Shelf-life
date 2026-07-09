// Reads the front of a grocery product package from a photo and returns a
// structured {name, brand, category}. Used when a scanned barcode is unknown:
// instead of typing the product blind, the user photographs the actual package
// and a vision model reads the real label. Mirrors receipt-ocr's setup (Claude
// vision via ANTHROPIC_API_KEY).

import { corsHeaders, json, guardAiRequest } from '../_shared/aiGuard.ts';

const DAILY_LIMIT = 40;

const CATEGORIES = [
  'Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen',
  'Canned', 'Snacks', 'Beverages', 'Condiments', 'Bakery', 'Deli', 'Other',
];

const PROMPT = `You are reading a photo of the front of a single grocery product package.
Identify the product from what is printed on the package. Do not guess details that aren't visible.
Return ONLY a JSON object: {"name": string|null, "brand": string|null, "category": string}
- name: the concise product name as printed (e.g. "Tomato Ketchup"), null if you can't read it.
- brand: the brand as printed (e.g. "Heinz"), null if not visible.
- category: the single best fit from this exact list: ${CATEGORIES.join(', ')}.
- If the image isn't a grocery product or is unreadable, return {"name": null, "brand": null, "category": "Other"}.
Return ONLY the JSON object, no other text.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const guard = await guardAiRequest(request, 'product-photo', DAILY_LIMIT);
  if (!guard.ok) return guard.response;

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    await guard.refund();
    return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const { image } = await request.json() as { image?: string };
    if (!image) return json({ error: 'No image provided' }, { status: 400 });
    // Reject oversized payloads before spending model tokens (~6 MB decoded).
    if (image.length > 8_000_000) {
      await guard.refund();
      return json({ error: 'Image too large' }, { status: 400 });
    }

    let mediaType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) { mediaType = match[1]; base64Data = match[2]; }
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
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error(`[product-photo] Anthropic request failed ${response.status}:`, await response.text());
      await guard.refund();
      return json({ error: 'Product photo scanning is having trouble right now. Please try again.' }, { status: 502 });
    }

    const result = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const text = result.content?.find(b => b.type === 'text')?.text?.trim() ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ name: null, brand: null, category: 'Other' });

    const parsed = JSON.parse(match[0]) as { name?: string | null; brand?: string | null; category?: string };
    const category = CATEGORIES.includes(parsed.category ?? '') ? parsed.category : 'Other';
    return json({
      name: parsed.name ? String(parsed.name).trim() : null,
      brand: parsed.brand ? String(parsed.brand).trim() : null,
      category,
    });
  } catch (error) {
    await guard.refund();
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, { status: 500 });
  }
});
