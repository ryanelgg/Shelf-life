import { useState, useMemo } from 'react';
import type { JSX } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { useStore } from '../store/useStore';
import { formatLocalDate, getFreshnessStatus } from '../types';
import { FoodCategoryIcon } from '../components/FoodCategoryIcon';
import type { FoodCategory, ShoppingItem, Recipe, PantryItem, DietaryPref } from '../types';

// ── SVG icon helpers ────────────────────────────────────────────────────────

function RecipeCategoryIcon({ tag, size = 16, color = 'currentColor' }: { tag: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (tag) {
    case 'breakfast':
      return (
        <svg {...p}>
          {/* Pan body */}
          <circle cx="14" cy="13" r="7" />
          {/* Handle */}
          <path d="M7 13 L3 11.5" />
          {/* Egg white */}
          <ellipse cx="14" cy="13" rx="3.5" ry="2.8" fill={color} fillOpacity="0.12" stroke="none" />
          {/* Yolk */}
          <circle cx="14" cy="13" r="1.4" fill={color} fillOpacity="0.5" stroke="none" />
        </svg>
      );
    case 'lunch':
    case 'salad':
      return (
        <svg {...p}>
          {/* Bowl */}
          <path d="M4 11 C4 17, 20 17, 20 11" />
          <line x1="3" y1="11" x2="21" y2="11" />
          <line x1="12" y1="17" x2="12" y2="20" />
          <line x1="8" y1="20" x2="16" y2="20" />
          {/* Leaf */}
          <path d="M9 8 C9 5, 15 5, 15 8 C15 10, 12 10, 12 10 C12 10, 9 10, 9 8 Z" fill={color} fillOpacity="0.15" />
        </svg>
      );
    case 'dinner':
      return (
        <svg {...p}>
          {/* Plate */}
          <circle cx="12" cy="13" r="7" />
          <circle cx="12" cy="13" r="4.5" />
          {/* Fork */}
          <line x1="5.5" y1="5" x2="5.5" y2="21" />
          <path d="M4 5 L4 9 C4 10.5, 7 10.5, 7 9 L7 5" />
          {/* Knife */}
          <path d="M18.5 5 C19.5 7, 19.5 10, 18.5 11 L18.5 21" />
        </svg>
      );
    case 'quick':
      return (
        <svg {...p}>
          <path d="M13 2 L7 13 L12 13 L11 22 L17 11 L12 11 Z" fill={color} fillOpacity="0.15" />
        </svg>
      );
    case 'vegetarian':
      return (
        <svg {...p}>
          {/* Leaf */}
          <path d="M12 21 C12 21, 4 15, 6 7 C8 0, 16 0, 18 7 C20 15, 12 21, 12 21 Z" fill={color} fillOpacity="0.12" />
          {/* Midrib */}
          <path d="M12 19 L12 8" />
          {/* Side veins */}
          <path d="M12 12 L9 9" /><path d="M12 15 L9 13" />
          <path d="M12 12 L15 9" /><path d="M12 15 L15 13" />
        </svg>
      );
    case 'soup':
      return (
        <svg {...p}>
          {/* Bowl */}
          <path d="M4 12 C4 18, 20 18, 20 12 Z" fill={color} fillOpacity="0.08" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="18" x2="12" y2="21" />
          <line x1="8" y1="21" x2="16" y2="21" />
          {/* Steam */}
          <path d="M9 9 C9 8, 10 7, 9 6" strokeWidth="1.4" />
          <path d="M12 9 C12 8, 13 7, 12 6" strokeWidth="1.4" />
          <path d="M15 9 C15 8, 16 7, 15 6" strokeWidth="1.4" />
        </svg>
      );
    case 'pasta':
      return (
        <svg {...p}>
          {/* Fork tines */}
          <line x1="9" y1="3" x2="9" y2="10" />
          <line x1="12" y1="3" x2="12" y2="10" />
          <line x1="15" y1="3" x2="15" y2="10" />
          {/* Fork handle */}
          <path d="M9 10 C9 13, 15 13, 15 10" />
          <line x1="12" y1="13" x2="12" y2="21" />
          {/* Pasta swirl */}
          <path d="M6 17 C6 15, 9 14, 12 16 C15 18, 18 17, 18 15" strokeWidth="1.4" />
        </svg>
      );
    case 'comfort-food':
      return (
        <svg {...p}>
          {/* Pot body */}
          <path d="M5 10 L5 19 C5 20, 6 21, 7 21 L17 21 C18 21, 19 20, 19 19 L19 10 Z" fill={color} fillOpacity="0.08" />
          {/* Lid */}
          <line x1="4" y1="10" x2="20" y2="10" />
          <path d="M7 10 L7 8" /><path d="M17 10 L17 8" />
          <rect x="10" y="6" width="4" height="2" rx="1" />
          {/* Handles */}
          <path d="M5 13 L3 13 L3 16 L5 16" />
          <path d="M19 13 L21 13 L21 16 L19 16" />
        </svg>
      );
    case 'healthy':
      return (
        <svg {...p}>
          {/* Apple */}
          <path d="M12 6 C9 6, 5 9, 5 14 C5 19, 8 22, 12 22 C16 22, 19 19, 19 14 C19 9, 15 6, 12 6 Z" fill={color} fillOpacity="0.1" />
          {/* Stem */}
          <path d="M12 6 C12 4, 14 3, 14 4" />
          {/* Leaf */}
          <path d="M12 5 C13 3, 16 3, 15 5" fill={color} fillOpacity="0.2" />
          {/* Bite */}
          <path d="M17 10 C18 12, 18 14, 17 16" strokeWidth="2.5" stroke="var(--bg-primary)" />
        </svg>
      );
    case 'dessert':
      return (
        <svg {...p}>
          {/* Cake slice */}
          <path d="M4 19 L12 5 L20 19 Z" fill={color} fillOpacity="0.1" />
          {/* Frosting layer */}
          <line x1="5.5" y1="15" x2="18.5" y2="15" />
          {/* Candle */}
          <line x1="12" y1="5" x2="12" y2="2" strokeWidth="1.2" />
          {/* Flame */}
          <path d="M12 2 C11 1, 11 0.5, 12 0.5 C13 0.5, 13 1, 12 2" fill={color} fillOpacity="0.5" stroke="none" />
        </svg>
      );
    case 'snack':
      return (
        <svg {...p}>
          {/* Cup */}
          <path d="M6 8 L8 20 L16 20 L18 8 Z" fill={color} fillOpacity="0.1" />
          <line x1="5" y1="8" x2="19" y2="8" />
          {/* Dots (seeds/popcorn) */}
          <circle cx="10" cy="13" r="1.2" fill={color} fillOpacity="0.5" stroke="none" />
          <circle cx="14" cy="13" r="1.2" fill={color} fillOpacity="0.5" stroke="none" />
          <circle cx="12" cy="10.5" r="1.2" fill={color} fillOpacity="0.5" stroke="none" />
        </svg>
      );
    case 'stir-fry':
    case 'grilling':
      return (
        <svg {...p}>
          {/* Flame */}
          <path d="M12 21 C7 21, 4 18, 4 14 C4 10, 7 8, 8 5 C9 8, 8 10, 10 12 C10 9, 12 6, 12 3 C14 7, 13 10, 15 12 C16 9, 15 8, 17 5 C18 9, 20 11, 20 14 C20 18, 17 21, 12 21 Z" fill={color} fillOpacity="0.12" />
        </svg>
      );
    case 'seafood':
      return (
        <svg {...p}>
          {/* Fish body */}
          <path d="M3 12 C3 12, 6 7, 14 9 C18 10, 21 8, 21 12 C21 16, 18 14, 14 15 C6 17, 3 12, 3 12 Z" fill={color} fillOpacity="0.1" />
          {/* Tail */}
          <path d="M21 8 L23 6 L21 12 L23 18 L21 16" />
          {/* Eye */}
          <circle cx="7" cy="12" r="1.2" fill={color} fillOpacity="0.5" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          {/* Plate */}
          <circle cx="12" cy="13" r="8" />
          <circle cx="12" cy="13" r="5" />
        </svg>
      );
  }
}

function CalendarIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="15" x2="10" y2="15" /><line x1="14" y1="15" x2="16" y2="15" />
    </svg>
  );
}

function LightbulbIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21 L15 21" /><path d="M10 18 L14 18" />
      <path d="M12 2 C8 2, 5 5, 5 9 C5 12, 7 14, 9 16 L9 18 L15 18 L15 16 C17 14, 19 12, 19 9 C19 5, 16 2, 12 2 Z" fill="none" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  );
}

function WhiskIcon({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* Handle */}
      <line x1="12" y1="10" x2="16" y2="21" />
      {/* Whisk loops */}
      <path d="M12 10 C8 6, 5 3, 8 2 C11 1, 13 5, 12 10" />
      <path d="M12 10 C10 5, 11 1, 14 2 C17 3, 16 6, 12 10" />
      <path d="M12 10 C14 6, 17 4, 18 6 C19 9, 15 10, 12 10" />
      <path d="M12 10 C9 12, 6 12, 6 9 C6 7, 9 6, 12 10" />
    </svg>
  );
}

function SearchIcon({ size = 36, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}

function NotepadIcon({ size = 38, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="19" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
      <line x1="8" y1="3" x2="8" y2="1" /><line x1="12" y1="3" x2="12" y2="1" /><line x1="16" y1="3" x2="16" y2="1" />
    </svg>
  );
}

// ── Dietary preference filtering ────────────────────────────────────────────

const DIET_BLOCKLIST: Record<string, string[]> = {
  vegetarian: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchov', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam',
    'mussels', 'halibut', 'trout', 'mahi', 'catfish',
  ],
  vegan: [
    'chicken', 'beef', 'pork', 'turkey', 'tuna', 'salmon', 'shrimp', 'lamb',
    'bacon', 'ham', 'sausage', 'anchov', 'prosciutto', 'pancetta', 'steak',
    'cod', 'tilapia', 'crab', 'lobster', 'sardine', 'scallop', 'clam',
    'egg', 'milk', 'butter', 'cream', 'cheese', 'parmesan', 'mozzarella',
    'cheddar', 'ricotta', 'yogurt', 'honey', 'ghee', 'whey',
  ],
  'gluten-free': [
    'spaghetti', 'pasta', 'flour', 'bread', 'breadcrumb', 'soy sauce',
    'wheat', 'barley', 'rye', 'couscous', 'noodle', 'tortilla', 'pita',
    'crouton', 'panko', 'udon', 'ramen',
  ],
  'dairy-free': [
    'milk', 'butter', 'cream', 'cheese', 'parmesan', 'mozzarella', 'cheddar',
    'brie', 'ricotta', 'mascarpone', 'yogurt', 'ghee', 'whey',
    'half-and-half', 'sour cream',
  ],
  'nut-free': [
    'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'hazelnut',
    'macadamia', 'pine nut', 'brazil nut',
  ],
};

function meetsDiet(recipe: Recipe, diets: DietaryPref[]): boolean {
  const active = diets.filter(d => d !== 'none');
  if (active.length === 0) return true;
  const ingredNames = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  for (const diet of active) {
    const blocked = DIET_BLOCKLIST[diet] ?? [];
    if (blocked.some(b => ingredNames.includes(b))) return false;
  }
  return true;
}

const DIET_LABEL: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  'nut-free': 'Nut-free',
};

// ─────────────────────────────────────────────────────────────────────────────

const RECIPE_CATEGORIES: { label: string; value: string; icon: (c: string) => JSX.Element }[] = [
  { label: 'All',        value: 'all',          icon: (c) => <RecipeCategoryIcon tag="default"      size={14} color={c} /> },
  { label: 'Breakfast',  value: 'breakfast',    icon: (c) => <RecipeCategoryIcon tag="breakfast"    size={14} color={c} /> },
  { label: 'Lunch',      value: 'lunch',        icon: (c) => <RecipeCategoryIcon tag="lunch"        size={14} color={c} /> },
  { label: 'Dinner',     value: 'dinner',       icon: (c) => <RecipeCategoryIcon tag="dinner"       size={14} color={c} /> },
  { label: 'Quick',      value: 'quick',        icon: (c) => <RecipeCategoryIcon tag="quick"        size={14} color={c} /> },
  { label: 'Vegetarian', value: 'vegetarian',   icon: (c) => <RecipeCategoryIcon tag="vegetarian"   size={14} color={c} /> },
  { label: 'Soup',       value: 'soup',         icon: (c) => <RecipeCategoryIcon tag="soup"         size={14} color={c} /> },
  { label: 'Pasta',      value: 'pasta',        icon: (c) => <RecipeCategoryIcon tag="pasta"        size={14} color={c} /> },
  { label: 'Comfort',    value: 'comfort-food', icon: (c) => <RecipeCategoryIcon tag="comfort-food" size={14} color={c} /> },
  { label: 'Healthy',    value: 'healthy',      icon: (c) => <RecipeCategoryIcon tag="healthy"      size={14} color={c} /> },
  { label: 'Dessert',    value: 'dessert',      icon: (c) => <RecipeCategoryIcon tag="dessert"      size={14} color={c} /> },
  { label: 'Snack',      value: 'snack',        icon: (c) => <RecipeCategoryIcon tag="snack"        size={14} color={c} /> },
];

type IngredientStatus =
  | { status: 'missing' }
  | { status: 'have'; pantryQty: number; pantryUnit: string }
  | { status: 'low'; pantryQty: number; pantryUnit: string; neededQty: number };

const UNIT_ALIASES: Record<string, string> = {
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  kg: 'kg',
  g: 'g',
  gallon: 'gal',
  gallons: 'gal',
  gal: 'gal',
  liter: 'l',
  liters: 'l',
  l: 'l',
  cup: 'cup',
  cups: 'cup',
  pc: 'pcs',
  pcs: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  loaf: 'loaf',
  loaves: 'loaf',
  bunch: 'bunch',
  bunches: 'bunch',
  head: 'head',
  heads: 'head',
  dozen: 'dozen',
  tub: 'tub',
  block: 'block',
  pack: 'pack',
  bag: 'bag',
  box: 'box',
  can: 'can',
  bottle: 'bottle',
};

function normalizeUnit(unit?: string): string | null {
  if (!unit) return null;
  const normalized = unit.toLowerCase().replace(/[^a-z]/g, '');
  return UNIT_ALIASES[normalized] ?? (normalized || null);
}

function parseAmountUnit(amount: string): string | null {
  const tokens = amount.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g);
  if (!tokens) return null;
  for (const token of tokens) {
    const normalized = normalizeUnit(token);
    if (normalized) return normalized;
  }
  return null;
}

function getIngredientStatus(
  ingredientName: string,
  ingredientAmount: string,
  pantryItems: PantryItem[]
): IngredientStatus {
  const nameL = ingredientName.toLowerCase();
  const match = pantryItems.find(item => {
    const itemL = item.name.toLowerCase();
    return itemL.includes(nameL) || nameL.includes(itemL);
  });
  if (!match) return { status: 'missing' };

  // Try numeric comparison only when units are compatible.
  // When neededUnit is null (unrecognised unit like "cloves"), only compare
  // raw quantities if the pantry item is also stored as a plain count (pcs /
  // dozen / no unit).  Container units like "head", "bunch", "gal" cannot be
  // meaningfully compared to a raw number without conversion tables.
  const neededNum = parseFloat(ingredientAmount.match(/[\d.]+/)?.[0] ?? '0');
  const neededUnit = parseAmountUnit(ingredientAmount);
  const pantryUnit = normalizeUnit(match.unit);
  const COUNTABLE: Set<string | null> = new Set([null, 'pcs', 'dozen']);
  const canCompareQuantity = neededNum > 0 && (
    (neededUnit !== null && neededUnit === pantryUnit) ||
    (neededUnit === null && COUNTABLE.has(pantryUnit))
  );
  if (canCompareQuantity && match.quantity < neededNum) {
    return { status: 'low', pantryQty: match.quantity, pantryUnit: match.unit, neededQty: neededNum };
  }
  return { status: 'have', pantryQty: match.quantity, pantryUnit: match.unit };
}

export function PlanScreen() {
  const {
    mealPlan, recipes, pantryItems, browseRecipes, user,
    shoppingLists, toggleShoppingItem, addShoppingList, removeShoppingList, updateShoppingList,
  } = useStore();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [recipeFilter, setRecipeFilter] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [showAllRecipes, setShowAllRecipes] = useState(false);

  const recipeUsesExpiring = (recipe: Recipe) =>
    recipe.matchedItemIds.some(id => {
      const item = pantryItems.find(p => p.id === id);
      if (!item) return false;
      const s = getFreshnessStatus(item.expirationDate);
      return s === 'expiring' || s === 'expiring-soon';
    });

  const activeDiets = useMemo(
    () => (user?.dietaryPreferences ?? []).filter((d): d is DietaryPref => d !== 'none'),
    [user?.dietaryPreferences]
  );

  const filteredRecipes = useMemo(() => {
    let result = browseRecipes || [];
    // 1. Dietary preference filter (from onboarding)
    if (activeDiets.length > 0) {
      result = result.filter(r => meetsDiet(r, activeDiets));
    }
    // 2. Category chip filter
    if (recipeFilter !== 'all') {
      result = result.filter(r => r.tags.includes(recipeFilter));
    }
    // 3. Search query
    if (recipeSearchQuery.trim()) {
      const q = recipeSearchQuery.toLowerCase().trim();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.ingredients.some(ing => ing.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [browseRecipes, recipeFilter, recipeSearchQuery, activeDiets]);

  const displayedRecipes = showAllRecipes ? filteredRecipes : filteredRecipes.slice(0, 6);
  const totalSavings = filteredRecipes.reduce((sum, recipe) => sum + recipe.savingsEstimate, 0);

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    addShoppingList({
      id: `sl-${Date.now()}`,
      name: newListName.trim(),
      items: [],
      createdDate: formatLocalDate(new Date()),
    });
    setNewListName('');
    setShowNewForm(false);
  };

  const handleAddItemToList = (listId: string) => {
    if (!newItemName.trim()) return;
    const list = shoppingLists.find(l => l.id === listId);
    if (!list) return;

    const newItem: ShoppingItem = {
      id: `si-${Date.now()}`,
      name: newItemName.trim(),
      category: 'Other' as FoodCategory,
      quantity: 1,
      unit: 'pcs',
      checked: false,
    };

    updateShoppingList(listId, {
      items: [...list.items, newItem],
    });
    setNewItemName('');
    setAddingToList(null);
  };

  // Smart suggestions from missing ingredients
  // Search both pantry-matched recipes and browse recipes, since meal plan
  // days can reference recipes from either collection.
  const plannedRecipes = mealPlan
    .map(day => day.recipeId
      ? ([...recipes, ...browseRecipes]).find(r => r.id === day.recipeId)
      : null)
    .filter((recipe): recipe is Recipe => Boolean(recipe));

  const suggestions = plannedRecipes.flatMap(r =>
    r.missingIngredients.map(ing => ({
      name: ing,
      fromRecipe: r.name,
    }))
  ).filter((s, i, arr) => arr.findIndex(a => a.name === s.name) === i).slice(0, 8);

  // Total items to buy from meal plan
  const totalToBuy = mealPlan.reduce((s, d) => s + d.toBuy, 0);

  return (
    <div className="screen-enter" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '-12px' }}>
          <AvocadoMascot size={34} />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Meal Plan</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>This week's plan &amp; shopping</p>
          </div>
        </div>
      </div>

      {/* Weekly meal plan */}
      <Card className="card-enter stagger-1" style={{
        padding: '16px',
        border: '1px solid rgba(74, 124, 89, 0.15)',
        background: 'rgba(74, 124, 89, 0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <CalendarIcon size={20} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>This Week</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {totalToBuy === 0 ? 'All ingredients in pantry!' : `${totalToBuy} items to buy`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mealPlan.map((day) => {
            const recipe = day.recipeId ? recipes.find(r => r.id === day.recipeId) : null;
            const isExpanded = expandedDay === day.day;

            return (
              <div
                key={day.day}
                onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(74, 124, 89, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px',
                    background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '11px', color: 'var(--accent)',
                    fontFamily: "'Cormorant Garamond', serif",
                    flexShrink: 0,
                  }}>
                    {day.day}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {day.meal}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                        {day.pantryItems} in pantry
                      </span>
                      {day.toBuy > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--wheat)', fontWeight: 600 }}>
                          {day.toBuy} to buy
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                </div>

                {isExpanded && recipe && (
                  <div className="card-enter" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(74, 124, 89, 0.08)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {recipe.description}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        fontSize: '10px', fontWeight: 600,
                      }}>
                        {recipe.cookTime} min
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        fontSize: '10px', fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {recipe.difficulty}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'rgba(163, 137, 88, 0.1)', color: 'var(--wheat)',
                        fontSize: '10px', fontWeight: 600,
                      }}>
                        saves ${recipe.savingsEstimate.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <Card className="card-enter stagger-2">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <LightbulbIcon size={18} color="var(--accent)" />
            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>What to Buy</div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Missing ingredients from this week's recipes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(74, 124, 89, 0.15)',
                background: 'rgba(74, 124, 89, 0.04)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>from {s.fromRecipe}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== TRY RECIPES SECTION ===== */}
      <div style={{ marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WhiskIcon size={22} color="var(--accent)" />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>Try a Recipe</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} to explore
                {activeDiets.length > 0 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {' · '}{activeDiets.map(d => DIET_LABEL[d]).join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>
          {totalSavings > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: '18px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
                ${totalSavings.toFixed(0)}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                savings potential
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            value={recipeSearchQuery}
            onChange={e => setRecipeSearchQuery(e.target.value)}
            placeholder="Search recipes or ingredients..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category filter chips */}
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '12px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {RECIPE_CATEGORIES.map(cat => {
            const active = recipeFilter === cat.value;
            const col = active ? 'var(--accent)' : 'var(--text-muted)';
            return (
              <button
                key={cat.value}
                onClick={() => { setRecipeFilter(cat.value); setShowAllRecipes(false); }}
                style={{
                  padding: '5px 11px',
                  borderRadius: '20px',
                  border: active ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: col,
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: "'Cormorant Garamond', serif",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {cat.icon(col)}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Recipe cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayedRecipes.map((recipe) => {
            const isExpanded = expandedRecipe === recipe.id;
            const usesExpiring = recipeUsesExpiring(recipe);
            return (
              <Card
                key={recipe.id}
                onClick={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 16px',
                  transition: 'all 0.2s',
                  border: usesExpiring ? '1px solid rgba(196,149,106,0.3)' : undefined,
                }}
              >
                {usesExpiring && (
                  <div style={{
                    display: 'inline-block',
                    fontSize: '9px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--expiring-soon)',
                    background: 'rgba(196,149,106,0.1)',
                    padding: '2px 8px', borderRadius: '6px',
                    marginBottom: '6px',
                  }}>
                    Uses expiring items
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '12px',
                    background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <RecipeCategoryIcon
                      size={26}
                      color="var(--accent)"
                      tag={
                        recipe.tags.includes('breakfast')   ? 'breakfast'    :
                        recipe.tags.includes('soup')        ? 'soup'         :
                        recipe.tags.includes('pasta')       ? 'pasta'        :
                        recipe.tags.includes('dessert')     ? 'dessert'      :
                        recipe.tags.includes('snack')       ? 'snack'        :
                        recipe.tags.includes('salad')       ? 'salad'        :
                        recipe.tags.includes('stir-fry')    ? 'stir-fry'     :
                        recipe.tags.includes('grilling')    ? 'grilling'     :
                        recipe.tags.includes('seafood')     ? 'seafood'      :
                        recipe.tags.includes('vegetarian')  ? 'vegetarian'   :
                        recipe.tags.includes('healthy')     ? 'healthy'      :
                        recipe.tags.includes('comfort-food')? 'comfort-food' :
                        recipe.tags.includes('lunch')       ? 'lunch'        :
                        recipe.tags.includes('dinner')      ? 'dinner'       :
                        'default'
                      }
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '3px' }}>{recipe.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: '6px' }}>
                      {recipe.description.length > 80 && !isExpanded
                        ? recipe.description.slice(0, 80) + '...'
                        : recipe.description}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        fontSize: '10px', fontWeight: 600,
                      }}>
                        {recipe.cookTime} min
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        fontSize: '10px', fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {recipe.difficulty}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'rgba(163, 137, 88, 0.1)', color: 'var(--wheat)',
                        fontSize: '10px', fontWeight: 600,
                      }}>
                        {recipe.servings} serving{recipe.servings > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px', color: 'var(--text-muted)',
                    transition: 'transform 0.2s',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    marginTop: '4px',
                  }}>▼</span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="card-enter" style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(74, 124, 89, 0.08)' }}>
                    {/* Ingredients — with pantry status */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{
                        fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
                        marginBottom: '8px', fontFamily: "'Cormorant Garamond', serif",
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        Ingredients
                        <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Cormorant Garamond', serif" }}>
                          — ✓ in your pantry
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {recipe.ingredients.map((ing, i) => {
                          const ps = getIngredientStatus(ing.name, ing.amount, pantryItems);
                          const bgColor =
                            ps.status === 'have' ? 'rgba(74, 124, 89, 0.08)' :
                            ps.status === 'low'  ? 'rgba(212, 134, 11, 0.07)' :
                            'rgba(138, 126, 107, 0.06)';
                          const borderColor =
                            ps.status === 'have' ? 'rgba(74, 124, 89, 0.2)' :
                            ps.status === 'low'  ? 'rgba(212, 134, 11, 0.2)' :
                            'rgba(138, 126, 107, 0.12)';
                          const icon =
                            ps.status === 'have' ? '✓' :
                            ps.status === 'low'  ? '⚠' : '○';
                          const iconColor =
                            ps.status === 'have' ? 'var(--accent)' :
                            ps.status === 'low'  ? 'var(--expiring-soon)' :
                            'var(--text-muted)';
                          return (
                            <div key={i} style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: bgColor,
                              border: `1px solid ${borderColor}`,
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              <span style={{ color: iconColor, fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>{icon}</span>
                              <span style={{ fontWeight: 600 }}>{ing.amount}</span>
                              <span style={{ flex: 1 }}>{ing.name}</span>
                              {ps.status === 'have' && (
                                <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                                  have {ps.pantryQty} {ps.pantryUnit}
                                </span>
                              )}
                              {ps.status === 'low' && (
                                <span style={{ fontSize: '10px', color: 'var(--expiring-soon)', fontWeight: 600, flexShrink: 0 }}>
                                  have {ps.pantryQty} {ps.pantryUnit} — need more
                                </span>
                              )}
                              {ps.status === 'missing' && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                  need to buy
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Steps */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: "'Cormorant Garamond', serif" }}>
                        Steps
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recipe.steps.map((step, i) => (
                          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: 'var(--accent)',
                              color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 700,
                              flexShrink: 0, marginTop: '1px',
                            }}>
                              {i + 1}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              {step}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '12px' }}>
                      {recipe.tags.map(tag => (
                        <span key={tag} style={{
                          padding: '2px 8px', borderRadius: '10px',
                          background: 'rgba(74, 124, 89, 0.06)',
                          fontSize: '9px', fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'capitalize',
                        }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Show more / less button */}
        {filteredRecipes.length > 6 && (
          <button
            onClick={() => setShowAllRecipes(!showAllRecipes)}
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              borderRadius: '12px',
              border: '1px dashed var(--input-border)',
              background: 'transparent',
              color: 'var(--accent)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showAllRecipes ? 'Show Less' : `Show All ${filteredRecipes.length} Recipes`}
          </button>
        )}

        {filteredRecipes.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', opacity: 0.4 }}>
              <SearchIcon size={36} color="var(--text-primary)" />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No recipes found</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Try a different search or category</div>
          </Card>
        )}
      </div>

      {/* Shopping lists header */}
      <div className="card-enter stagger-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Shopping Lists</h2>
        <button
          className="btn-solid"
          onClick={() => setShowNewForm(true)}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          + New List
        </button>
      </div>

      {/* New list form */}
      {showNewForm && (
        <Card className="card-enter">
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Create New List</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="List name..."
              onKeyDown={e => e.key === 'Enter' && handleCreateList()}
              autoFocus
              style={{
                flex: 1,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              className="btn-solid"
              onClick={handleCreateList}
              style={{
                padding: '10px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                color: 'var(--text-muted)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Shopping lists */}
      {shoppingLists.map((list, idx) => {
        const checkedCount = list.items.filter(i => i.checked).length;
        const totalCount = list.items.length;
        const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

        return (
          <Card key={list.id} className={`card-enter stagger-${Math.min(idx + 4, 6)}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>{list.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {checkedCount}/{totalCount} items
                </div>
              </div>
              <button
                onClick={() => removeShoppingList(list.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '14px', padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {totalCount > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <ProgressBar value={progress} color="var(--accent)" height={4} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {list.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleShoppingItem(list.id, item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: item.checked ? 'rgba(74, 124, 89, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '6px',
                    border: item.checked ? '2px solid var(--accent)' : '2px solid var(--input-border)',
                    background: item.checked ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}>
                    {item.checked && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    transition: 'all 0.2s',
                  }}>
                    <FoodCategoryIcon category={item.category} size={15} /> {item.name}
                  </span>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>

            {/* Add item to list */}
            {addingToList === list.id ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="Add item..."
                  onKeyDown={e => e.key === 'Enter' && handleAddItemToList(list.id)}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  className="btn-solid"
                  onClick={() => handleAddItemToList(list.id)}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingToList(list.id)}
                style={{
                  marginTop: '8px',
                  background: 'none',
                  border: '1px dashed var(--input-border)',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: "'Cormorant Garamond', serif",
                  width: '100%',
                }}
              >
                + Add item
              </button>
            )}
          </Card>
        );
      })}

      {shoppingLists.length === 0 && !showNewForm && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', opacity: 0.35 }}>
            <NotepadIcon size={40} color="var(--text-primary)" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", marginBottom: '6px' }}>No shopping lists yet</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Create a list or we'll suggest items based on your recipes!
          </div>
          <button
            className="btn-solid"
            onClick={() => setShowNewForm(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Create Your First List
          </button>
        </Card>
      )}
    </div>
  );
}
