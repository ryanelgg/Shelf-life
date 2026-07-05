import * as debug from './debug';
import { getAiAuthHeaders, NotSignedInError } from './authHeaders';

export interface RecallMatch {
  id: string;
  productDescription: string;
  reason: string;
  recallingFirm: string;
  matchedItem: string;
  source: 'FDA' | 'USDA';
}

// Normalized recall shape shared by both feeds. The `recalls` edge function
// returns this directly (FDA + USDA); the direct-FDA fallback maps into it.
export interface NormalizedRecall {
  id: string;
  source: 'FDA' | 'USDA';
  product: string;
  reason: string;
  firm: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const recallsFnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/recalls`;

const FDA_DIRECT_URL =
  'https://api.fda.gov/food/enforcement.json?search=status:"Ongoing"&limit=50&sort=recall_initiation_date:desc';

// Module-level cache — avoids hammering the feeds on every render/foreground.
let cachedResults: NormalizedRecall[] | null = null;
let cacheTs = 0;
const CACHE_MS = 60 * 60 * 1000; // 1 hour

// Ultra-generic words that shouldn't, on their own, trigger a scary recall
// banner. Matching on "oil" alone flagged "corn oil" / "olive oil" against any
// oil recall (the classic false positive). A real match needs a more specific
// shared word than these.
const STOPWORDS = new Set([
  'oil', 'raw', 'red', 'hot', 'mix', 'fat', 'low', 'new', 'the', 'and', 'with',
  'for', 'flavored', 'flavor', 'style', 'frozen', 'fresh', 'organic', 'natural',
  'brand', 'original', 'classic', 'family', 'size', 'pack', 'value', 'great',
  'food', 'foods', 'product', 'products', 'assorted', 'variety', 'blend',
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

/**
 * Pure matcher — pantry item names against a normalized recall list. Exported so
 * the (false-positive-prone) matching logic is unit-testable without network.
 * A recall matches an item when they share a "significant" word (>3 chars, not a
 * generic descriptor). Returns at most one match per recall.
 */
export function matchRecalls(itemNames: string[], recalls: NormalizedRecall[]): RecallMatch[] {
  const matched: RecallMatch[] = [];
  const itemWords = itemNames.map(name => ({ name, words: significantWords(name) }));

  for (const recall of recalls) {
    const recallWords = new Set(significantWords(recall.product));
    if (recallWords.size === 0) continue;
    for (const item of itemWords) {
      if (item.words.some(w => recallWords.has(w))) {
        matched.push({
          id: recall.id,
          productDescription: recall.product,
          reason: recall.reason,
          recallingFirm: recall.firm,
          matchedItem: item.name,
          source: recall.source,
        });
        break; // one match per recall is enough
      }
    }
  }
  return matched;
}

async function loadFromFunction(): Promise<NormalizedRecall[] | null> {
  // Dev has no deployed function; use the direct FDA fallback there.
  if (import.meta.env.DEV) return null;
  let headers: Record<string, string>;
  try {
    headers = await getAiAuthHeaders(supabaseAnonKey);
  } catch (e) {
    // Not signed in — fall back to the public FDA feed for the in-app banner.
    if (e instanceof NotSignedInError) return null;
    throw e;
  }
  const res = await fetch(recallsFnUrl, { method: 'POST', headers });
  if (!res.ok) return null;
  const data = await res.json() as { recalls?: NormalizedRecall[] };
  return Array.isArray(data.recalls) ? data.recalls : null;
}

async function loadDirectFda(): Promise<NormalizedRecall[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(FDA_DIRECT_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`FDA API ${res.status}`);
    const data = await res.json() as {
      results?: Array<{
        recall_number?: string;
        product_description?: string;
        reason_for_recall?: string;
        recalling_firm?: string;
      }>;
    };
    return (data.results ?? []).map((r, i) => ({
      id: `fda-${r.recall_number ?? i}`,
      source: 'FDA' as const,
      product: r.product_description ?? '',
      reason: r.reason_for_recall ?? '',
      firm: r.recalling_firm ?? '',
    })).filter(r => r.product);
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadRecalls(): Promise<NormalizedRecall[]> {
  if (cachedResults && Date.now() - cacheTs < CACHE_MS) return cachedResults;

  let recalls: NormalizedRecall[] | null = null;
  try {
    recalls = await loadFromFunction();
  } catch (e) {
    debug.warn('[recalls] dual-feed function failed, falling back to FDA:', e);
  }
  if (!recalls) recalls = await loadDirectFda();

  cachedResults = recalls;
  cacheTs = Date.now();
  return recalls;
}

/**
 * Returns active recalls (FDA + USDA when available) that match any of the given
 * pantry item names. Best-effort: returns [] on any failure.
 */
export async function checkPantryForRecalls(itemNames: string[]): Promise<RecallMatch[]> {
  try {
    const recalls = await loadRecalls();
    return matchRecalls(itemNames, recalls);
  } catch (e) {
    debug.warn('[recalls] check failed:', e);
    return [];
  }
}
