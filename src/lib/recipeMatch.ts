import type { PantryItem, Recipe } from '../types';
import { getFreshnessStatus, ingredientMatchesItem } from '../types';

export interface DinnerMatch {
  recipe: Recipe;
  matchCount: number;
  usesExpiring: boolean;
}

/**
 * Picks the single best recipe to cook from what's in the pantry right now —
 * the one matching the most pantry items, preferring recipes that use food
 * which is expiring soon (so cooking it actually rescues something).
 *
 * Shared by the Pantry briefing card and the evening cook-nudge notification so
 * the two never drift apart.
 */
export function bestDinnerForPantry(pantryItems: PantryItem[], recipes: Recipe[]): DinnerMatch | null {
  let best: DinnerMatch | null = null;
  for (const r of recipes) {
    let matchCount = 0;
    let usesExpiring = false;
    for (const ing of r.ingredients) {
      const m = pantryItems.find(p => ingredientMatchesItem(ing.name, p.name));
      if (m) {
        matchCount++;
        const s = getFreshnessStatus(m.expirationDate);
        if (s === 'expiring' || s === 'expiring-soon' || s === 'expired') usesExpiring = true;
      }
    }
    if (matchCount === 0) continue;
    const better =
      !best ||
      (usesExpiring && !best.usesExpiring) ||
      (usesExpiring === best.usesExpiring && matchCount > best.matchCount);
    if (better) best = { recipe: r, matchCount, usesExpiring };
  }
  return best;
}
