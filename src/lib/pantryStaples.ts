// Ingredients assumed to be always on hand. They must never land on an
// auto-built shopping list, where "Salt" or "Water" reads as the feature being
// broken (nobody adds those to a grocery run from a recipe).
//
// Deliberately CONSERVATIVE: only cheap, ubiquitous seasonings/water that every
// kitchen has and that you essentially never buy per-recipe. Items people
// genuinely DO run out of — oil, sugar, flour, butter — are intentionally left
// OFF this list, so a real gap still gets surfaced. The cost of a rare "you're
// out of oil" reminder is smaller than the cost of silently not warning someone
// who actually is.
export const PANTRY_STAPLES: ReadonlySet<string> = new Set([
  'salt',
  'water',
  'pepper',
  'black pepper',
  'ice',
  'cooking spray',
]);

// True when an ingredient name is a pantry staple we assume is always stocked.
// Matches on the WHOLE normalized name (trim + lowercase), NOT a substring, so
// real produce like "Bell pepper" or "Red pepper flakes" is never mistaken for
// the bare "pepper" staple.
export function isPantryStaple(name: string): boolean {
  return PANTRY_STAPLES.has(name.trim().toLowerCase());
}
