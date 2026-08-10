import type { Recipe, DietaryPref } from '../types';

// Ingredients that violate each dietary preference. Terms are stored in their
// SINGULAR form; matching is plural-aware (see blockRegex) so a recipe that
// lists "Eggs" or "Walnuts" is still caught.
export const DIET_BLOCKLIST: Record<string, string[]> = {
  vegetarian: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchovy', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam',
    'mussel', 'halibut', 'trout', 'mahi', 'catfish',
  ],
  vegan: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchovy', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam', 'mussel',
    'halibut', 'trout', 'mahi', 'catfish',
    'egg', 'milk', 'buttermilk', 'butter', 'cream', 'cheese', 'parmesan',
    'mozzarella', 'cheddar', 'feta', 'brie', 'ricotta', 'mascarpone', 'yogurt',
    'honey', 'ghee', 'whey', 'half-and-half', 'sour cream',
  ],
  'gluten-free': [
    'spaghetti', 'pasta', 'flour', 'bread', 'breadcrumb', 'soy sauce',
    'wheat', 'barley', 'rye', 'couscous', 'noodle', 'tortilla', 'pita',
    'crouton', 'panko', 'udon', 'ramen',
  ],
  'dairy-free': [
    'milk', 'buttermilk', 'butter', 'cream', 'cheese', 'parmesan', 'mozzarella',
    'cheddar', 'feta', 'brie', 'ricotta', 'mascarpone', 'yogurt', 'ghee', 'whey',
    'half-and-half', 'sour cream',
  ],
  'nut-free': [
    'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'hazelnut',
    'macadamia', 'pine nut', 'brazil nut',
  ],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The common English plural of a blocklist term, so a singular blocklist entry
// still matches the plural form recipes usually store ("walnut" → "walnuts",
// "anchovy" → "anchovies").
function pluralize(term: string): string {
  if (/[^aeiou]y$/.test(term)) return term.slice(0, -1) + 'ies'; // anchovy → anchovies
  if (/(s|x|z|ch|sh)$/.test(term)) return term + 'es';
  return term + 's';
}

// Whole-word match on the term OR its plural. Whole-word (\b) is essential so
// "egg" doesn't hide eggplant (vegan), "wheat" doesn't hide buckwheat
// (gluten-free), and "ham" doesn't hide graham crackers. Plural-aware so the
// singular blocklist still catches "Eggs" / "Walnuts" / "Anchovies", which is
// how the recipe catalog actually stores them.
function blockRegex(term: string): RegExp {
  const singular = escapeRegex(term);
  const plural = escapeRegex(pluralize(term));
  return new RegExp(`\\b(?:${singular}|${plural})\\b`, 'i');
}

// Plant-based "milk"/"cream"/"butter" phrases are vegan AND dairy-free, yet the
// bare blocklist terms `milk`/`cream`/`butter` match the dairy token inside them
// ("Coconut milk", "Almond milk", "Peanut butter", "Cocoa butter"). Neutralize
// just the trailing dairy word of a plant phrase before the dairy check, while
// LEAVING the qualifier ("almond", "coconut", "peanut", …) intact so that
// nut-free still blocks "almond milk"/"peanut butter" via the `almond`/`peanut`
// terms and so no real dairy term is affected. Longer qualifiers come first so
// alternation prefers "peanut" over "pea" and "sunflower" over "sun".
const PLANT_DAIRY_QUALIFIERS =
  'coconut|peanut|almond|cashew|hazelnut|macadamia|pistachio|sunflower|pumpkin|' +
  'oat|soy|rice|hemp|flax|walnut|quinoa|banana|cocoa|apple|seed|nut|sun|pea';
const PLANT_DAIRY = new RegExp(
  `\\b(${PLANT_DAIRY_QUALIFIERS})[-\\s]+(milk|cream|butter)\\b`,
  'gi',
);

// Foods that merely START with "butter" but contain no dairy — drop the leading
// "butter" so the food word (which no diet blocks) is what remains. "Butternut"
// is already safe because \bbutter\b needs a boundary the fused word denies.
const BUTTER_FOOD = /\bbutter[-\s]+(lettuce|bean|beans)\b/gi;

// "Cream of tartar" is a vegan/dairy-free leavening acid, not a dairy cream.
const CREAM_OF_TARTAR = /\bcream\s+of\s+tartar\b/gi;

// Naturally gluten-free noodles carry the bare blocklist word "noodle" but are
// GF-safe. Drop "noodle", keep the qualifier (rice/glass/… — no diet blocks it).
// Wheat/egg/udon/ramen noodles are NOT listed here, so they stay blocked.
const GF_NOODLE =
  /\b(rice|glass|kelp|shirataki|cellophane|zucchini|sweet potato|mung bean|bean thread) noodles?\b/gi;

function scrubDietFalsePositives(text: string): string {
  // Drop only the dairy/gluten word, keep the qualifier for allergen checks.
  return text
    .replace(BUTTER_FOOD, '$1')
    .replace(CREAM_OF_TARTAR, 'tartar')
    .replace(GF_NOODLE, '$1')
    .replace(PLANT_DAIRY, '$1');
}

function isBlocked(text: string, blocked: string[]): boolean {
  const scrubbed = scrubDietFalsePositives(text);
  return blocked.some(b => blockRegex(b).test(scrubbed));
}

// True if the recipe is safe for every active dietary preference.
export function meetsDiet(recipe: Recipe, diets: DietaryPref[]): boolean {
  const active = diets.filter(d => d !== 'none');
  if (active.length === 0) return true;
  const ingredNames = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  for (const diet of active) {
    if (isBlocked(ingredNames, DIET_BLOCKLIST[diet] ?? [])) return false;
  }
  return true;
}

// True if a single item name is allowed by every active dietary preference —
// used to keep the auto-built shopping list from suggesting a diet violation.
export function nameAllowedByDiet(name: string, diets: DietaryPref[]): boolean {
  const active = diets.filter(d => d !== 'none');
  if (active.length === 0) return true;
  const lower = name.toLowerCase();
  for (const diet of active) {
    if (isBlocked(lower, DIET_BLOCKLIST[diet] ?? [])) return false;
  }
  return true;
}
