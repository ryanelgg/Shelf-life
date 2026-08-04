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
    'egg', 'milk', 'buttermilk', 'butter', 'cream', 'cheese', 'parmesan',
    'mozzarella', 'cheddar', 'feta', 'ricotta', 'yogurt', 'honey', 'ghee', 'whey',
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

// Plant-based "milk"/"cream" phrases are vegan AND dairy-free, yet the bare
// blocklist terms `milk`/`cream` match the "milk"/"cream" token inside them
// ("Coconut milk", "Almond milk", "Oat milk", "Coconut cream"). Neutralize just
// the trailing "milk"/"cream" word of a plant phrase before the dairy check,
// while LEAVING the qualifier ("almond", "coconut", …) intact so that nut-free
// still blocks "almond milk"/"cashew cream" via the `almond`/`cashew` terms and
// so no real dairy term is affected.
const PLANT_MILK_QUALIFIERS =
  'coconut|almond|oat|soy|rice|cashew|hazelnut|macadamia|hemp|flax|pea|walnut|pistachio|quinoa|banana';
const PLANT_MILK_CREAM = new RegExp(
  `\\b(${PLANT_MILK_QUALIFIERS})\\s+(milk|cream)\\b`,
  'gi',
);

// Non-dairy uses of "butter" that the bare `butter` term wrongly matches:
// nut/seed butters (peanut, almond, cashew…), fruit/plant butters (apple, cocoa,
// coconut), and "butter" as an adjective ("butter lettuce", "butter beans").
// Keep the qualifier so nut-free still blocks "almond butter"/"peanut butter"
// via the nut terms; genuine dairy "butter" (unqualified) is left untouched.
const NON_DAIRY_BUTTER_QUALIFIERS =
  'peanut|almond|cashew|hazelnut|macadamia|pistachio|walnut|pecan|sunflower|sesame|soy|apple|cocoa|coconut';
const NON_DAIRY_BUTTER = new RegExp(
  `\\b(${NON_DAIRY_BUTTER_QUALIFIERS})\\s+butter\\b`,
  'gi',
);
const BUTTER_ADJECTIVE = /\bbutter\s+(lettuce|beans?)\b/gi;
// "cream of tartar" is a leavening acid, not dairy cream.
const CREAM_OF_TARTAR = /\bcream\s+of\s+tartar\b/gi;

// Naturally gluten-free noodles the bare `noodle` term wrongly hides from
// gluten-free users. Keep the qualifier; wheat noodles/udon/ramen stay blocked.
const GF_NOODLES = /\b(rice|glass|kelp|shirataki|mung bean|sweet potato)\s+noodles?\b/gi;

function scrubPlantDairy(text: string): string {
  // Drop only the dairy-sounding word, keep the qualifier for allergen checks.
  return text
    .replace(PLANT_MILK_CREAM, '$1')
    .replace(NON_DAIRY_BUTTER, '$1')
    .replace(BUTTER_ADJECTIVE, '$1')
    .replace(CREAM_OF_TARTAR, 'tartar')
    .replace(GF_NOODLES, '$1');
}

function isBlocked(text: string, blocked: string[]): boolean {
  const scrubbed = scrubPlantDairy(text);
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
