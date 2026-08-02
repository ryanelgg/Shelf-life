import type { Recipe, DietaryPref } from '../types';

// Ingredients that violate each dietary preference. Terms are stored in their
// SINGULAR form; matching is plural-aware (see blockRegex) so a recipe that
// lists "Eggs" or "Walnuts" is still caught.
export const DIET_BLOCKLIST: Record<string, string[]> = {
  vegetarian: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchovy', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam',
    'mussels', 'halibut', 'trout', 'mahi', 'catfish',
  ],
  vegan: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchovy', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam',
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
    'cheddar', 'brie', 'feta', 'ricotta', 'mascarpone', 'yogurt', 'ghee', 'whey',
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

// Plant-based "milk"/"cream" (coconut milk, almond milk, oat milk, coconut
// cream, …) are vegan AND dairy-free, but the bare 'milk'/'cream' blocklist
// terms would otherwise match the "milk"/"cream" token inside them and wrongly
// hide vegan-tagged recipes. We blank out just that trailing token, leaving the
// plant qualifier intact so nut-free still blocks "almond milk" via 'almond'.
const PLANT_MILK_PHRASE =
  /\b(coconut|almond|oat|soy|soya|rice|cashew|hemp|pea|flax|macadamia|hazelnut|walnut|sunflower|pistachio)\s+(?:milk|cream)\b/gi;

function scrubPlantMilks(text: string): string {
  return text.replace(PLANT_MILK_PHRASE, '$1 plantbev');
}

function isBlocked(text: string, blocked: string[]): boolean {
  const scrubbed = scrubPlantMilks(text);
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
