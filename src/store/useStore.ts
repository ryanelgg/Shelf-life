import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import posthog from 'posthog-js';
import type { User, PantryItem, WasteLog, Recipe, ShoppingList, Tab, ThemeMode, MealPlanDay, SubscriptionTier, AuthProvider, Household } from '../types';
import { BROWSE_RECIPES } from '../data/recipes';
import { formatLocalDate, FREE_LIMITS, isAvoTrialActive } from '../types';
import { syncPantryAdd, syncPantryUpdate, syncPantryRemove, syncWasteLog, syncProfileUpdates } from '../lib/supabaseSync';
import { clearOutbox } from '../lib/syncOutbox';
import { resetAvoChatSession } from '../lib/avoChatSession';
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
} from '../lib/notifications';
import { requestInAppReview } from '../lib/appReview';

// A long-past date used to mark the one-time Avo trial "already used" for a user
// who reached Pro without starting it, so cancelling Pro can't grant a fresh
// trial. isAvoTrialActive() reads this as expired.
const TRIAL_USED_SENTINEL = '1970-01-01';

// Which daily/lifetime counter incrementAvoChat last charged, so decrementAvoChat
// can refund exactly that one on a failed request. Chats are sent one at a time
// (the composer blocks while streaming), so a single slot is sufficient.
let lastChargedBucket: 'pro' | 'free' | null = null;

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
  addItemMode: 'manual' | 'scan' | 'receipt' | 'fridge' | null;
  setAddItemMode: (mode: 'manual' | 'scan' | 'receipt' | 'fridge' | null) => void;
  // A receipt/fridge photo captured from the + menu on the home page, handed to
  // AddItemScreen to process — so the camera can open in place and we only
  // switch to the Add screen once there's something to review. Transient (not
  // persisted).
  pendingScanImage: { mode: 'receipt' | 'fridge'; base64: string } | null;
  setPendingScanImage: (v: { mode: 'receipt' | 'fridge'; base64: string } | null) => void;
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

  // Meal-Plan Autopilot (Pro): once a week, Avo auto-generates the week's meal
  // plan (prioritizing soon-to-expire items) and auto-builds a shopping list
  // for the gaps — hands-free. `week` is the Monday-date key of the last run so
  // it only fires once per calendar week.
  mealPlanAutopilot: boolean;
  setMealPlanAutopilot: (on: boolean) => void;
  mealPlanAutopilotWeek: string | null;
  setMealPlanAutopilotWeek: (week: string | null) => void;

  // Local notifications (per-device, persisted). null = not asked yet.
  notificationsEnabled: boolean | null;
  setNotificationsEnabled: (enabled: boolean) => void;
  // Whether we've already shown the App Store rating prompt (ask at most once).
  reviewPrompted: boolean;
  setReviewPrompted: () => void;

  // First-run tutorial (per-device). Shown once after onboarding.
  hasSeenTutorial: boolean;
  setHasSeenTutorial: (seen: boolean) => void;
}


export const useStore = create<ShelfLifeStore>()(
  persist(
    (set) => ({
      user: null as User | null,
      supabaseUserId: null as string | null,
      oauthNewUser: null as { name: string; email: string; provider: Exclude<AuthProvider, 'guest'> } | null,
      pantryItems: [] as PantryItem[],
      wasteLogs: [] as WasteLog[],
      // Real accounts start empty — the Impact/Plan screens have their own
      // onboarding empty states. browseRecipes is the real catalog to suggest
      // from; the user's matched recipes/shopping/meal-plan fill in as they use
      // the app, so we never seed fake "Weekly Essentials"-style data.
      recipes: [] as Recipe[],
      browseRecipes: BROWSE_RECIPES,
      shoppingLists: [] as ShoppingList[],
      mealPlan: [] as MealPlanDay[],
      activeTab: 'pantry' as Tab,
      addItemMode: null,
      pendingScanImage: null as { mode: 'receipt' | 'fridge'; base64: string } | null,
      setPendingScanImage: (v) => set({ pendingScanImage: v }),
      recipeSearchSeed: null as string | null,
      theme: 'light' as ThemeMode,
      showSettings: false,
      avoAiConsent: null as 'granted' | 'declined' | null,
      mealPlanAutopilot: false,
      mealPlanAutopilotWeek: null as string | null,
      notificationsEnabled: null as boolean | null,
      reviewPrompted: false,
      household: null as Household | null,
      hasSeenTutorial: false,
      setHasSeenTutorial: (seen) => set({ hasSeenTutorial: seen }),
      setSupabaseUserId: (id) => set({ supabaseUserId: id }),
      setHousehold: (household) => set({ household }),
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
        // Reschedule expiry reminders for the freshly-loaded cloud set. Item
        // reminders are normally scheduled as items are added/edited, but
        // cloud-loaded items (a fresh install, a second device, or a household
        // member's items already present at boot) never passed through those
        // paths — so without this they'd get NO expiry reminders until next
        // edited, defeating the core feature on a new device. Guarded on
        // notificationsEnabled (permission granted on THIS device); on native
        // only. rescheduleAllNotifications reconciles the whole schedule
        // (soonest-expiring first) so this is safe to run on every load.
        const { notificationsEnabled, user } = useStore.getState();
        if (notificationsEnabled) {
          void rescheduleAllNotifications({
            items: cloudPantry,
            streakDays: user?.streakDays ?? 0,
            userName: user?.name,
          });
        }
      },
      setOAuthNewUser: (u) => set({ oauthNewUser: u }),
      setUser: (user) => set({ user }),
      updateUser: (updates) => set((s) => ({
        user: s.user ? { ...s.user, ...updates } : null,
      })),
      resetOnboarding: () => {
        // Clear persisted storage first so persist middleware doesn't re-write stale data
        localStorage.removeItem('shelf-life-storage-v2');
        // Drop any queued offline writes so they can't replay under a different
        // account that signs in on this device next.
        clearOutbox();
        resetAvoChatSession();
        set({
          user: null,
          supabaseUserId: null,
          household: null,
          oauthNewUser: null,
          pantryItems: [],
          wasteLogs: [],
          recipes: [],
          browseRecipes: BROWSE_RECIPES,
          shoppingLists: [],
          mealPlan: [],
          activeTab: 'pantry',
          addItemMode: null,
          recipeSearchSeed: null,
          theme: 'light',
          showSettings: false,
          avoAiConsent: null,
          mealPlanAutopilot: false,
          mealPlanAutopilotWeek: null,
          notificationsEnabled: null,
          hasSeenTutorial: false,
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
          // Reschedule when the expiry changes OR the name changes — a rename
          // otherwise leaves the old name frozen in the reminder body
          // ("Your Milk expires soon" after renaming Milk → Oat Milk).
          if (updates.expirationDate !== undefined || updates.name !== undefined) {
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
      upsertPantryItemLocal: (item) => {
        const { notificationsEnabled, user, pantryItems } = useStore.getState();
        const existing = pantryItems.find(i => i.id === item.id);
        set((s) => {
          const idx = s.pantryItems.findIndex(i => i.id === item.id);
          if (idx === -1) return { pantryItems: [...s.pantryItems, item] };
          const next = s.pantryItems.slice();
          next[idx] = item;
          return { pantryItems: next };
        });
        // Schedule expiry reminders on THIS device too, so every household member
        // is reminded — not just whoever added the item. Only (re)schedule when
        // the item is new or its expiry changed, so idempotent realtime echoes
        // (including this device's own writes) don't churn notifications.
        if (notificationsEnabled && item.expirationDate &&
            (!existing || existing.expirationDate !== item.expirationDate)) {
          void rescheduleItemNotifications(item, user?.name);
        }
      },
      removePantryItemLocal: (id) => {
        set((s) => ({ pantryItems: s.pantryItems.filter(i => i.id !== id) }));
        // A member removed a shared item — drop its reminders on this device too.
        void cancelItemNotifications(id);
      },
      clearPantry: () => {
        // Cancel only the per-item expiry reminders for the items being cleared
        // — NOT cancelAllNotifications, which would also wipe the streak-
        // protection, re-engagement, recipe-nudge and milestone reminders.
        // Emptying the pantry shouldn't tear down the engagement schedule.
        const { pantryItems } = useStore.getState();
        set({ pantryItems: [] });
        for (const item of pantryItems) void cancelItemNotifications(item.id);
      },

      addWasteLog: (log) => {
        const { supabaseUserId, household } = useStore.getState();
        // Attribute the entry to its author so the household leaderboard can
        // credit it. syncWasteLog already persists user_id server-side.
        const stamped: WasteLog = supabaseUserId ? { ...log, userId: log.userId ?? supabaseUserId } : log;
        if (supabaseUserId) syncWasteLog(stamped, supabaseUserId, household?.id);
        const prevStreak = useStore.getState().user?.streakDays ?? 0;
        let profileUpdates: { streak_days: number; last_active_date: string } | null = null;
        set((s) => {
          if (!s.user) return { wasteLogs: [...s.wasteLogs, stamped] };
          const today = formatLocalDate(new Date());
          const yesterday = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return formatLocalDate(d);
          })();
          let { streakDays, lastActiveDate } = s.user;
          if (log.action === 'tossed') {
            streakDays = 0;
          } else {
            if (lastActiveDate !== today) {
              streakDays = lastActiveDate === yesterday ? streakDays + 1 : 1;
            } else if (streakDays === 0) {
              // Same-day recovery: a toss earlier today reset the streak to 0.
              // Saving food again rebuilds it to 1 rather than leaving it stuck
              // at 0 until tomorrow — one good action shouldn't be wasted.
              streakDays = 1;
            }
            lastActiveDate = today;
          }
          profileUpdates = {
            streak_days: streakDays,
            last_active_date: lastActiveDate,
          };
          return {
            wasteLogs: [...s.wasteLogs, stamped],
            user: { ...s.user, streakDays, lastActiveDate },
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
          // Only celebrate when the streak actually advanced into a milestone in
          // THIS log — otherwise a second/third save on a milestone day would
          // re-fire the same "N-day!" push.
          if (user.streakDays !== prevStreak && [3, 7, 14, 30, 50, 100, 365].includes(user.streakDays)) {
            void celebrateStreakMilestone(user.streakDays);
          }
          void scheduleReEngagement(user.name);
          if (log.action === 'eaten') {
            // They actually consumed food — refresh the recipe nudge so we
            // don't bug them about cooking right after a successful meal.
            void scheduleRecipeNudge(user.name);
          }
        }

        // Ask for an App Store rating at a genuine high point: the first time
        // they hit a meaningful zero-waste streak milestone. Once only (the OS
        // also rate-limits), and independent of notification permission.
        const after = useStore.getState();
        if (!after.reviewPrompted && after.user && [7, 14, 30, 50, 100, 365].includes(after.user.streakDays)) {
          after.setReviewPrompted();
          void requestInAppReview();
        }
      },
      addWasteLogLocal: (log) => set((s) => (
        // Dedupe by id: the originating device already appended this log, and
        // realtime echoes it back to everyone (including the sender).
        s.wasteLogs.some(l => l.id === log.id)
          ? {}
          : { wasteLogs: [...s.wasteLogs, log] }
      )),

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
        const { supabaseUserId } = useStore.getState();
        let nextUser: User | null = null;
        // When a user reaches Pro without ever having started the free Avo
        // trial, stamp it "used" (a long-past sentinel date, so isAvoTrialActive
        // reads false). Otherwise cancelling Pro later would satisfy the lazy
        // "not pro && never started a trial" check and hand them a fresh free
        // week every time they cancel.
        const markTrialUsed = tier === 'pro';
        set((s) => {
          if (!s.user) { nextUser = null; return { user: null }; }
          const avoTrialStartedAt = markTrialUsed && !s.user.avoTrialStartedAt
            ? TRIAL_USED_SENTINEL
            : s.user.avoTrialStartedAt;
          nextUser = { ...s.user, subscriptionTier: tier, avoTrialStartedAt };
          return { user: nextUser };
        });
        if (supabaseUserId && nextUser) {
          // Awaited so the cloud write can't be orphaned by a sign-out or
          // navigation that happens immediately after an upgrade/cancel.
          await syncProfileUpdates(supabaseUserId, {
            subscription_tier: tier,
            avo_trial_started_at: (nextUser as User).avoTrialStartedAt,
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
          lastChargedBucket = 'pro';
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
        lastChargedBucket = 'free';
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
        // Refund the counter that was ACTUALLY charged for this request, not
        // whichever bucket the user's status maps to now — the two can differ if
        // Pro/trial status flipped between charging and refunding, which would
        // otherwise silently drain a free chat.
        const bucket = lastChargedBucket;
        lastChargedBucket = null;
        if (!bucket) return;
        const nextUser = bucket === 'pro'
          ? { ...s.user, avoChatCount: Math.max(0, s.user.avoChatCount - 1) }
          : { ...s.user, avoFreeChatsUsed: Math.max(0, (s.user.avoFreeChatsUsed ?? 0) - 1) };
        set({ user: nextUser });
        if (s.supabaseUserId) {
          syncProfileUpdates(s.supabaseUserId, bucket === 'pro'
            ? { avo_chat_count: nextUser.avoChatCount }
            : { avo_free_chats_used: nextUser.avoFreeChatsUsed },
          ).catch(debug.error);
        }
      },
      canAddPantryItem: (): boolean => {
        const s = useStore.getState();
        if (!s.user) return false;
        if (s.user.subscriptionTier === 'pro') return true;
        // Free MEMBERS ride the Pro owner's unlimited pantry (owner Pro is
        // enforced server-side at creation). But a free OWNER is not exempt —
        // otherwise someone could subscribe, create a household, cancel Pro, and
        // keep an unlimited solo pantry forever.
        if (s.household && s.household.role === 'member') return true;
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
      setMealPlanAutopilot: (on) => set({ mealPlanAutopilot: on }),
      setMealPlanAutopilotWeek: (week) => set({ mealPlanAutopilotWeek: week }),
      setReviewPrompted: () => set({ reviewPrompted: true }),
      setNotificationsEnabled: (enabled) => {
        set({ notificationsEnabled: enabled });
        const { pantryItems, user } = useStore.getState();
        if (enabled) {
          void rescheduleAllNotifications({
            items: pantryItems,
            streakDays: user?.streakDays ?? 0,
            userName: user?.name,
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
        return { ...current, ...p };
      },
      partialize: (state) => ({
        user: state.user,
        household: state.household,
        pantryItems: state.pantryItems,
        wasteLogs: state.wasteLogs,
        recipes: state.recipes,
        shoppingLists: state.shoppingLists,
        mealPlan: state.mealPlan,
        theme: state.theme,
        avoAiConsent: state.avoAiConsent,
        mealPlanAutopilot: state.mealPlanAutopilot,
        mealPlanAutopilotWeek: state.mealPlanAutopilotWeek,
        reviewPrompted: state.reviewPrompted,
        notificationsEnabled: state.notificationsEnabled,
        hasSeenTutorial: state.hasSeenTutorial,
      }),
    }
  )
);
