import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { PantryItem } from '../types';
import * as debug from './debug';

// ── Avo's voice — friendly Duolingo energy ──────────────────────────────────
//
// Tone goals: warm, encouraging, on-the-user's-team. Slightly playful but never
// shame-y. Avo (the avocado mascot) is a cheerful friend, not a guilt machine.
// Random pick from each bank keeps reminders feeling fresh.

// All copy functions take the user's first name as their first arg. If the
// name is empty (guest mode, etc.) we fall back to "friend" so the copy still
// flows naturally. Mix of name-using and name-less variants keeps the random
// rotation feeling fresh — getting "Hey, Ryan!" every single time would be
// uncanny.

// ── Expiration: 2 days before ───────────────────────────────────────────────
const TWO_DAYS_BEFORE = [
  (u: string, n: string) => ({ title: `🥑 Hey ${u}!`, body: `Your ${n} has 2 days left — what should we cook?` }),
  (u: string, n: string) => ({ title: '👋 Just a heads up', body: `Your ${n} expires in 2 days, ${u}. Plenty of time to plan something tasty!` }),
  (_u: string, n: string) => ({ title: '🥑 Avo here', body: `Your ${n} has 2 days left. Want a recipe idea?` }),
  (u: string, n: string) => ({ title: 'Quick note 💚', body: `Hey ${u}, your ${n} expires in 2 days. Let's give it a happy ending!` }),
  (_u: string, n: string) => ({ title: '🥑 No pressure!', body: `Your ${n} has 2 days left. We can totally use it up.` }),
  (u: string, n: string) => ({ title: `🌿 Psst, ${u}`, body: `Your ${n} expires in 2 days. Save it from the bin?` }),
  (_u: string, n: string) => ({ title: '🥑 Checking in', body: `Your ${n} has 2 days left — Avo's got faith in you.` }),
];

// ── Expiration: 1 day before ────────────────────────────────────────────────
const ONE_DAY_BEFORE = [
  (u: string, n: string) => ({ title: `🥑 ${u}, tomorrow's the day!`, body: `Your ${n} expires tomorrow — let's give it the spotlight 🌟` }),
  (_u: string, n: string) => ({ title: 'Avo says hi 👋', body: `Your ${n} expires tomorrow! Got 5 minutes for a quick recipe?` }),
  (u: string, n: string) => ({ title: '💚 Quick heads up', body: `Hey ${u}, your ${n} won't make it past tomorrow. Need help cooking it?` }),
  (u: string, n: string) => ({ title: `🥑 ${u}, listen…`, body: `Your ${n} expires tomorrow. We can do this together!` }),
  (_u: string, n: string) => ({ title: 'One day to go ⏳', body: `Your ${n} is on its last day tomorrow. Avo's rooting for it!` }),
  (u: string, n: string) => ({ title: '🥑 Tomorrow\'s the deadline', body: `${u}, your ${n} expires tomorrow. Let's make a plan together!` }),
  (_u: string, n: string) => ({ title: 'Last call vibes 🌅', body: `Your ${n} expires tomorrow — time to shine ✨` }),
];

// ── Expiration: day of ──────────────────────────────────────────────────────
const DAY_OF = [
  (u: string, n: string) => ({ title: `🥑 ${u}, it's go time!`, body: `Your ${n} expires today. You've got this!` }),
  (_u: string, n: string) => ({ title: 'Today\'s the day 💚', body: `Your ${n} expires today. Let's give it a great send-off.` }),
  (u: string, n: string) => ({ title: `Avo believes in you, ${u}`, body: `Your ${n} expires today — quick! What's for dinner?` }),
  (_u: string, n: string) => ({ title: '🥑 Last call!', body: `Your ${n} expires today. One quick meal can save it ✨` }),
  (u: string, n: string) => ({ title: 'Final stretch! 🏁', body: `${u}, your ${n} expires today. Cook it, freeze it, anything goes!` }),
  (_u: string, n: string) => ({ title: '🌿 It\'s now or never', body: `Your ${n} expires today. Let's do this!` }),
  (u: string, n: string) => ({ title: '🥑 Hero hour', body: `${u}, your ${n} expires today. Be its hero?` }),
];

// ── "Did you finish it?" check-in (fires the morning AFTER expiry) ──────────
// Closes the loop on a dated item: gently asks the user to log whether it got
// eaten or tossed, which cuts silently-forgotten waste and feeds better data
// back into stats + Shopping Radar.
const FINISHED_CHECK_IN = [
  (_u: string, n: string) => ({ title: '🥑 Did you finish it?', body: `Your ${n} hit its date — did you eat it or toss it? Tap to log it.` }),
  (u: string, n: string) => ({ title: `Quick check-in, ${u} 💚`, body: `How'd your ${n} do? Let Avo know if it was eaten or tossed.` }),
  (_u: string, n: string) => ({ title: '🥑 Eat it or toss it?', body: `Your ${n} was due. Log the outcome so Avo can track your wins.` }),
  (u: string, n: string) => ({ title: '🌿 One quick tap', body: `${u}, did your ${n} get used up? Tell Avo — it sharpens your stats.` }),
];

// ── Streak protection (fires 7pm if streak at risk) ─────────────────────────
const STREAK_PROTECTION = [
  (_u: string, s: number) => ({ title: `🔥 Your ${s}-day streak!`, body: `Don't break it now — log a meal before midnight 💚` }),
  (u: string, s: number) => ({ title: 'Avo\'s hyping you up 🥑', body: `${s} days strong, ${u}! Keep the streak alive today.` }),
  (u: string, s: number) => ({ title: `🔥 ${u}, the streak!`, body: `${s} days of saving food. Ready for day ${s + 1}?` }),
  (u: string, s: number) => ({ title: 'Streak alert 🔔', body: `${u}, you're on day ${s}. Just one log to keep it rolling!` }),
  (_u: string, s: number) => ({ title: '🥑 We\'ve come so far!', body: `${s} days strong — let's not let today be the day.` }),
  (u: string, s: number) => ({ title: '🔥 Almost there!', body: `Day ${s} of your streak, ${u}. Avo's cheering for you!` }),
];

// ── Streak milestones (fires immediately when hit) ──────────────────────────
const STREAK_MILESTONES: Record<number, () => { title: string; body: string }> = {
  3: () => ({ title: '🔥 Three days!', body: '3 days no-waste. Avo\'s noticing 👀' }),
  7: () => ({ title: '🔥 ONE WEEK!', body: '7 days of beating food waste. Avo\'s SO proud 🥑' }),
  14: () => ({ title: '🥑 Two weeks strong!', body: '14 days no-waste. You\'re a legend 💚' }),
  30: () => ({ title: '🏆 ONE MONTH!', body: '30 days! Avo is framing this. Iconic.' }),
  50: () => ({ title: '🥑 50 days!', body: 'Half a hundred. Avo can\'t even.' }),
  100: () => ({ title: '💯 100 DAYS!!', body: '100 days no-waste. Avo\'s in tears (happy ones) 🥹' }),
  365: () => ({ title: '🌟 ONE YEAR!', body: '365 days. You\'ve changed the game. Avo bows 🙇' }),
};

// ── Re-engagement (fires after 3 days of no activity) ───────────────────────
const RE_ENGAGEMENT = [
  (u: string) => ({ title: `🥑 Avo misses you, ${u}`, body: 'Haven\'t seen you in a few days — what\'s in the fridge?' }),
  (u: string) => ({ title: `Hey ${u} 👋`, body: 'It\'s been a minute! Your pantry\'s getting curious.' }),
  (_u: string) => ({ title: '🥑 Just checking in!', body: 'Avo\'s been waiting. Got something to log?' }),
  (u: string) => ({ title: 'Hi! 💚', body: `Hey ${u}, Avo's keeping watch over your pantry. Wanna peek in?` }),
  (u: string) => ({ title: `🥑 Where'd you go, ${u}?`, body: 'Avo\'s been holding down the fort. Come say hi!' }),
  (_u: string) => ({ title: 'Pssst 👀', body: 'Avo wonders if anything new came home from the store?' }),
];

// ── Recipe idle (fires after 5 days of no cook log) ─────────────────────────
const RECIPE_NUDGE = [
  (u: string) => ({ title: `🍳 Hungry, ${u}?`, body: 'Avo\'s got recipe ideas using what\'s in your pantry right now.' }),
  (_u: string) => ({ title: '🥑 Recipe time?', body: 'It\'s been a while since you cooked. Want some inspo?' }),
  (u: string) => ({ title: 'Cooking SOS 🆘', body: `${u}, Avo can suggest a recipe in 10 seconds. Just ask!` }),
  (_u: string) => ({ title: '🍽️ Dinner ideas?', body: 'Open the app — Avo\'s got 3 recipes ready for you.' }),
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Use the user's first name only (Avo's voice is casual). Fall back to "friend"
// for guest users or anyone who hasn't set a name yet — copy still flows.
function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'friend';
  const first = fullName.trim().split(/\s+/)[0];
  return first || 'friend';
}

// ── ID generation ───────────────────────────────────────────────────────────
//
// Capacitor LocalNotifications uses integer IDs. Items are hashed; engagement
// notifications use reserved fixed IDs so they can be cancelled/rescheduled.

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100000000;
}

function notificationIdsForItem(itemId: string): { twoDays: number; oneDay: number; dayOf: number; finishCheck: number } {
  const base = hashStringToInt(itemId);
  return {
    twoDays: base * 10 + 1,
    oneDay: base * 10 + 2,
    dayOf: base * 10 + 3,
    finishCheck: base * 10 + 4,
  };
}

// Reserved IDs for engagement notifications (won't collide with item hashes
// because items max out at base * 10 + 4 < 1_000_000_000).
const ENGAGEMENT_IDS = {
  streakProtection: 1_900_000_001,
  reEngagement: 1_900_000_002,
  recipeNudge: 1_900_000_003,
  // Milestones use 1_900_001_000 + streakDays for uniqueness
  milestoneBase: 1_900_001_000,
} as const;

function milestoneId(streakDays: number): number {
  return ENGAGEMENT_IDS.milestoneBase + streakDays;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function expirationNotificationTime(expirationDate: string, daysBefore: number): Date | null {
  // 10am local on the target day
  const [y, m, d] = expirationDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d - daysBefore, 10, 0, 0, 0);
  if (target.getTime() <= Date.now() + 60_000) return null;
  return target;
}

function streakProtectionTime(): Date {
  // 7pm tomorrow local (gives the user time to log something today first,
  // then nudges them tomorrow evening if streak about to break).
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(19, 0, 0, 0);
  return t;
}

function reEngagementTime(daysFromNow: number, hour = 18): Date {
  const t = new Date();
  t.setDate(t.getDate() + daysFromNow);
  t.setHours(hour, 0, 0, 0);
  return t;
}

// ── Capacity limits ─────────────────────────────────────────────────────────
//
// iOS silently keeps only 64 pending local notifications and drops the rest.
// Each dated item schedules up to 4 reminders (2-day, 1-day, day-of, and the
// day-after "did you finish it?" check-in) and engagement adds a few fixed
// ones, so we cap how many items we schedule (soonest-expiring first) and refuse
// to schedule a single item once we're near the ceiling.

// 14 items × 4 reminders = 56, leaving headroom for engagement notifications.
export const MAX_SCHEDULED_ITEMS = 14;
// Hard ceiling for a single-item schedule check (leaves ~4 slots for engagement).
const MAX_PENDING_NOTIFICATIONS = 60;

/**
 * Given the pantry, pick the items whose reminders we should actually schedule:
 * only those with an expiration date, soonest-expiring first, capped at `max`.
 * Pure + exported so the prioritization is unit-testable.
 */
export function selectItemsToSchedule(items: PantryItem[], max: number = MAX_SCHEDULED_ITEMS): PantryItem[] {
  return items
    // Only items that still have at least one schedulable reminder left. The
    // day-after check-in (daysBefore -1) is the LAST reminder, so if even that
    // is in the past the item is fully done and shouldn't eat a slot. Long-
    // expired items would otherwise sort earliest and silently starve valid
    // upcoming items of reminder slots (expirationNotificationTime returns null
    // for past times).
    .filter(i => !!i.expirationDate && expirationNotificationTime(i.expirationDate!, -1) !== null)
    .sort((a, b) => (a.expirationDate! < b.expirationDate! ? -1 : a.expirationDate! > b.expirationDate! ? 1 : 0))
    .slice(0, max);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function ensureNotificationPermission(): Promise<boolean> {
  // On web there's no native permission gate; treat as granted so the toggle
  // works in dev/browser. Actual scheduling silently no-ops on non-native.
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    if (status.display === 'denied') return false;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch (e) {
    debug.warn('[notifications] permission check failed:', e);
    return false;
  }
}

// ── Expiration notifications ────────────────────────────────────────────────

export async function scheduleItemNotifications(item: PantryItem, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!item.expirationDate) return;

  try {
    const u = firstName(userName);
    const ids = notificationIdsForItem(item.id);
    const twoDayTime = expirationNotificationTime(item.expirationDate, 2);
    const oneDayTime = expirationNotificationTime(item.expirationDate, 1);
    const dayOfTime = expirationNotificationTime(item.expirationDate, 0);
    // Day AFTER expiry (daysBefore -1 → d + 1): the "did you finish it?" check-in.
    const finishTime = expirationNotificationTime(item.expirationDate, -1);

    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    if (twoDayTime) {
      const copy = pickRandom(TWO_DAYS_BEFORE)(u, item.name);
      toSchedule.push({ id: ids.twoDays, title: copy.title, body: copy.body, schedule: { at: twoDayTime, allowWhileIdle: true } });
    }
    if (oneDayTime) {
      const copy = pickRandom(ONE_DAY_BEFORE)(u, item.name);
      toSchedule.push({ id: ids.oneDay, title: copy.title, body: copy.body, schedule: { at: oneDayTime, allowWhileIdle: true } });
    }
    if (dayOfTime) {
      const copy = pickRandom(DAY_OF)(u, item.name);
      toSchedule.push({ id: ids.dayOf, title: copy.title, body: copy.body, schedule: { at: dayOfTime, allowWhileIdle: true } });
    }
    if (finishTime) {
      const copy = pickRandom(FINISHED_CHECK_IN)(u, item.name);
      toSchedule.push({ id: ids.finishCheck, title: copy.title, body: copy.body, schedule: { at: finishTime, allowWhileIdle: true } });
    }

    if (toSchedule.length > 0) {
      // If we're near iOS's 64-notification ceiling (e.g. a big receipt scan
      // just added many dated items), skip this item's reminders rather than
      // letting iOS silently drop an arbitrary subset. rescheduleAllNotifications
      // reconciles by soonest-expiring, so the most urgent items win.
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length + toSchedule.length > MAX_PENDING_NOTIFICATIONS) {
        debug.warn(`[notifications] near capacity (${pending.notifications.length} pending) — skipping reminders for "${item.name}"`);
        return;
      }
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    debug.warn('[notifications] schedule failed:', e);
  }
}

export async function cancelItemNotifications(itemId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const ids = notificationIdsForItem(itemId);
    await LocalNotifications.cancel({
      notifications: [{ id: ids.twoDays }, { id: ids.oneDay }, { id: ids.dayOf }, { id: ids.finishCheck }],
    });
  } catch (e) {
    debug.warn('[notifications] cancel failed:', e);
  }
}

export async function rescheduleItemNotifications(item: PantryItem, userName?: string | null): Promise<void> {
  await cancelItemNotifications(item.id);
  await scheduleItemNotifications(item, userName);
}

// ── Streak protection ───────────────────────────────────────────────────────
//
// Fires the evening of the day after the user's last activity. If they log
// again before then, we cancel + re-schedule (push it to the next evening).

export async function scheduleStreakProtection(streakDays: number, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (streakDays < 1) {
    await cancelStreakProtection();
    return;
  }
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.streakProtection }] });
    const copy = pickRandom(STREAK_PROTECTION)(firstName(userName), streakDays);
    await LocalNotifications.schedule({
      notifications: [{
        id: ENGAGEMENT_IDS.streakProtection,
        title: copy.title,
        body: copy.body,
        schedule: { at: streakProtectionTime(), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] streak protection failed:', e);
  }
}

export async function cancelStreakProtection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.streakProtection }] });
  } catch (e) {
    debug.warn('[notifications] cancel streak protection failed:', e);
  }
}

// ── Streak milestone (fires immediately, with small delay so app can close) ──

export async function celebrateStreakMilestone(streakDays: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const builder = STREAK_MILESTONES[streakDays];
  if (!builder) return;
  try {
    const copy = builder();
    const at = new Date(Date.now() + 30_000); // 30 seconds out — feels like a delight after closing the app
    await LocalNotifications.schedule({
      notifications: [{
        id: milestoneId(streakDays),
        title: copy.title,
        body: copy.body,
        schedule: { at, allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] milestone failed:', e);
  }
}

// ── Re-engagement (3 days idle) ─────────────────────────────────────────────

export async function scheduleReEngagement(userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.reEngagement }] });
    const copy = pickRandom(RE_ENGAGEMENT)(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{
        id: ENGAGEMENT_IDS.reEngagement,
        title: copy.title,
        body: copy.body,
        schedule: { at: reEngagementTime(3, 18), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] re-engagement failed:', e);
  }
}

// ── Recipe nudge (5 days no cook log) ───────────────────────────────────────

export async function scheduleRecipeNudge(userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.recipeNudge }] });
    const copy = pickRandom(RECIPE_NUDGE)(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{
        id: ENGAGEMENT_IDS.recipeNudge,
        title: copy.title,
        body: copy.body,
        schedule: { at: reEngagementTime(5, 17), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] recipe nudge failed:', e);
  }
}

// ── Cancel-all + reschedule-all (for toggle on/off) ─────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      });
    }
  } catch (e) {
    debug.warn('[notifications] cancel all failed:', e);
  }
}

interface RescheduleContext {
  items: PantryItem[];
  streakDays: number;
  userName?: string | null;
}

export async function rescheduleAllNotifications(ctx: RescheduleContext): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await cancelAllNotifications();
  // Only schedule the soonest-expiring items so we stay under iOS's 64-pending
  // ceiling. Items beyond the cap (further-out expirations) are intentionally
  // skipped — they'll get reminders once nearer items are consumed and this
  // reconcile runs again.
  const toSchedule = selectItemsToSchedule(ctx.items);
  if (toSchedule.length < ctx.items.filter(i => i.expirationDate).length) {
    debug.warn(`[notifications] scheduling soonest ${toSchedule.length} dated items (capacity cap)`);
  }
  for (const item of toSchedule) {
    await scheduleItemNotifications(item, ctx.userName);
  }
  await scheduleStreakProtection(ctx.streakDays, ctx.userName);
  await scheduleReEngagement(ctx.userName);
  await scheduleRecipeNudge(ctx.userName);
}
