export interface User {
  id: string;
  name: string;
  householdSize: number;
  dietaryPreferences: DietaryPref[];
  createdAt: string;
  onboardingComplete: boolean;
  streakDays: number;
  lastActiveDate: string;
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

export type Tab = 'pantry' | 'add' | 'cook' | 'impact' | 'lists';

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

export function getFreshnessStatus(expirationDate: string): FreshnessStatus {
  const now = new Date();
  const exp = new Date(expirationDate);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
  const now = new Date();
  const exp = new Date(expirationDate);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
