export type SubscriptionTier = 'free' | 'pro';

export const FREE_LIMITS = {
  pantryItems: 20,
  avoChatTotal: 5,     // free users (after any trial): 5 chats forever
  proChatPerDay: 20,   // pro users AND active-trial users: 20 chats per day
  avoTrialDays: 7,     // new users get 7 days of Pro-level Avo access
} as const;

export type AuthProvider = 'apple' | 'google' | 'email' | 'guest';

export interface User {
  id: string;
  name: string;
  email?: string;
  authProvider: AuthProvider;
  dietaryPreferences: DietaryPref[];
  createdAt: string;
  onboardingComplete: boolean;
  streakDays: number;
  lastActiveDate: string;
  subscriptionTier: SubscriptionTier;
  // Daily Avo counter — used by Pro users AND users in their active trial.
  avoChatCount: number;
  avoChatResetDate: string;
  // 7-day Avo trial: the date it started (YYYY-MM-DD), or null if not started.
  avoTrialStartedAt: string | null;
  // Lifetime free-tier Avo allotment, counted only AFTER the trial ends. Kept
  // separate from avoChatCount so a Pro→free or trial→free transition can't
  // lock the user out with a stale daily count.
  avoFreeChatsUsed: number;
}

/** Days remaining in the Avo trial (0 if never started or expired). */
export function avoTrialDaysLeft(
  u: { avoTrialStartedAt: string | null },
  now: Date = new Date(),
): number {
  if (!u.avoTrialStartedAt) return 0;
  const start = parseLocalDate(u.avoTrialStartedAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, FREE_LIMITS.avoTrialDays - elapsed);
}

/** True while the user is inside their 7-day Avo trial window. */
export function isAvoTrialActive(
  u: { avoTrialStartedAt: string | null },
  now: Date = new Date(),
): boolean {
  return avoTrialDaysLeft(u, now) > 0;
}

export type ThemeMode = 'dark' | 'light';

export type DietaryPref = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'nut-free' | 'none';

export type FoodCategory =
  | 'Produce'
  | 'Dairy'
  | 'Meat'
  | 'Seafood'
  | 'Grains'
  | 'Frozen'
  | 'Canned'
  | 'Snacks'
  | 'Beverages'
  | 'Condiments'
  | 'Bakery'
  | 'Deli'
  | 'Other';

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';

export type FreshnessStatus = 'fresh' | 'good' | 'expiring-soon' | 'expiring' | 'expired';

// AB 660-aligned date semantics. "Use by" = a safety date (don't eat after);
// "Best if used by" = a quality date (fine after, just degraded). Stored
// per-item; optional so items created before this field fall back to the
// category default via resolveDateType().
export type DateLabelType = 'use-by' | 'best-by';

// ── Household sharing (Pro feature, up to 4 members) ─────────────────────────
export type HouseholdRole = 'owner' | 'member';

export const HOUSEHOLD_MAX_MEMBERS = 4;

export interface Household {
  id: string;
  inviteCode: string;
  ownerId: string;
  role: HouseholdRole;
}

export interface HouseholdMember {
  userId: string;
  name: string | null;
  role: HouseholdRole;
}

export interface PantryItem {
  id: string;
  name: string;
  category: FoodCategory;
  location: StorageLocation;
  quantity: number;
  unit: string;
  addedDate: string;
  expirationDate: string;
  estimatedValue: number;
  notes?: string;
  frozen?: boolean;
  dateType?: DateLabelType;
}

export type WasteAction = 'eaten' | 'tossed' | 'composted' | 'donated' | 'shared';

export interface WasteLog {
  id: string;
  itemName: string;
  category: FoodCategory;
  action: WasteAction;
  date: string;
  estimatedValue: number;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  matchedItemIds: string[];
  missingIngredients: string[];
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  ingredients: { name: string; amount: string; fromPantry: boolean }[];
  steps: string[];
  savingsEstimate: number;
  tags: string[];
  image?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: FoodCategory;
  quantity: number;
  unit: string;
  checked: boolean;
  fromRecipe?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingItem[];
  createdDate: string;
}

export type Tab = 'pantry' | 'add' | 'cook' | 'impact' | 'plan';

export interface MealPlanDay {
  day: string;
  meal: string;
  pantryItems: number;
  toBuy: number;
  recipeId?: string;
}

export const FOOD_EMOJI: Record<FoodCategory, string> = {
  Produce: '🥬',
  Dairy: '🧀',
  Meat: '🥩',
  Seafood: '🐟',
  Grains: '🌾',
  Frozen: '🧊',
  Canned: '🥫',
  Snacks: '🍿',
  Beverages: '🥤',
  Condiments: '🫙',
  Bakery: '🍞',
  Deli: '🥪',
  Other: '📦',
};

export const LOCATION_EMOJI: Record<StorageLocation, string> = {
  fridge: '❄️',
  freezer: '🧊',
  pantry: '🏠',
  counter: '🍎',
};

export const AVOCADO_TIPS: string[] = [
  "Store bananas away from other fruits — they release ethylene gas that speeds ripening!",
  "Wrap celery in aluminum foil to keep it crispy for weeks!",
  "Freeze herbs in olive oil using ice cube trays — instant flavor bombs!",
  "Store tomatoes stem-side down to keep them fresh longer.",
  "Put a paper towel in your salad container to absorb excess moisture.",
  "Store mushrooms in a paper bag, never plastic. They need to breathe!",
  "Revive wilted greens by soaking them in ice water for 15 minutes.",
  "Keep ginger in the freezer — it grates even easier when frozen!",
  "Wrap cheese in wax paper, then plastic wrap. It needs to breathe a little.",
  "Store asparagus like flowers — stems in a glass of water in the fridge!",
  "Ripe avocados last longer in the fridge. Only ripen them on the counter!",
  "Bread freezes beautifully! Slice before freezing for easy single servings.",
  "Pickle it! Almost any veggie can become a quick pickle with vinegar and salt.",
  "First in, first out — put newer items behind older ones in the fridge.",
  "Plan your meals for the week before you shop. You'll waste 40% less food!",
  "Leftover rice? Fried rice is one of the best anti-waste meals ever!",
  "Overripe bananas make the best banana bread. Freeze them until you're ready!",
  "Broccoli stems are edible and delicious — peel and slice them for stir-fry!",
  "Vegetable scraps make amazing stock. Save them in a freezer bag!",
  "You're doing great! Every item saved from the bin is a little victory!",
  "The average family throws away $1,600 of food per year. You're beating that!",
  "Composting turns waste into garden gold. Even small efforts count!",
  "Check your fridge temperature: 37°F (3°C) is the sweet spot!",
  "Most 'best by' dates are about quality, not safety. Trust your senses!",
  "Stale bread? Make croutons, breadcrumbs, or French toast!",
  "Soft berries blend perfectly into smoothies — don't toss them!",
  "Citrus zest adds incredible flavor. Zest before juicing and freeze the rest!",
  "Limp carrots? Soak them in cold water for an hour — they'll crisp right up!",
  "Regrow green onions in a jar of water on your windowsill!",
  "Freeze overripe fruit for smoothies — tastes even better frozen!",
];

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function getFreshnessStatus(expirationDate: string): FreshnessStatus {
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const exp = parseLocalDate(expirationDate);
  const daysLeft = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 1) return 'expiring';
  if (daysLeft <= 3) return 'expiring-soon';
  if (daysLeft <= 7) return 'good';
  return 'fresh';
}

export function getFreshnessColor(status: FreshnessStatus): string {
  switch (status) {
    case 'fresh': return 'var(--fresh)';
    case 'good': return 'var(--good)';
    case 'expiring-soon': return 'var(--expiring-soon)';
    case 'expiring': return 'var(--expiring)';
    case 'expired': return 'var(--expired)';
  }
}

export function getDaysUntilExpiration(expirationDate: string): number {
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const exp = parseLocalDate(expirationDate);
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Fold a simple English plural to its singular form so "eggs" matches "egg"
// and "tomatoes" matches "tomato". Intentionally conservative.
function foldPlural(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function ingredientWords(name: string): string[] {
  return name.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(foldPlural);
}

// Word-level matcher between a recipe ingredient name and a pantry item name.
// Replaces loose substring matching (which made "egg" match "eggplant" and
// "milk" match "buttermilk"). A match means one name's words are fully
// contained in the other's — so "egg" ↔ "free-range eggs" and
// "chicken" ↔ "chicken breast" still match, but unrelated words don't.
export function ingredientMatchesItem(ingredientName: string, itemName: string): boolean {
  const ing = ingredientWords(ingredientName);
  const item = ingredientWords(itemName);
  if (ing.length === 0 || item.length === 0) return false;
  const ingSet = new Set(ing);
  const itemSet = new Set(item);
  return ing.every(w => itemSet.has(w)) || item.every(w => ingSet.has(w));
}

export const DEFAULT_SHELF_LIFE: Record<FoodCategory, number> = {
  Produce: 7,
  Dairy: 14,
  Meat: 5,
  Seafood: 3,
  Grains: 180,
  Frozen: 90,
  Canned: 365,
  Snacks: 60,
  Beverages: 30,
  Condiments: 180,
  Bakery: 5,
  Deli: 5,
  Other: 30,
};

// Safety-first defaults: animal/prepared products that pose a real safety
// risk past their date default to "Use by"; everything else is a quality
// ("Best if used by") date. Users can override per item.
export const DEFAULT_DATE_TYPE: Record<FoodCategory, DateLabelType> = {
  Produce: 'best-by',
  Dairy: 'use-by',
  Meat: 'use-by',
  Seafood: 'use-by',
  Grains: 'best-by',
  Frozen: 'best-by',
  Canned: 'best-by',
  Snacks: 'best-by',
  Beverages: 'best-by',
  Condiments: 'best-by',
  Bakery: 'best-by',
  Deli: 'use-by',
  Other: 'best-by',
};

export function getDefaultDateType(category: FoodCategory): DateLabelType {
  return DEFAULT_DATE_TYPE[category];
}

/** An item's date type, defaulting from its category when unset (older items). */
export function resolveDateType(item: { dateType?: DateLabelType; category: FoodCategory }): DateLabelType {
  return item.dateType ?? getDefaultDateType(item.category);
}

/** Full AB 660 phrasing for prominent display. */
export function dateTypeLabel(t: DateLabelType): string {
  return t === 'use-by' ? 'Use by' : 'Best if used by';
}

/** Compact phrasing for tight list rows. */
export function dateTypeShortLabel(t: DateLabelType): string {
  return t === 'use-by' ? 'Use by' : 'Best by';
}
