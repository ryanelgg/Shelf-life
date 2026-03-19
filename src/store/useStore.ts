import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, PantryItem, WasteLog, Recipe, ShoppingList, Tab, ThemeMode } from '../types';

interface ShelfLifeStore {
  // State
  user: User | null;
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
  recipes: Recipe[];
  shoppingLists: ShoppingList[];
  activeTab: Tab;
  theme: ThemeMode;
  showSettings: boolean;
  avocadoTipIndex: number;

  // User
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  resetOnboarding: () => void;

  // Pantry
  addPantryItem: (item: PantryItem) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  removePantryItem: (id: string) => void;
  clearPantry: () => void;

  // Waste
  addWasteLog: (log: WasteLog) => void;

  // Recipes
  setRecipes: (recipes: Recipe[]) => void;

  // Shopping
  addShoppingList: (list: ShoppingList) => void;
  updateShoppingList: (id: string, updates: Partial<ShoppingList>) => void;
  removeShoppingList: (id: string) => void;
  toggleShoppingItem: (listId: string, itemId: string) => void;

  // UI
  setActiveTab: (tab: Tab) => void;
  setTheme: (theme: ThemeMode) => void;
  setShowSettings: (show: boolean) => void;
  nextAvocadoTip: () => void;
}

// Sample pantry data for demo
const SAMPLE_PANTRY: PantryItem[] = [
  {
    id: '1', name: 'Spinach', category: 'Produce', location: 'fridge',
    quantity: 1, unit: 'bag', addedDate: daysAgo(3), expirationDate: daysFromNow(2), estimatedValue: 3.49,
  },
  {
    id: '2', name: 'Chicken Breast', category: 'Meat', location: 'fridge',
    quantity: 2, unit: 'lbs', addedDate: daysAgo(2), expirationDate: daysFromNow(3), estimatedValue: 8.99,
  },
  {
    id: '3', name: 'Greek Yogurt', category: 'Dairy', location: 'fridge',
    quantity: 1, unit: 'tub', addedDate: daysAgo(5), expirationDate: daysFromNow(9), estimatedValue: 5.49,
  },
  {
    id: '4', name: 'Avocados', category: 'Produce', location: 'counter',
    quantity: 3, unit: 'pcs', addedDate: daysAgo(4), expirationDate: daysFromNow(1), estimatedValue: 4.50,
  },
  {
    id: '5', name: 'Sourdough Bread', category: 'Bakery', location: 'counter',
    quantity: 1, unit: 'loaf', addedDate: daysAgo(3), expirationDate: daysFromNow(2), estimatedValue: 5.99,
  },
  {
    id: '6', name: 'Salmon Fillet', category: 'Seafood', location: 'fridge',
    quantity: 1, unit: 'lb', addedDate: daysAgo(1), expirationDate: daysFromNow(2), estimatedValue: 12.99,
  },
  {
    id: '7', name: 'Milk', category: 'Dairy', location: 'fridge',
    quantity: 1, unit: 'gal', addedDate: daysAgo(4), expirationDate: daysFromNow(6), estimatedValue: 4.29,
  },
  {
    id: '8', name: 'Pasta', category: 'Grains', location: 'pantry',
    quantity: 2, unit: 'box', addedDate: daysAgo(30), expirationDate: daysFromNow(180), estimatedValue: 2.98,
  },
  {
    id: '9', name: 'Tomatoes', category: 'Produce', location: 'counter',
    quantity: 4, unit: 'pcs', addedDate: daysAgo(3), expirationDate: daysFromNow(4), estimatedValue: 3.20,
  },
  {
    id: '10', name: 'Cheddar Cheese', category: 'Dairy', location: 'fridge',
    quantity: 1, unit: 'block', addedDate: daysAgo(7), expirationDate: daysFromNow(21), estimatedValue: 4.99,
  },
  {
    id: '11', name: 'Frozen Berries', category: 'Frozen', location: 'freezer',
    quantity: 1, unit: 'bag', addedDate: daysAgo(14), expirationDate: daysFromNow(76), estimatedValue: 4.99,
  },
  {
    id: '12', name: 'Eggs', category: 'Dairy', location: 'fridge',
    quantity: 12, unit: 'pcs', addedDate: daysAgo(5), expirationDate: daysFromNow(16), estimatedValue: 3.99,
  },
  {
    id: '13', name: 'Bell Peppers', category: 'Produce', location: 'fridge',
    quantity: 3, unit: 'pcs', addedDate: daysAgo(4), expirationDate: daysFromNow(3), estimatedValue: 3.50,
  },
  {
    id: '14', name: 'Rice', category: 'Grains', location: 'pantry',
    quantity: 1, unit: 'bag', addedDate: daysAgo(60), expirationDate: daysFromNow(300), estimatedValue: 3.49,
  },
  {
    id: '15', name: 'Bananas', category: 'Produce', location: 'counter',
    quantity: 5, unit: 'pcs', addedDate: daysAgo(3), expirationDate: daysFromNow(2), estimatedValue: 1.50,
  },
];

const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'r1',
    name: 'Avocado Toast with Egg',
    description: 'Creamy avocado on toasted sourdough with a fried egg. Perfect for using up expiring bread and avocados.',
    matchedItemIds: ['4', '5', '12'],
    missingIngredients: [],
    cookTime: 10,
    difficulty: 'easy',
    servings: 2,
    ingredients: [
      { name: 'Avocado', amount: '1 ripe', fromPantry: true },
      { name: 'Sourdough Bread', amount: '2 slices', fromPantry: true },
      { name: 'Eggs', amount: '2', fromPantry: true },
      { name: 'Salt & Pepper', amount: 'to taste', fromPantry: false },
      { name: 'Red pepper flakes', amount: 'pinch', fromPantry: false },
    ],
    steps: [
      'Toast the sourdough bread until golden and crispy.',
      'While bread toasts, halve the avocado, remove pit, and mash in a bowl with salt and pepper.',
      'Fry eggs in a non-stick pan to your liking (sunny-side up recommended).',
      'Spread mashed avocado generously on toast.',
      'Top with fried egg, red pepper flakes, and extra salt.',
    ],
    savingsEstimate: 10.49,
    tags: ['breakfast', 'quick', 'vegetarian'],
  },
  {
    id: 'r2',
    name: 'Chicken & Spinach Pasta',
    description: 'Hearty pasta with seared chicken and wilted spinach in a light garlic sauce.',
    matchedItemIds: ['1', '2', '8'],
    missingIngredients: ['garlic', 'olive oil'],
    cookTime: 25,
    difficulty: 'easy',
    servings: 4,
    ingredients: [
      { name: 'Chicken Breast', amount: '2 lbs', fromPantry: true },
      { name: 'Spinach', amount: '1 bag', fromPantry: true },
      { name: 'Pasta', amount: '1 box', fromPantry: true },
      { name: 'Garlic', amount: '4 cloves', fromPantry: false },
      { name: 'Olive oil', amount: '2 tbsp', fromPantry: false },
      { name: 'Parmesan', amount: '1/4 cup', fromPantry: false },
    ],
    steps: [
      'Cook pasta according to package directions. Reserve 1 cup pasta water.',
      'Season chicken with salt & pepper. Sear in olive oil 6 min per side. Slice.',
      'In same pan, sauté garlic 30 seconds, add spinach, wilt 2 minutes.',
      'Toss pasta with spinach, chicken, and splash of pasta water.',
      'Top with parmesan and serve immediately.',
    ],
    savingsEstimate: 15.47,
    tags: ['dinner', 'high-protein', 'filling'],
  },
  {
    id: 'r3',
    name: 'Salmon & Bell Pepper Bowl',
    description: 'Pan-seared salmon over rice with roasted bell peppers — colorful and nutritious.',
    matchedItemIds: ['6', '13', '14'],
    missingIngredients: ['soy sauce', 'sesame oil'],
    cookTime: 30,
    difficulty: 'medium',
    servings: 2,
    ingredients: [
      { name: 'Salmon Fillet', amount: '1 lb', fromPantry: true },
      { name: 'Bell Peppers', amount: '3 pcs', fromPantry: true },
      { name: 'Rice', amount: '1 cup', fromPantry: true },
      { name: 'Soy sauce', amount: '2 tbsp', fromPantry: false },
      { name: 'Sesame oil', amount: '1 tsp', fromPantry: false },
    ],
    steps: [
      'Cook rice according to package directions.',
      'Slice bell peppers, toss with oil, roast at 400°F for 15 minutes.',
      'Season salmon with salt & pepper. Pan-sear skin-side down 4 min, flip, cook 3 more.',
      'Drizzle soy sauce and sesame oil over rice.',
      'Assemble bowls: rice, roasted peppers, flaked salmon.',
    ],
    savingsEstimate: 19.99,
    tags: ['dinner', 'healthy', 'omega-3'],
  },
  {
    id: 'r4',
    name: 'Banana Berry Smoothie',
    description: 'Quick smoothie using ripe bananas and frozen berries. Perfect for overripe bananas!',
    matchedItemIds: ['15', '11', '7'],
    missingIngredients: ['honey'],
    cookTime: 5,
    difficulty: 'easy',
    servings: 2,
    ingredients: [
      { name: 'Bananas', amount: '2 ripe', fromPantry: true },
      { name: 'Frozen Berries', amount: '1 cup', fromPantry: true },
      { name: 'Milk', amount: '1 cup', fromPantry: true },
      { name: 'Honey', amount: '1 tbsp', fromPantry: false },
    ],
    steps: [
      'Peel bananas and break into chunks.',
      'Add bananas, frozen berries, milk, and honey to blender.',
      'Blend on high for 60 seconds until smooth.',
      'Pour into glasses and enjoy immediately.',
    ],
    savingsEstimate: 6.49,
    tags: ['breakfast', 'quick', 'healthy', 'vegetarian'],
  },
  {
    id: 'r5',
    name: 'Tomato & Cheese Quesadilla',
    description: 'Crispy quesadillas with fresh tomatoes and melted cheddar. Ready in 10 minutes.',
    matchedItemIds: ['9', '10'],
    missingIngredients: ['tortillas', 'butter'],
    cookTime: 10,
    difficulty: 'easy',
    servings: 2,
    ingredients: [
      { name: 'Tomatoes', amount: '2 pcs', fromPantry: true },
      { name: 'Cheddar Cheese', amount: '1/2 block', fromPantry: true },
      { name: 'Flour tortillas', amount: '4', fromPantry: false },
      { name: 'Butter', amount: '1 tbsp', fromPantry: false },
    ],
    steps: [
      'Slice tomatoes thin. Grate cheddar cheese.',
      'Layer cheese and tomato slices on half of each tortilla.',
      'Fold tortillas in half.',
      'Melt butter in a pan over medium heat. Cook quesadillas 2-3 min per side until golden.',
      'Slice into wedges and serve with salsa if desired.',
    ],
    savingsEstimate: 8.19,
    tags: ['lunch', 'quick', 'vegetarian', 'kid-friendly'],
  },
  {
    id: 'r6',
    name: 'Greek Yogurt Parfait',
    description: 'Layered yogurt with frozen berries and granola. A healthy breakfast or snack.',
    matchedItemIds: ['3', '11'],
    missingIngredients: ['granola', 'honey'],
    cookTime: 5,
    difficulty: 'easy',
    servings: 2,
    ingredients: [
      { name: 'Greek Yogurt', amount: '1 cup', fromPantry: true },
      { name: 'Frozen Berries', amount: '1/2 cup', fromPantry: true },
      { name: 'Granola', amount: '1/4 cup', fromPantry: false },
      { name: 'Honey', amount: 'drizzle', fromPantry: false },
    ],
    steps: [
      'Thaw berries slightly (microwave 20 seconds or let sit 5 min).',
      'Layer yogurt in a glass or bowl.',
      'Add a layer of berries, then more yogurt.',
      'Top with granola and a drizzle of honey.',
    ],
    savingsEstimate: 5.49,
    tags: ['breakfast', 'snack', 'healthy', 'vegetarian'],
  },
];

const SAMPLE_WASTE: WasteLog[] = [
  { id: 'w1', itemName: 'Lettuce', category: 'Produce', action: 'composted', date: daysAgo(2), estimatedValue: 2.99, quantity: 1 },
  { id: 'w2', itemName: 'Chicken Thighs', category: 'Meat', action: 'eaten', date: daysAgo(3), estimatedValue: 7.49, quantity: 1 },
  { id: 'w3', itemName: 'Yogurt', category: 'Dairy', action: 'eaten', date: daysAgo(1), estimatedValue: 1.29, quantity: 1 },
  { id: 'w4', itemName: 'Bread', category: 'Bakery', action: 'eaten', date: daysAgo(4), estimatedValue: 4.49, quantity: 1 },
  { id: 'w5', itemName: 'Strawberries', category: 'Produce', action: 'tossed', date: daysAgo(5), estimatedValue: 4.99, quantity: 1 },
  { id: 'w6', itemName: 'Apples', category: 'Produce', action: 'eaten', date: daysAgo(2), estimatedValue: 3.99, quantity: 3 },
  { id: 'w7', itemName: 'Celery', category: 'Produce', action: 'donated', date: daysAgo(6), estimatedValue: 1.99, quantity: 1 },
  { id: 'w8', itemName: 'Pasta Sauce', category: 'Canned', action: 'eaten', date: daysAgo(3), estimatedValue: 3.49, quantity: 1 },
];

const SAMPLE_SHOPPING: ShoppingList[] = [
  {
    id: 'sl1',
    name: 'Weekly Essentials',
    createdDate: daysAgo(0),
    items: [
      { id: 'si1', name: 'Olive Oil', category: 'Condiments', quantity: 1, unit: 'bottle', checked: false },
      { id: 'si2', name: 'Garlic', category: 'Produce', quantity: 1, unit: 'head', checked: true },
      { id: 'si3', name: 'Lemons', category: 'Produce', quantity: 4, unit: 'pcs', checked: false },
      { id: 'si4', name: 'Tortillas', category: 'Bakery', quantity: 1, unit: 'pack', checked: false },
      { id: 'si5', name: 'Granola', category: 'Grains', quantity: 1, unit: 'bag', checked: true },
    ],
  },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export const useStore = create<ShelfLifeStore>()(
  persist(
    (set) => ({
      user: null,
      pantryItems: SAMPLE_PANTRY,
      wasteLogs: SAMPLE_WASTE,
      recipes: SAMPLE_RECIPES,
      shoppingLists: SAMPLE_SHOPPING,
      activeTab: 'pantry',
      theme: 'dark',
      showSettings: false,
      avocadoTipIndex: 0,

      setUser: (user) => set({ user }),
      updateUser: (updates) => set((s) => ({
        user: s.user ? { ...s.user, ...updates } : null,
      })),
      resetOnboarding: () => set({ user: null }),

      addPantryItem: (item) => set((s) => ({ pantryItems: [...s.pantryItems, item] })),
      updatePantryItem: (id, updates) => set((s) => ({
        pantryItems: s.pantryItems.map(i => i.id === id ? { ...i, ...updates } : i),
      })),
      removePantryItem: (id) => set((s) => ({
        pantryItems: s.pantryItems.filter(i => i.id !== id),
      })),
      clearPantry: () => set({ pantryItems: [] }),

      addWasteLog: (log) => set((s) => ({ wasteLogs: [...s.wasteLogs, log] })),

      setRecipes: (recipes) => set({ recipes }),

      addShoppingList: (list) => set((s) => ({ shoppingLists: [...s.shoppingLists, list] })),
      updateShoppingList: (id, updates) => set((s) => ({
        shoppingLists: s.shoppingLists.map(l => l.id === id ? { ...l, ...updates } : l),
      })),
      removeShoppingList: (id) => set((s) => ({
        shoppingLists: s.shoppingLists.filter(l => l.id !== id),
      })),
      toggleShoppingItem: (listId, itemId) => set((s) => ({
        shoppingLists: s.shoppingLists.map(l =>
          l.id === listId
            ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }
            : l
        ),
      })),

      setActiveTab: (tab) => set({ activeTab: tab }),
      setTheme: (theme) => set({ theme }),
      setShowSettings: (show) => set({ showSettings: show }),
      nextAvocadoTip: () => set((s) => ({ avocadoTipIndex: s.avocadoTipIndex + 1 })),
    }),
    {
      name: 'shelf-life-storage-v1',
      partialize: (state) => ({
        user: state.user,
        pantryItems: state.pantryItems,
        wasteLogs: state.wasteLogs,
        recipes: state.recipes,
        shoppingLists: state.shoppingLists,
        theme: state.theme,
        avocadoTipIndex: state.avocadoTipIndex,
      }),
    }
  )
);
