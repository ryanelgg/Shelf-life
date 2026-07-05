import * as Sentry from "https://deno.land/x/sentry/index.mjs";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json } from '../_shared/aiGuard.ts';

// ── Avo Recall Guard — dual-feed recall aggregator (Pro feature) ─────────────
//
// The app can't hit the USDA FSIS feed directly: FSIS sits behind Akamai (which
// blocks datacenter/non-browser callers) and sends no CORS headers, so a
// WKWebView fetch fails. openFDA only covers FDA-regulated foods — it never
// includes USDA meat/poultry recalls. This function fetches BOTH government
// feeds server-side, normalizes them to one shape, and returns the combined
// list. That's the whole point of "dual-feed": most apps check only one.
//
// Auth: requires a signed-in user (same posture as the AI functions) so this
// isn't an open proxy, but it is NOT rate-limited or Pro-gated at the data
// layer — recall data is public safety information. The Pro upsell is the PUSH
// alert on the client, not access to the data.

interface NormalizedRecall {
  id: string;
  source: 'FDA' | 'USDA';
  product: string;
  reason: string;
  firm: string;
}

const FDA_URL =
  'https://api.fda.gov/food/enforcement.json?search=status:"Ongoing"&limit=50&sort=recall_initiation_date:desc';
const FSIS_URL = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';

// Warm-instance cache so repeated calls (many users, every foreground) don't
// hammer the government APIs. Best-effort; a cold start just refetches.
let cache: { at: number; recalls: NormalizedRecall[] } | null = null;
const CACHE_MS = 60 * 60 * 1000; // 1 hour

Sentry.init({ dsn: Deno.env.get('SENTRY_DSN') });

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadFda(): Promise<NormalizedRecall[]> {
  try {
    const res = await fetchWithTimeout(FDA_URL, {}, 10000);
    if (!res.ok) return [];
    const data = await res.json() as {
      results?: Array<{
        recall_number?: string;
        product_description?: string;
        reason_for_recall?: string;
        recalling_firm?: string;
      }>;
    };
    return (data.results ?? []).map((r, i) => ({
      id: `fda-${str(r.recall_number) || i}`,
      source: 'FDA' as const,
      product: str(r.product_description),
      reason: str(r.reason_for_recall),
      firm: str(r.recalling_firm),
    })).filter(r => r.product);
  } catch (e) {
    console.error('[recalls] FDA fetch failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

async function loadFsis(): Promise<NormalizedRecall[]> {
  try {
    // A browser-like UA + Accept gets past the Akamai bot wall that blocks the
    // raw datacenter request.
    const res = await fetchWithTimeout(FSIS_URL, {
      headers: {
        'User-Agent': 'PantreRecallGuard/1.0 (+https://usepantre.me)',
        'Accept': 'application/json',
      },
    }, 10000);
    if (!res.ok) return [];
    const raw = await res.json() as unknown;
    const list = Array.isArray(raw) ? raw : [];
    const out: NormalizedRecall[] = [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i] as Record<string, unknown>;
      if (!r || typeof r !== 'object') continue;
      // Skip archived / inactive notices when the feed tells us; keep otherwise.
      const active = str(r.field_active_notice).toLowerCase();
      const archived = str(r.field_archive_recall).toLowerCase();
      if (active === 'false' || archived === 'true') continue;

      const title = str(r.field_title);
      const products = stripHtml(str(r.field_product_items));
      const product = stripHtml([title, products].filter(Boolean).join(' — '));
      if (!product) continue;

      const reason = stripHtml(str(r.field_recall_reason) || str(r.field_summary)).slice(0, 300);
      const firm = stripHtml(str(r.field_establishment) || str(r.field_company_media_contact));
      out.push({
        id: `usda-${str(r.field_recall_number) || str(r.field_recall_url) || i}`,
        source: 'USDA',
        product,
        reason,
        firm,
      });
    }
    return out;
  } catch (e) {
    console.error('[recalls] FSIS fetch failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

async function verifyUser(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  return !error && !!data.user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST' && request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!(await verifyUser(request))) {
    return json({ error: 'Please sign in.' }, { status: 401 });
  }

  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return json({ recalls: cache.recalls, cached: true });
    }
    // Both feeds in parallel; either can fail independently without sinking the
    // other (a partial result is still useful).
    const [fda, fsis] = await Promise.all([loadFda(), loadFsis()]);
    const recalls = [...fda, ...fsis];
    cache = { at: Date.now(), recalls };
    return json({ recalls });
  } catch (e) {
    Sentry.captureException(e);
    return json({ error: 'Could not load recalls.' }, { status: 502 });
  }
});
