import * as debug from './debug';

export interface RecallMatch {
  id: string;
  productDescription: string;
  reason: string;
  recallingFirm: string;
  matchedItem: string;
}

interface FdaResult {
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

/**
 * Returns active FDA recalls that match any of the given pantry item names.
 * Matching is word-level and case-insensitive (e.g. "milk" matches "whole milk").
 */
export async function checkPantryForRecalls(itemNames: string[]): Promise<RecallMatch[]> {
  try {
    const recalls = await loadRecalls();
    const matched: RecallMatch[] = [];

    for (const recall of recalls) {
      const recallWords = new Set(
        recall.product_description.toLowerCase().split(/\W+/).filter(w => w.length > 2)
      );
      for (const name of itemNames) {
        const nameWords = name.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        if (nameWords.some(w => recallWords.has(w))) {
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
  } catch (e) {
    debug.warn('[recalls] check failed:', e);
    return [];
  }
}
