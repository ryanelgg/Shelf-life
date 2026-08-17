import * as Sentry from "https://deno.land/x/sentry/index.mjs";
import { corsHeaders, json, guardAiRequest, refundAiUsage, parseImageInput } from '../_shared/aiGuard.ts';

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
    await refundAiUsage(guard.userId, 'receipt-ocr');
    return json({ error: 'Receipt scanning is not available right now.' }, { status: 500 });
  }
  try {
    const { image } = await request.json() as { image?: string };
    if (!image) {
      await refundAiUsage(guard.userId, 'receipt-ocr');
      return json({ error: 'No image provided' }, { status: 400 });
    }
    const img = parseImageInput(image);
    if (!img.ok) {
      // Pre-provider validation (bad format / oversized) — no billed call made, so refund.
      await refundAiUsage(guard.userId, 'receipt-ocr');
      return json({ error: img.error }, { status: img.status });
    }
    const { mediaType, base64Data } = img;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        // A long receipt can exceed 1024 output tokens; when it did the JSON
        // array was cut off (no closing "]"), the parse failed, and the user was
        // charged a scan credit for zero items. Give the list room to complete.
        max_tokens: 4096,
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
      const details = await response.text();
      await refundAiUsage(guard.userId, 'receipt-ocr');
      // Log upstream detail server-side; return a generic 502 so a provider 429
      // isn't mistaken for the app's own daily-limit 429, and internals aren't leaked.
      console.error(`[receipt-ocr] Anthropic ${response.status}:`, details);
      return json({ error: 'Receipt scan had trouble. Please try again.' }, { status: 502 });
    }
    const result = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };
    // Truncated response: the list was cut off. This was a real, BILLED provider
    // call, so it counts against the daily scan cap — do NOT refund (a user who
    // reliably forces truncation could otherwise make unlimited billed calls
    // without ever hitting the ceiling). Still tell the user rather than
    // returning a partial list.
    if (result.stop_reason === 'max_tokens') {
      console.error('[receipt-ocr] response truncated (max_tokens)');
      return json({ error: 'That receipt was too long to read in one go. Try scanning it in sections.' }, { status: 502 });
    }
    const text = result.content?.find(b => b.type === 'text')?.text?.trim() ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // No parseable array at all — a garbled but BILLED response. Same reasoning
      // as the max_tokens path: it counts against the cap, so no refund.
      console.error('[receipt-ocr] no JSON array in response');
      return json({ error: 'Receipt scan had trouble. Please try again.' }, { status: 502 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ name?: unknown; price?: unknown }>;
    // Keep only well-formed rows; coerce price to a non-negative number.
    const items = (Array.isArray(parsed) ? parsed : [])
      .filter(it => it && typeof it.name === 'string' && it.name.trim())
      .map(it => ({
        name: (it.name as string).trim(),
        price: typeof it.price === 'number' && isFinite(it.price) && it.price >= 0 ? it.price : 0,
      }));
    return json({ items });
  } catch (error) {
    Sentry.captureException(error);
    await refundAiUsage(guard.userId, 'receipt-ocr');
    console.error('[receipt-ocr] error:', error instanceof Error ? error.message : error);
    return json({ error: 'Receipt scan had trouble. Please try again.' }, { status: 500 });
  }
});
