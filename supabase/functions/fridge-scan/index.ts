import * as Sentry from "https://deno.land/x/sentry/index.mjs";
import { corsHeaders, json, guardAiRequest, refundAiUsage } from '../_shared/aiGuard.ts';

const DAILY_LIMIT = 40;

const FRIDGE_PROMPT = `You are a kitchen-inventory vision system. Look at this photo of an open fridge, freezer, or pantry shelf and list the distinct food/drink items you can see.
Return ONLY a JSON array of objects with "name" and "quantity" fields. Example:
[{"name": "Milk", "quantity": 1}, {"name": "Eggs", "quantity": 1}, {"name": "Apples", "quantity": 5}]
Rules:
- List only food and drink items (skip containers, utensils, shelves, packaging with no identifiable food, and non-food objects)
- Use clean, common food names (e.g. "Greek Yogurt", not a brand's full marketing text)
- "quantity" is the count of that item visible, as a whole number; if unsure, use 1
- Combine obvious duplicates of the same item into one entry with a higher quantity
- Do not guess items you cannot actually see
- If the image has no identifiable food, return an empty array []
- Return ONLY the JSON array, no other text`;

Sentry.init({ dsn: Deno.env.get('SENTRY_DSN') });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  const guard = await guardAiRequest(request, 'fridge-scan', DAILY_LIMIT);
  if (!guard.ok) return guard.response;

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    await refundAiUsage(guard.userId, 'fridge-scan');
    return json({ error: 'Fridge scanning is not available right now.' }, { status: 500 });
  }
  try {
    const { image } = await request.json() as { image?: string };
    if (!image) {
      await refundAiUsage(guard.userId, 'fridge-scan');
      return json({ error: 'No image provided' }, { status: 400 });
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
        // A full fridge/pantry shelf can exceed 1024 output tokens; when it did
        // the JSON array was cut off, the parse failed, and the user was charged
        // a scan credit for zero items. Give the list room to complete.
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: FRIDGE_PROMPT },
          ],
        }],
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      await refundAiUsage(guard.userId, 'fridge-scan');
      console.error(`[fridge-scan] Anthropic ${response.status}:`, details);
      return json({ error: 'Fridge scan had trouble. Please try again.' }, { status: 502 });
    }
    const result = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };
    // Truncated response: the list was cut off, so any JSON we could scrape is
    // incomplete. Refund the credit and tell the user rather than silently
    // returning a partial/empty list they paid for.
    if (result.stop_reason === 'max_tokens') {
      await refundAiUsage(guard.userId, 'fridge-scan');
      console.error('[fridge-scan] response truncated (max_tokens)');
      return json({ error: 'That was a lot to look at — try scanning one shelf at a time.' }, { status: 502 });
    }
    const text = result.content?.find(b => b.type === 'text')?.text?.trim() ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // No parseable array at all — a malformed response, not a legitimate empty
      // result (the model returns "[]" for "no items"). Refund so a garbled
      // response doesn't cost a scan credit.
      await refundAiUsage(guard.userId, 'fridge-scan');
      console.error('[fridge-scan] no JSON array in response');
      return json({ error: 'Fridge scan had trouble. Please try again.' }, { status: 502 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ name?: unknown; quantity?: unknown }>;
    // Keep only well-formed rows; coerce quantity to a whole number >= 1.
    const items = (Array.isArray(parsed) ? parsed : [])
      .filter(it => it && typeof it.name === 'string' && it.name.trim())
      .map(it => ({
        name: (it.name as string).trim(),
        quantity: typeof it.quantity === 'number' && isFinite(it.quantity) && it.quantity >= 1
          ? Math.round(it.quantity)
          : 1,
      }));
    return json({ items });
  } catch (error) {
    Sentry.captureException(error);
    await refundAiUsage(guard.userId, 'fridge-scan');
    console.error('[fridge-scan] error:', error instanceof Error ? error.message : error);
    return json({ error: 'Fridge scan had trouble. Please try again.' }, { status: 500 });
  }
});
