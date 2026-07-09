import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import posthog from 'posthog-js';
import type { User, PantryItem, WasteLog, Recipe, ShoppingList, Tab, ThemeMode, MealPlanDay, SubscriptionTier, AuthProvider, Household } from '../types';
import { BROWSE_RECIPES } from '../data/recipes';
import { formatLocalDate, FREE_LIMITS, isAvoTrialActive, nextAvoTrialStartedAt, nextStreak } from '../types';
import { syncPantryAdd, syncPantryUpdate, syncPantryRemove, syncWasteLog, syncProfileUpdates } from '../lib/supabaseSync';
import { resetAvoChatSession } from '../lib/avoChatSession';
import { bestDinnerForPantry } from '../lib/recipeMatch';
import * as debug from '../lib/debug';
import {
  scheduleItemNotifications,
  cancelItemNotifications,
  rescheduleItemNotifications,
  cancelAllNotifications,
  rescheduleAllNotifications,
  scheduleStreakProtection,
  scheduleReEngagement,
  scheduleRecipeNudge,
  celebrateStreakMilestone,
  schedulePremiumPerks,
} from '../lib/notifications';

interface ShelfLifeStore {
  // State
  user: User | null;
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
  recipes: Recipe[];
  browseRecipes: Recipe[];
  shoppingLists: ShoppingList[];
  mealPlan: MealPlanDay[];
  activeTab: Tab;
  addItemMode: 'manual' | 'scan' | 'receipt' | null;
  setAddItemMode: (mode: 'manual' | 'scan' | 'receipt' | null) => void;
  recipeSearchSeed: string | null;
  setRecipeSearchSeed: (seed: string | null) => void;
  theme: ThemeMode;
  showSettings: boolean;
  // Supabase user id (set after OAuth, used for sync)
  supabaseUserId: string | null;
  setSupabaseUserId: (id: string | null) => void;
  loadCloudData: (pantryItems: PantryItem[], wasteLogs: WasteLog[]) => void;
  // Household sharing (Pro): when set, the pantry is shared with up to 4 members
  household: Household | null;
  setHousehold: (household: Household | null) => void;
  // Set after OAuth for new users so onboarding can skip sign-in and pre-fill name
  oauthNewUser: { name: string; email: string; provider: Exclude<AuthProvider, 'guest'> } | null;
  setOAuthNewUser: (u: { name: string; email: string; provider: Exclude<AuthProvider, 'guest'> } | null) => void;

  // User
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  resetOnboarding: () => void;

  // Pantry
  addPantryItem: (item: PantryItem, method?: 'barcode' | 'manual' | 'receipt' | 'voice') => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  removePantryItem: (id: string) => void;
  clearPantry: () => void;
  // Realtime: apply a change pushed by another household member. These only
  // mutate local state (idempotent, no write-back to Supabase) so they never
  // echo into a sync loop.
  upsertPantryItemLocal: (item: PantryItem) => void;
  removePantryItemLocal: (id: string) => void;

  // Waste
  addWasteLog: (log: WasteLog) => void;
  addWasteLogLocal: (log: WasteLog) => void;

  // Recipes
  setRecipes: (recipes: Recipe[]) => void;

  // Shopping
  addShoppingList: (list: ShoppingList) => void;
  updateShoppingList: (id: string, updates: Partial<ShoppingList>) => void;
  removeShoppingList: (id: string) => void;
  toggleShoppingItem: (listId: string, itemId: string) => void;
  removeShoppingItem: (listId: string, itemId: string) => void;

  // Meal Plan
  setMealPlan: (plan: MealPlanDay[]) => void;

  // Subscription
  setSubscriptionTier: (tier: SubscriptionTier) => Promise<void>;
  incrementAvoChat: () => boolean; // returns false if limit hit
  decrementAvoChat: () => void;
  canAddPantryItem: () => boolean;
  isPro: () => boolean;

  // UI
  setActiveTab: (tab: Tab) => void;
  setTheme: (theme: ThemeMode) => void;
  setShowSettings: (show: boolean) => void;

  // Avo AI consent (per-device, persisted)
  avoAiConsent: 'granted' | 'declined' | null;
  setAvoAiConsent: (consent: 'granted' | 'declined' | null) => void;

  // Local notifications (per-device, persisted). null = not asked yet.
  notificationsEnabled: boolean | null;
  setNotificationsEnabled: (enabled: boolean) => void;

  // Household streak: if true, the whole household shares one streak.
  // Opted in per-device when creating/joining a household.
  householdStreakEnabled: boolean;
  setHouseholdStreakEnabled: (enabled: boolean) => void;

  // Gamification: weekly Impact Card + nature badges + profile
  cardTheme: string;                       // selected share-card theme (Pro)
  setCardTheme: (id: string) => void;
  lastImpactCardWeek: string | null;       // weekId the card was last shown for
  setLastImpactCardWeek: (week: string) => void;
  seenBadgeTierIds: string[];              // badge tiers already celebrated
  markBadgesSeen: (ids: string[]) => void;
  setAvatar: (avatar: string) => void;
  showProfile: boolean;
  setShowProfile: (show: boolean) => void;
}


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
      'Slice bell peppers, toss with oil, roast at 400\u00b0F for 15 minutes.',
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


const SAMPLE_SHOPPING: ShoppingList[] = [
  {
    id: 'sl1',
    name: 'Weekly Essentials',
    createdDate: daysAgo(3),
    items: [
      { id: 'si1', name: 'Olive Oil', category: 'Condiments', quantity: 1, unit: 'bottle', checked: false },
      { id: 'si2', name: 'Garlic', category: 'Produce', quantity: 1, unit: 'head', checked: true },
      { id: 'si3', name: 'Lemons', category: 'Produce', quantity: 4, unit: 'pcs', checked: false },
      { id: 'si4', name: 'Tortillas', category: 'Bakery', quantity: 1, unit: 'pack', checked: false },
      { id: 'si5', name: 'Granola', category: 'Grains', quantity: 1, unit: 'bag', checked: true },
    ],
  },
];

const SAMPLE_MEAL_PLAN: MealPlanDay[] = [
  { day: 'Mon', meal: 'Avocado Toast with Egg', pantryItems: 3, toBuy: 0, recipeId: 'r1' },
  { day: 'Tue', meal: 'Chicken & Spinach Pasta', pantryItems: 3, toBuy: 2, recipeId: 'r2' },
  { day: 'Wed', meal: 'Banana Berry Smoothie', pantryItems: 3, toBuy: 1, recipeId: 'r4' },
  { day: 'Thu', meal: 'Salmon & Bell Pepper Bowl', pantryItems: 3, toBuy: 2, recipeId: 'r3' },
  { day: 'Fri', meal: 'Leftover Night', pantryItems: 6, toBuy: 0 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

/** Name of a real recipe worth nudging about right now — only when it actually
 * uses something expiring, so the recipe nudge rescues food rather than just
 * suggesting a random dinner. Null when nothing matches. */
function recipeNudgeTarget(pantryItems: PantryItem[], recipes: Recipe[], browseRecipes: Recipe[]): string | null {
  const best = bestDinnerForPantry(pantryItems, [...recipes, ...browseRecipes]);
  return best?.usesExpiring ? best.recipe.name : null;
}

export const useStore = create<ShelfLifeStore>()(
  persist(
    (set) => ({
      user: null as User | null,
      supabaseUserId: null as string | null,
      oauthNewUser: null as { name: string; email: string; provider: Exclude<AuthProvider, 'guest'> } | null,
      pantryItems: [] as PantryItem[],
      wasteLogs: [] as WasteLog[],
      recipes: SAMPLE_RECIPES,
      browseRecipes: BROWSE_RECIPES,
      shoppingLists: SAMPLE_SHOPPING,
      mealPlan: SAMPLE_MEAL_PLAN,
      activeTab: 'pantry' as Tab,
      addItemMode: null,
      recipeSearchSeed: null as string | null,
      theme: 'light' as ThemeMode,
      showSettings: false,
      avoAiConsent: null as 'granted' | 'declined' | null,
      notificationsEnabled: null as boolean | null,
      household: null as Household | null,
      householdStreakEnabled: false,
      cardTheme: 'classic',
      lastImpactCardWeek: null as string | null,
      seenBadgeTierIds: [] as string[],
      showProfile: false,
      setSupabaseUserId: (id) => set({ supabaseUserId: id }),
      setHousehold: (household) => set({ household }),
      setHouseholdStreakEnabled: (enabled) => set({ householdStreakEnabled: enabled }),
      setCardTheme: (id) => {
        set({ cardTheme: id });
        const { supabaseUserId } = useStore.getState();
        if (supabaseUserId) syncProfileUpdates(supabaseUserId, { card_theme: id }).catch(debug.error);
      },
      setLastImpactCardWeek: (week) => set({ lastImpactCardWeek: week }),
      markBadgesSeen: (ids) => set((s) => ({
        seenBadgeTierIds: Array.from(new Set([...s.seenBadgeTierIds, ...ids])),
      })),
      setAvatar: (avatar) => {
        set((s) => ({ user: s.user ? { ...s.user, avatar } : null }));
        const { supabaseUserId } = useStore.getState();
        if (supabaseUserId) syncProfileUpdates(supabaseUserId, { avatar }).catch(debug.error);
      },
      setShowProfile: (show) => set({ showProfile: show }),
      loadCloudData: (cloudPantry, cloudWaste) => {
        // This is only called for users with onboarding_complete = true
        // (returning users). The cloud result is authoritative — even an empty
        // array means the user genuinely has no items (intentional deletion,
        // cleared on another device, etc.). Overwriting cloud with stale local
        // data would silently resurrect deleted records.
        //
        // Network failures throw before reaching here (caught in App.tsx), so
        // an empty array always means a successful empty response.
        set({ pantryItems: cloudPantry, wasteLogs: cloudWaste });
      },
      setOAuthNewUser: (u) => set({ oauthNewUser: u }),
      setUser: (user) => set({ user }),
      updateUser: (updates) => set((s) => ({
        user: s.user ? { ...s.user, ...updates } : null,
      })),
      resetOnboarding: () => {
        // Clear persisted storage first so persist middleware doesn't re-write stale data
        localStorage.removeItem('shelf-life-storage-v2');
        resetAvoChatSession();
        set({
          user: null,
          supabaseUserId: null,
          household: null,
          oauthNewUser: null,
          pantryItems: [],
          wasteLogs: [],
          recipes: SAMPLE_RECIPES,
          browseRecipes: BROWSE_RECIPES,
          shoppingLists: SAMPLE_SHOPPING,
          mealPlan: SAMPLE_MEAL_PLAN,
          activeTab: 'pantry',
          addItemMode: null,
          recipeSearchSeed: null,
          theme: 'light',
          showSettings: false,
          avoAiConsent: null,
          notificationsEnabled: null,
          householdStreakEnabled: false,
          cardTheme: 'classic',
          lastImpactCardWeek: null,
          seenBadgeTierIds: [],
          showProfile: false,
        });
        void cancelAllNotifications();
      },

      addPantryItem: (item, method = 'manual') => {
        set((s) => ({ pantryItems: [...s.pantryItems, item] }));
        posthog.capture('pantry_item_added', {
          method,
          category: item.category,
          has_expiry: !!item.expirationDate,
        });
        const { supabaseUserId, notificationsEnabled, user, household } = useStore.getState();
        if (supabaseUserId) syncPantryAdd(item, supabaseUserId, household?.id);
        if (notificationsEnabled) {
          void scheduleItemNotifications(item, user?.name);
          // Activity in the app — push the re-engagement reminder forward
          void scheduleReEngagement(user?.name);
        }
      },
      updatePantryItem: (id, updates) => {
        set((s) => ({
          pantryItems: s.pantryItems.map(i => i.id === id ? { ...i, ...updates } : i),
        }));
        const { supabaseUserId, notificationsEnabled, pantryItems, user } = useStore.getState();
        if (supabaseUserId) syncPantryUpdate(id, updates);
        if (notificationsEnabled) {
          if (updates.expirationDate !== undefined) {
            const updated = pantryItems.find(i => i.id === id);
            if (updated) void rescheduleItemNotifications(updated, user?.name);
          }
          void scheduleReEngagement(user?.name);
        }
      },
      removePantryItem: (id) => {
        set((s) => ({ pantryItems: s.pantryItems.filter(i => i.id !== id) }));
        const { supabaseUserId } = useStore.getState();
        if (supabaseUserId) syncPantryRemove(id);
        void cancelItemNotifications(id);
      },
      upsertPantryItemLocal: (item) => set((s) => {
        const idx = s.pantryItems.findIndex(i => i.id === item.id);
        if (idx === -1) return { pantryItems: [...s.pantryItems, item] };
        const next = s.pantryItems.slice();
        next[idx] = item;
        return { pantryItems: next };
      }),
      removePantryItemLocal: (id) => set((s) => ({
        pantryItems: s.pantryItems.filter(i => i.id !== id),
      })),
      clearPantry: () => {
        set({ pantryItems: [] });
        void cancelAllNotifications();
      },

      addWasteLog: (log) => {
        const { supabaseUserId, household } = useStore.getState();
        // Attribute the entry to its author so the household leaderboard can
        // credit it. syncWasteLog already persists user_id server-side.
        const stamped: WasteLog = supabaseUserId ? { ...log, userId: log.userId ?? supabaseUserId } : log;
        if (supabaseUserId) syncWasteLog(stamped, supabaseUserId, household?.id);
        let profileUpdates: { streak_days: number; last_active_date: string; best_streak: number } | null = null;
        set((s) => {
          if (!s.user) return { wasteLogs: [...s.wasteLogs, stamped] };
          const { streakDays, lastActiveDate } = nextStreak(s.user, log.action);
          const bestStreak = Math.max(s.user.bestStreak ?? 0, streakDays);
          profileUpdates = {
            streak_days: streakDays,
            last_active_date: lastActiveDate,
            best_streak: bestStreak,
          };
          return {
            wasteLogs: [...s.wasteLogs, stamped],
            user: { ...s.user, streakDays, lastActiveDate, bestStreak },
          };
        });
        if (supabaseUserId && profileUpdates) {
          syncProfileUpdates(supabaseUserId, profileUpdates).catch(debug.error);
        }

        // Notifications: streak protection (push out evening reminder),
        // celebrate milestones, and refresh re-engagement + recipe nudge.
        const { notificationsEnabled, user } = useStore.getState();
        if (notificationsEnabled && user) {
          void scheduleStreakProtection(user.streakDays, user.name);
          if ([3, 7, 14, 30, 50, 100, 365].includes(user.streakDays)) {
            void celebrateStreakMilestone(user.streakDays);
          }
          void scheduleReEngagement(user.name);
          if (log.action === 'eaten') {
            // They actually consumed food — refresh the recipe nudge so we
            // don't bug them about cooking right after a successful meal.
            const { pantryItems, recipes, browseRecipes } = useStore.getState();
            void scheduleRecipeNudge(user.name, recipeNudgeTarget(pantryItems, recipes, browseRecipes));
          }
        }
      },
      addWasteLogLocal: (log) => {
        const { supabaseUserId, householdStreakEnabled } = useStore.getState();
        let profileUpdates: { streak_days: number; last_active_date: string; best_streak: number } | null = null;
        set((s) => {
          // Dedupe by id: the originating device already appended this log,
          // and realtime echoes it back to everyone (including the sender).
          if (s.wasteLogs.some(l => l.id === log.id)) return {};
          // householdStreakEnabled: a household member's activity advances
          // (or resets) everyone's streak too, not just the device that
          // logged it — otherwise the streak is silently per-device even
          // though the setting claims it's shared.
          if (!s.user || !householdStreakEnabled) return { wasteLogs: [...s.wasteLogs, log] };
          const { streakDays, lastActiveDate } = nextStreak(s.user, log.action);
          const bestStreak = Math.max(s.user.bestStreak ?? 0, streakDays);
          profileUpdates = { streak_days: streakDays, last_active_date: lastActiveDate, best_streak: bestStreak };
          return {
            wasteLogs: [...s.wasteLogs, log],
            user: { ...s.user, streakDays, lastActiveDate, bestStreak },
          };
        });
        if (supabaseUserId && profileUpdates) {
          syncProfileUpdates(supabaseUserId, profileUpdates).catch(debug.error);
        }
      },

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
      removeShoppingItem: (listId, itemId) => set((s) => ({
        shoppingLists: s.shoppingLists.map(l =>
          l.id === listId
            ? { ...l, items: l.items.filter(i => i.id !== itemId) }
            : l
        ),
      })),

      setMealPlan: (plan) => set({ mealPlan: plan }),

      setSubscriptionTier: async (tier) => {
        const { supabaseUserId, user, notificationsEnabled } = useStore.getState();
        if (!user) return;
        const avoTrialStartedAt = nextAvoTrialStartedAt(user, tier);
        set({ user: { ...user, subscriptionTier: tier, avoTrialStartedAt } });
        // Pro-only perk notifications appear on upgrade and vanish on downgrade.
        if (notificationsEnabled) {
          void schedulePremiumPerks(tier === 'pro', user.name);
        }
        if (supabaseUserId) {
          // Awaited so the cloud write can't be orphaned by a sign-out or
          // navigation that happens immediately after an upgrade/cancel.
          await syncProfileUpdates(supabaseUserId, {
            subscription_tier: tier,
            avo_trial_started_at: avoTrialStartedAt,
          });
        }
      },
      incrementAvoChat: (): boolean => {
        const s = useStore.getState();
        if (!s.user) return false;
        const today = formatLocalDate(new Date());

        // Lazily start the 7-day Avo trial on the user's first chat (free users
        // only). Once started, isAvoTrialActive() grants Pro-level daily access
        // for 7 days, after which they fall back to the free lifetime allotment.
        let user = s.user;
        let startedTrial = false;
        if (user.subscriptionTier !== 'pro' && !user.avoTrialStartedAt) {
          user = { ...user, avoTrialStartedAt: today };
          startedTrial = true;
        }

        const hasProAccess = user.subscriptionTier === 'pro' || isAvoTrialActive(user);

        if (hasProAccess) {
          // Pro / active trial: 20 chats per day, resets daily.
          const count = user.avoChatResetDate === today ? user.avoChatCount : 0;
          if (count >= FREE_LIMITS.proChatPerDay) {
            if (startedTrial) {
              set({ user });
              if (s.supabaseUserId) {
                syncProfileUpdates(s.supabaseUserId, { avo_trial_started_at: user.avoTrialStartedAt }).catch(debug.error);
              }
            }
            return false;
          }
          const nextUser = { ...user, avoChatCount: count + 1, avoChatResetDate: today };
          set({ user: nextUser });
          if (s.supabaseUserId) {
            syncProfileUpdates(s.supabaseUserId, {
              avo_chat_count: nextUser.avoChatCount,
              avo_chat_reset_date: nextUser.avoChatResetDate,
              avo_trial_started_at: nextUser.avoTrialStartedAt,
            }).catch(debug.error);
          }
          return true;
        }

        // Free tier, trial ended: 5 chats total (permanent, never resets).
        const freeUsed = user.avoFreeChatsUsed ?? 0;
        if (freeUsed >= FREE_LIMITS.avoChatTotal) return false;
        const nextUser = { ...user, avoFreeChatsUsed: freeUsed + 1 };
        set({ user: nextUser });
        if (s.supabaseUserId) {
          syncProfileUpdates(s.supabaseUserId, {
            avo_free_chats_used: nextUser.avoFreeChatsUsed,
          }).catch(debug.error);
        }
        return true;
      },
      decrementAvoChat: (): void => {
        const s = useStore.getState();
        if (!s.user) return;
        const today = formatLocalDate(new Date());
        // Refund the counter that was actually charged.
        const hasProAccess = s.user.subscriptionTier === 'pro' || isAvoTrialActive(s.user);
        let nextUser: User;
        let rolledBackTrial = false;
        if (hasProAccess) {
          const refundedCount = Math.max(0, s.user.avoChatCount - 1);
          nextUser = { ...s.user, avoChatCount: refundedCount };
          // If this refund empties today's counter AND the trial only started
          // today (as part of this now-failed first chat), roll the trial start
          // back too so a failed first message doesn't burn a trial day.
          if (s.user.subscriptionTier !== 'pro'
            && s.user.avoTrialStartedAt === today
            && refundedCount === 0) {
            nextUser = { ...nextUser, avoTrialStartedAt: null };
            rolledBackTrial = true;
          }
        } else {
          nextUser = { ...s.user, avoFreeChatsUsed: Math.max(0, (s.user.avoFreeChatsUsed ?? 0) - 1) };
        }
        set({ user: nextUser });
        if (s.supabaseUserId) {
          syncProfileUpdates(s.supabaseUserId, hasProAccess
            ? { avo_chat_count: nextUser.avoChatCount, ...(rolledBackTrial ? { avo_trial_started_at: null } : {}) }
            : { avo_free_chats_used: nextUser.avoFreeChatsUsed },
          ).catch(debug.error);
        }
      },
      canAddPantryItem: (): boolean => {
        const s = useStore.getState();
        if (!s.user) return false;
        if (s.user.subscriptionTier === 'pro') return true;
        // A free member of a household whose owner is Pro shouldn't get
        // blocked once the shared pantry the owner grew exceeds 20 items —
        // but a free user can't fake this by making their own household,
        // since creating one already requires Pro (enforced server-side).
        // Checked live (not just "in a household") so a member's exemption
        // ends if the owner later cancels Pro.
        if (s.household?.ownerIsPro) return true;
        return s.pantryItems.length < FREE_LIMITS.pantryItems;
      },
      isPro: (): boolean => {
        const s = useStore.getState();
        return s.user?.subscriptionTier === 'pro';
      },

      setActiveTab: (tab: Tab) => set({ activeTab: tab }),
      setAddItemMode: (mode) => set({ addItemMode: mode }),
      setRecipeSearchSeed: (seed) => set({ recipeSearchSeed: seed }),
      setTheme: (theme: ThemeMode) => set({ theme }),
      setShowSettings: (show: boolean) => set({ showSettings: show }),
      setAvoAiConsent: (consent) => set({ avoAiConsent: consent }),
      setNotificationsEnabled: (enabled) => {
        set({ notificationsEnabled: enabled });
        const { pantryItems, recipes, browseRecipes, user } = useStore.getState();
        if (enabled) {
          void rescheduleAllNotifications({
            items: pantryItems,
            streakDays: user?.streakDays ?? 0,
            userName: user?.name,
            recipeName: recipeNudgeTarget(pantryItems, recipes, browseRecipes),
            isPro: user?.subscriptionTier === 'pro',
          });
        } else {
          void cancelAllNotifications();
        }
      },
    }),
    {
      name: 'shelf-life-storage-v2',
      version: 2,
      migrate: (state, version) => {
        // v2: introduce the Avo trial fields. For an existing free user, their
        // old avoChatCount WAS the lifetime free count, so carry it into
        // avoFreeChatsUsed (mirrors the SQL backfill); trial starts fresh.
        const s = state as { user?: (User & { avoTrialStartedAt?: string | null; avoFreeChatsUsed?: number }) | null };
        if (version < 2 && s?.user) {
          const u = s.user;
          if (u.avoTrialStartedAt === undefined) u.avoTrialStartedAt = null;
          if (u.avoFreeChatsUsed === undefined) {
            u.avoFreeChatsUsed = u.subscriptionTier === 'free' ? (u.avoChatCount ?? 0) : 0;
          }
        }
        return state;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<ShelfLifeStore>;
        return {
          ...current,
          ...p,
          // Never let mealPlan be empty — fall back to sample data
          mealPlan: p.mealPlan && p.mealPlan.length > 0 ? p.mealPlan : current.mealPlan,
        };
      },
      partialize: (state) => ({
        user: state.user,
        household: state.household,
        householdStreakEnabled: state.householdStreakEnabled,
        pantryItems: state.pantryItems,
        wasteLogs: state.wasteLogs,
        recipes: state.recipes,
        shoppingLists: state.shoppingLists,
        mealPlan: state.mealPlan,
        theme: state.theme,
        avoAiConsent: state.avoAiConsent,
        notificationsEnabled: state.notificationsEnabled,
        cardTheme: state.cardTheme,
        lastImpactCardWeek: state.lastImpactCardWeek,
        seenBadgeTierIds: state.seenBadgeTierIds,
      }),
    }
  )
);
