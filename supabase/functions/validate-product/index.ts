// Validates + normalizes a user-submitted community product entry using the
// same Groq model that powers Avo chat. This does NOT look up the barcode —
// an LLM has no reliable barcode→product database in its weights. It judges
// only the text the user typed: rejecting gibberish/test/profane entries and
// normalizing capitalization, abbreviations, and the food category so the
// crowd-sourced database stays clean.

type FoodCategory =
  | 'Produce' | 'Dairy' | 'Meat' | 'Seafood' | 'Grains' | 'Frozen'
  | 'Canned' | 'Snacks' | 'Beverages' | 'Condiments' | 'Bakery' | 'Deli' | 'Other';

const CATEGORIES: FoodCategory[] = [
  'Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen',
  'Canned', 'Snacks', 'Beverages', 'Condiments', 'Bakery', 'Deli', 'Other',
];

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

const SYSTEM_PROMPT = `You validate and clean up user-submitted grocery product entries for a crowd-sourced food database. Users scan a barcode the database doesn't recognize and type in the product themselves, so entries can be sloppy, mistaken, or junk.

You CANNOT look up barcodes and must never invent a product. Judge ONLY the text the user typed.

Reject the entry (valid=false) when the name is gibberish ("asdf", "test", random characters), a placeholder, profane, or clearly not a real grocery product. Give a short friendly reason.

Otherwise accept it (valid=true) and normalize:
- name: the concise product name with proper capitalization (e.g. "coca cola" -> "Coca-Cola Classic"). Do not invent details you weren't given.
- brand: the brand if the user supplied one, otherwise null.
- category: the single best fit from this exact list: ${CATEGORIES.join(', ')}.

Respond with ONLY a JSON object: {"valid": boolean, "name": string, "brand": string|null, "category": string, "reason": string}.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    return json({ error: 'GROQ_API_KEY is not configured for the validate-product function' }, { status: 500 });
  }

  try {
    const { barcode, name, brand, category } = await request.json() as {
      barcode?: string; name?: string; brand?: string; category?: string;
    };
    if (!name || !name.trim()) {
      return json({ error: 'No product name provided' }, { status: 400 });
    }

    const userMsg = `Barcode: ${barcode ?? 'unknown'}
Name: ${name}
Brand: ${brand || '(none)'}
Category guess: ${category || '(none)'}`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const details = await groqResponse.text();
      return json({ error: details || `Groq request failed with ${groqResponse.status}` }, { status: groqResponse.status });
    }

    const payload = await groqResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content?.trim();
    if (!raw) return json({ error: 'Groq returned an empty response' }, { status: 502 });

    let parsed: { valid?: boolean; name?: string; brand?: string | null; category?: string; reason?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'Could not parse validation result' }, { status: 502 });
    }

    // Guard against the model returning a category outside our union.
    const safeCategory = CATEGORIES.includes(parsed.category as FoodCategory)
      ? parsed.category as FoodCategory
      : 'Other';

    return json({
      valid: parsed.valid === true,
      name: (parsed.name ?? name).trim(),
      brand: parsed.brand ? String(parsed.brand).trim() : null,
      category: safeCategory,
      reason: parsed.reason ?? '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected function error';
    return json({ error: message }, { status: 500 });
  }
});
