import * as Sentry from "https://deno.land/x/sentry/index.mjs";
import { corsHeaders, json, guardAiRequest } from '../_shared/aiGuard.ts';

const DAILY_LIMIT = 40;

const RECEIPT_PROMPT = `You are a receipt OCR system. Extract grocery/food items and their prices from this receipt image.
Return ONLY a JSON array of objects with "name" and "price" fields. Example:
[{"name": "Organic Milk", "price": 5.49}, {"name": "Bananas", "price": 1.29}]
Rules:
- Extract only food/grocery items (skip tax, subtotal, total, discounts, store info, non-food items)
- Use clean, readable product names (not raw receipt abbreviations)
- Price should be a number, not a string
- If you can't read a price clearly, use 0
- If the image is not a receipt or has no food items, return an empty array []
- Return ONLY the JSON array, no other text`;

Sentry.init({ dsn: Deno.env.get('SENTRY_DSN') });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  const guard = await guardAiRequest(request, 'receipt-ocr', DAILY_LIMIT);
  if (!guard.ok) return guard.response;

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }
  try {
    const { image } = await request.json() as { image?: string };
    if (!image) {
      return json({ error: 'No image provided' }, { status: 400 });
    }
    // Cap payload size so an oversized upload can't spike cost/memory (base64
    // of a ~7MB image is ~9.5M chars; 12M leaves comfortable headroom).
    if (image.length > 12_000_000) {
      return json({ error: 'Image is too large. Please use a smaller photo.' }, { status: 413 });
    }
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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        }],
      }),
    });
    if (!response.ok) {
      // Log the upstream detail server-side but return a generic message so we
      // don't leak the provider's raw error body / status to the client.
      console.error(`[receipt-ocr] Anthropic request failed ${response.status}:`, await response.text());
      return json({ error: 'Could not read the receipt right now. Please try again.' }, { status: 502 });
    }
    const result = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = result.content?.find(b => b.type === 'text')?.text?.trim() ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return json({ items: [] });
    }
    // The model can wrap the array in prose; a bad parse must not 500. Fall back
    // to an empty list so the client shows "no items found" instead of an error.
    let items: Array<{ name: string; price: number }> = [];
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      return json({ items: [] });
    }
    return json({ items });
  } catch (error) {
    Sentry.captureException(error);
    // Keep the detail in Sentry; never return internal error text to the client.
    return json({ error: 'Something went wrong reading the receipt.' }, { status: 500 });
  }
});
