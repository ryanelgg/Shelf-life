import * as debug from './debug';

export interface RecallMatch {
  id: string;
  productDescription: string;
  reason: string;
  recallingFirm: string;
  matchedItem: string;
}

export interface FdaResult {
  recall_number: string;
  product_description: string;
  reason_for_recall: string;
  recalling_firm: string;
  status: string;
}

// Module-level cache — avoids hammering the FDA API on every render
let cachedResults: FdaResult[] | null = null;
let cacheTs = 0;
const CACHE_MS = 60 * 60 * 1000; // 1 hour

async function loadRecalls(): Promise<FdaResult[]> {
  if (cachedResults && Date.now() - cacheTs < CACHE_MS) return cachedResults;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      'https://api.fda.gov/food/enforcement.json?search=status:"Ongoing"&limit=50&sort=recall_initiation_date:desc',
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error(`FDA API ${res.status}`);
    const data = await res.json() as { results: FdaResult[] };
    cachedResults = data.results ?? [];
    cacheTs = Date.now();
    return cachedResults;
  } finally {
    window.clearTimeout(timer);
  }
}

// Generic food/packaging words that are far too common to be a safe signal on
// their own — a lone "milk" or "chicken" overlap would light up unrelated
// recalls. A single one of these never triggers a match; a *distinctive* word
// (e.g. "spinach", "cantaloupe", a brand) does, and two generic words together
// (e.g. "almond milk" ∩ "almond milk") do too.
const GENERIC_FOOD_WORDS = new Set([
  'food', 'foods', 'fresh', 'frozen', 'organic', 'natural', 'raw', 'whole',
  'low', 'fat', 'free', 'lite', 'light', 'original', 'classic', 'style',
  'flavor', 'flavored', 'brand', 'value', 'pack', 'family', 'size',
  'can', 'canned', 'jar', 'jarred', 'bottle', 'bottled', 'box', 'boxed', 'bag', 'bagged',
  'milk', 'bread', 'cheese', 'meat', 'chicken', 'beef', 'pork', 'fish',
  'egg', 'fruit', 'vegetable', 'produce', 'juice', 'water', 'rice', 'oil',
  'cream', 'butter', 'yogurt', 'snack', 'drink', 'sauce', 'mix',
]);

/** Conservative English plural fold so "bananas" and "banana" match. */
function foldPlural(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function significantWords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2).map(foldPlural);
}

/**
 * Pure matcher (network-free, unit-tested): return recalls that plausibly match
 * a pantry item. A match needs a *specific* signal, not a single generic word:
 *   • at least one shared distinctive (non-generic) word, OR
 *   • at least two shared words overall.
 */
export function matchRecalls(recalls: FdaResult[], itemNames: string[]): RecallMatch[] {
  const matched: RecallMatch[] = [];
  for (const recall of recalls) {
    const recallWords = new Set(significantWords(recall.product_description));
    for (const name of itemNames) {
      const itemWords = significantWords(name);
      const overlap = itemWords.filter(w => recallWords.has(w));
      const distinctive = overlap.filter(w => !GENERIC_FOOD_WORDS.has(w));
      if (distinctive.length >= 1 || overlap.length >= 2) {
        matched.push({
          id: recall.recall_number,
          productDescription: recall.product_description,
          reason: recall.reason_for_recall,
          recallingFirm: recall.recalling_firm,
          matchedItem: name,
        });
        break; // one match per recall is enough
      }
    }
  }
  return matched;
}

/**
 * Returns active FDA recalls that plausibly match any of the given pantry item
 * names. Matching is tightened to avoid false "FDA Recall" alerts on generic
 * staples (see matchRecalls).
 */
export async function checkPantryForRecalls(itemNames: string[]): Promise<RecallMatch[]> {
  try {
    const recalls = await loadRecalls();
    return matchRecalls(recalls, itemNames);
  } catch (e) {
    debug.warn('[recalls] check failed:', e);
    return [];
  }
}
