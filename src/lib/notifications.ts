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

// ── Leftovers — used in place of the generic expiration banks when an item
// looks like leftovers / cooked food, so the copy feels specific ────────────
const LEFTOVER_RE = /leftover|cooked |soup|stew|chili|casserole|curry/i;
function isLeftover(name: string): boolean {
  return LEFTOVER_RE.test(name);
}
const LEFTOVER_SOON = [
  (u: string, n: string) => ({ title: '🍲 Leftover check-in', body: `Hey ${u}, those ${n} won't keep forever — let's finish them soon!` }),
  (_u: string, n: string) => ({ title: '🥑 Don\'t forget the leftovers', body: `Your ${n} are waiting in the fridge. Lunch sorted?` }),
  (u: string, n: string) => ({ title: '🍱 Leftovers calling', body: `${u}, your ${n} are best eaten in the next day or two!` }),
];

// ── Expired-but-unlogged (fires the morning AFTER the expiration date) ───────
const EXPIRED_UNLOGGED = [
  (u: string, n: string) => ({ title: '🥑 Did it make it?', body: `Your ${n} hit its date, ${u}. Tap to log whether you saved it or tossed it 💚` }),
  (_u: string, n: string) => ({ title: 'Quick question 🤔', body: `Did your ${n} get eaten? Logging it keeps your impact honest.` }),
  (u: string, n: string) => ({ title: '📋 One to log', body: `${u}, your ${n} expired yesterday. Eaten, frozen, or tossed? Tap to tell Avo.` }),
];

// ── Impact money milestones — relatable framing, not abstract stats ──────────
const MONEY_MILESTONES: Record<number, () => { title: string; body: string }> = {
  25:   () => ({ title: '💚 $25 saved!', body: 'That\'s a nice dinner out — rescued from your own fridge 🍝' }),
  50:   () => ({ title: '🎉 $50 saved with Pantre', body: 'Fifty dollars kept out of the trash. Avo\'s proud 🥑' }),
  100:  () => ({ title: '💯 $100 saved!', body: 'About a week of groceries’ worth of food — saved, not wasted 🛒' }),
  250:  () => ({ title: '🌟 $250 saved', body: 'Real money back in your pocket. You\'re crushing waste 💪' }),
  500:  () => ({ title: '🏆 $500 saved!', body: 'Half a grand. Avo is genuinely emotional right now 🥹' }),
  1000: () => ({ title: '👑 $1,000 saved!!', body: 'One THOUSAND dollars rescued from the bin. Iconic 🥑👑' }),
};
const MONEY_THRESHOLDS = [25, 50, 100, 250, 500, 1000];

// ── Evening cook nudge — fires ~5pm so there's time to cook before the ~6:18pm
// average US dinner. Names a real recipe when one matches expiring food, else
// falls back to the single most at-risk item. ───────────────────────────────
const COOK_NUDGE_ITEM = [
  (u: string, n: string) => ({ title: '🍳 Dinner idea?', body: `${u}, your ${n} would be perfect tonight before it turns. Ask Avo for a recipe!` }),
  (_u: string, n: string) => ({ title: '🥑 Use it tonight', body: `That ${n} is getting close — let's give it a delicious ending.` }),
  (u: string, n: string) => ({ title: '🌿 One to rescue', body: `Hey ${u}, your ${n} could use you tonight. Avo's got ideas in 10 seconds.` }),
];
const COOK_NUDGE_RECIPE = [
  (u: string, r: string) => ({ title: '🍳 Dinner\'s basically sorted', body: `${u}, you've got everything for ${r} — perfect for tonight!` }),
  (_u: string, r: string) => ({ title: '🥑 Tonight\'s pick', body: `${r} uses what's in your pantry right now. Want the steps?` }),
  (u: string, r: string) => ({ title: `🌿 ${r} tonight?`, body: `Everything's in your kitchen already, ${u}. Avo can walk you through it.` }),
];

// ── Avo chat discovery — nighttime only (local 8pm) ──────────────────────────
const AVO_CHAT_NIGHT = [
  (u: string) => ({ title: `🌙 Stuck on dinner, ${u}?`, body: 'Just ask Avo — I\'ll build a recipe from exactly what\'s in your pantry 💬' }),
  (_u: string) => ({ title: '🥑 Avo\'s a night owl', body: 'Late-night fridge raid? Tell Avo what you\'ve got and get an instant idea 💬' }),
];

// ── Grocery day reminder — weekly, user-chosen day, local 5pm ────────────────
const GROCERY_DAY = [
  (u: string) => ({ title: '🛒 Grocery day!', body: `Heading to the store, ${u}? Check your Pantre list first so nothing doubles up.` }),
  (_u: string) => ({ title: '🥑 Shopping time', body: 'Before you shop — peek at what\'s already in your pantry to skip the repeats!' }),
];

// ── Pro-member perks — rewards for people who already pay, never an upsell ───
const PRO_WEEKLY_REPORT = [
  (u: string) => ({ title: '📊 Your Pro weekly report', body: `${u}, your full impact breakdown is ready — savings, waste rate, and your best wins this week.` }),
  (_u: string) => ({ title: '🥑 This week, in detail', body: 'Your Pro impact report just dropped. See exactly where you crushed it 📊' }),
];
const PRO_MEALPLAN_READY = [
  (u: string) => ({ title: '📋 Your week, planned', body: `Morning ${u}! Avo lined up this week's meals around what's in your pantry. Take a look.` }),
  (_u: string) => ({ title: '🥑 Meal plan ready', body: 'Avo planned your week from your pantry. One less thing to think about 💚' }),
];
const PRO_SHOPPING_READY = [
  (u: string) => ({ title: '🛒 Shopping list, auto-built', body: `${u}, Avo turned your meal plan into a ready-to-go shopping list. Tap to review.` }),
  (_u: string) => ({ title: '🥑 List\'s ready', body: 'Your Pro shopping list built itself from this week\'s plan 🛒' }),
];
const PRO_TOMORROW_PLAN = [
  (u: string) => ({ title: '🌙 Tomorrow\'s dinner is sorted', body: `Rest easy, ${u} — Avo's already got tomorrow's meal planned from your pantry.` }),
  (_u: string) => ({ title: '🥑 Tomorrow\'s handled', body: 'Avo lined up tomorrow\'s dinner. Sleep easy 🌙' }),
];
const PRO_CHAT_REFILL = [
  (u: string) => ({ title: '💬 Your 20 Avo chats refreshed', body: `Fresh batch ready, ${u} — ask Avo anything about tonight's cooking.` }),
  (_u: string) => ({ title: '🥑 Chats topped up', body: 'Your daily Avo chats just reset to 20. Cook away 💬' }),
];
const PRO_RECIPE_PACK = (name: string) => [
  (u: string) => ({ title: '🍳 New recipes — you get them first', body: `${u}, the "${name}" recipe pack just landed for Pro members. Dig in!` }),
  (_u: string) => ({ title: `🥑 "${name}" is here`, body: 'A fresh recipe pack just dropped — Pro members get early access 🍳' }),
];
const PRO_ANNIVERSARY = (years: number) => [
  (u: string) => ({ title: `🎉 ${years} year${years === 1 ? '' : 's'} of Pantre Pro!`, body: `Thank you for being here, ${u}. Here's to everything you've saved 🥑💚` }),
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

function notificationIdsForItem(itemId: string): { twoDays: number; oneDay: number; dayOf: number; expiredCheck: number } {
  const base = hashStringToInt(itemId);
  return {
    twoDays: base * 10 + 1,
    oneDay: base * 10 + 2,
    dayOf: base * 10 + 3,
    expiredCheck: base * 10 + 4,
  };
}

// Reserved IDs for engagement notifications (won't collide with item hashes
// because items max out at base * 10 + 3 < 1_000_000_000).
const ENGAGEMENT_IDS = {
  streakProtection: 1_900_000_001,
  reEngagement: 1_900_000_002,
  recipeNudge: 1_900_000_003,
  weeklyDigest: 1_900_000_004,
  groceryReminder: 1_900_000_005,
  avoChatNight: 1_900_000_006,
  cookNudge: 1_900_000_007,
  // Pro-member perks
  proWeeklyReport: 1_900_000_008,
  proMealPlan: 1_900_000_009,
  proShopping: 1_900_000_010,
  proTomorrow: 1_900_000_011,
  proChatRefill: 1_900_000_012,
  recipePack: 1_900_000_013,
  proAnniversary: 1_900_000_014,
  // Streak milestones use 1_900_001_000 + streakDays for uniqueness
  milestoneBase: 1_900_001_000,
  // Money milestones use 1_900_002_000 + dollar-threshold for uniqueness
  moneyMilestoneBase: 1_900_002_000,
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

// Today at the given local time, or tomorrow if that time has already passed.
function eveningTime(hour: number, minute = 0): Date {
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now() + 60_000) t.setDate(t.getDate() + 1);
  return t;
}

// The next upcoming Sunday at 6pm local (never today — always the next one).
function nextWeeklyDigestTime(): Date {
  return nextWeekdayTime(0, 18, 0);
}

// The next upcoming occurrence of a given weekday (0=Sun…6=Sat) at hour:minute,
// always in the future (never fires "now" if today already matches).
function nextWeekdayTime(weekday: number, hour: number, minute = 0): Date {
  const t = new Date();
  let delta = (weekday - t.getDay() + 7) % 7;
  t.setDate(t.getDate() + delta);
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now() + 60_000) { t.setDate(t.getDate() + 7); delta += 7; }
  return t;
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
    const leftover = isLeftover(item.name);
    const twoDayTime = expirationNotificationTime(item.expirationDate, 2);
    const oneDayTime = expirationNotificationTime(item.expirationDate, 1);
    const dayOfTime = expirationNotificationTime(item.expirationDate, 0);
    // Negative daysBefore → the morning AFTER the expiration date.
    const expiredTime = expirationNotificationTime(item.expirationDate, -1);

    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    if (twoDayTime) {
      const copy = (leftover ? pickRandom(LEFTOVER_SOON) : pickRandom(TWO_DAYS_BEFORE))(u, item.name);
      toSchedule.push({ id: ids.twoDays, title: copy.title, body: copy.body, schedule: { at: twoDayTime, allowWhileIdle: true } });
    }
    if (oneDayTime) {
      const copy = (leftover ? pickRandom(LEFTOVER_SOON) : pickRandom(ONE_DAY_BEFORE))(u, item.name);
      toSchedule.push({ id: ids.oneDay, title: copy.title, body: copy.body, schedule: { at: oneDayTime, allowWhileIdle: true } });
    }
    if (dayOfTime) {
      const copy = (leftover ? pickRandom(LEFTOVER_SOON) : pickRandom(DAY_OF))(u, item.name);
      toSchedule.push({ id: ids.dayOf, title: copy.title, body: copy.body, schedule: { at: dayOfTime, allowWhileIdle: true } });
    }
    if (expiredTime) {
      const copy = pickRandom(EXPIRED_UNLOGGED)(u, item.name);
      toSchedule.push({ id: ids.expiredCheck, title: copy.title, body: copy.body, schedule: { at: expiredTime, allowWhileIdle: true } });
    }

    if (toSchedule.length > 0) {
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
      notifications: [{ id: ids.twoDays }, { id: ids.oneDay }, { id: ids.dayOf }, { id: ids.expiredCheck }],
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

// ── Impact money milestone (fires immediately when a $ threshold is crossed) ──

/** Returns the dollar threshold just crossed (prev < t ≤ next), or null. */
export function crossedMoneyMilestone(prev: number, next: number): number | null {
  return MONEY_THRESHOLDS.find(t => prev < t && next >= t) ?? null;
}

export async function celebrateMoneyMilestone(threshold: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const builder = MONEY_MILESTONES[threshold];
  if (!builder) return;
  try {
    const copy = builder();
    await LocalNotifications.schedule({
      notifications: [{
        id: ENGAGEMENT_IDS.moneyMilestoneBase + threshold,
        title: copy.title,
        body: copy.body,
        schedule: { at: new Date(Date.now() + 30_000), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] money milestone failed:', e);
  }
}

// ── Weekly digest (recap + freshness outlook), fires Sunday evening ──────────

interface WeeklyDigestContext {
  savedThisWeek: number;
  expiringNextWeek: number;
  userName?: string | null;
}

export async function scheduleWeeklyDigest(ctx: WeeklyDigestContext): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.weeklyDigest }] });
    const u = firstName(ctx.userName);
    const saved = Math.round(ctx.savedThisWeek);
    let title: string;
    let body: string;
    if (ctx.expiringNextWeek === 0) {
      title = '🥑 Fridge looking fresh!';
      body = saved > 0
        ? `Nothing expiring next week, ${u} — and you saved $${saved} this week. On top of it! ✨`
        : `Nothing expiring next week, ${u}. Your pantry's in great shape ✨`;
    } else {
      title = `🌿 Your week ahead, ${u}`;
      const savedLine = saved > 0 ? `You saved $${saved} this week. ` : '';
      body = `${savedLine}${ctx.expiringNextWeek} item${ctx.expiringNextWeek === 1 ? '' : 's'} need you in the next 7 days — let's plan!`;
    }
    await LocalNotifications.schedule({
      notifications: [{ id: ENGAGEMENT_IDS.weeklyDigest, title, body, schedule: { at: nextWeeklyDigestTime(), allowWhileIdle: true } }],
    });
  } catch (e) {
    debug.warn('[notifications] weekly digest failed:', e);
  }
}

// ── Evening cook nudge — names a real recipe if one matches expiring food,
// else the single most at-risk item. Fires 5pm so there's time to cook. ──────

interface CookNudgeTarget {
  recipeName?: string | null;
  itemName?: string | null;
}

export async function scheduleCookNudge(target: CookNudgeTarget, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.cookNudge }] });
    const u = firstName(userName);
    let copy: { title: string; body: string } | null = null;
    if (target.recipeName) {
      copy = pickRandom(COOK_NUDGE_RECIPE)(u, target.recipeName);
    } else if (target.itemName) {
      copy = pickRandom(COOK_NUDGE_ITEM)(u, target.itemName);
    }
    if (!copy) return; // nothing at risk → don't nag
    await LocalNotifications.schedule({
      notifications: [{ id: ENGAGEMENT_IDS.cookNudge, title: copy.title, body: copy.body, schedule: { at: eveningTime(17, 0), allowWhileIdle: true } }],
    });
  } catch (e) {
    debug.warn('[notifications] cook nudge failed:', e);
  }
}

// ── Pro-member perks — only scheduled for Pro users, never an upsell ─────────

export async function schedulePremiumPerks(isPro: boolean, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const ids = [
    ENGAGEMENT_IDS.proWeeklyReport,
    ENGAGEMENT_IDS.proMealPlan,
    ENGAGEMENT_IDS.proShopping,
    ENGAGEMENT_IDS.proTomorrow,
    ENGAGEMENT_IDS.proChatRefill,
  ];
  try {
    // Always clear first so perks vanish immediately if a user downgrades.
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
    if (!isPro) return;
    const u = firstName(userName);
    const report = pickRandom(PRO_WEEKLY_REPORT)(u);
    const meal = pickRandom(PRO_MEALPLAN_READY)(u);
    const shop = pickRandom(PRO_SHOPPING_READY)(u);
    const tomorrow = pickRandom(PRO_TOMORROW_PLAN)(u);
    const refill = pickRandom(PRO_CHAT_REFILL)(u);
    await LocalNotifications.schedule({
      notifications: [
        // Sunday 9am — weekly impact report
        { id: ENGAGEMENT_IDS.proWeeklyReport, title: report.title, body: report.body, schedule: { on: { weekday: 1, hour: 9, minute: 0 }, allowWhileIdle: true } },
        // Monday 9am — the week's meal plan is ready
        { id: ENGAGEMENT_IDS.proMealPlan, title: meal.title, body: meal.body, schedule: { on: { weekday: 2, hour: 9, minute: 0 }, allowWhileIdle: true } },
        // Saturday 10am — auto-built shopping list
        { id: ENGAGEMENT_IDS.proShopping, title: shop.title, body: shop.body, schedule: { on: { weekday: 7, hour: 10, minute: 0 }, allowWhileIdle: true } },
        // Nightly 8:30pm — tomorrow's dinner is planned
        { id: ENGAGEMENT_IDS.proTomorrow, title: tomorrow.title, body: tomorrow.body, schedule: { on: { hour: 20, minute: 30 }, allowWhileIdle: true } },
        // Daily 9am — chats refreshed
        { id: ENGAGEMENT_IDS.proChatRefill, title: refill.title, body: refill.body, schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true } },
      ],
    });
  } catch (e) {
    debug.warn('[notifications] premium perks failed:', e);
  }
}

/**
 * Fire when a new recipe pack is released to a Pro member (called by the
 * recipe-drop check on app launch — see `recipe_packs` content system).
 */
export async function celebrateRecipePack(packName: string, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const copy = pickRandom(PRO_RECIPE_PACK(packName))(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{ id: ENGAGEMENT_IDS.recipePack, title: copy.title, body: copy.body, schedule: { at: new Date(Date.now() + 30_000), allowWhileIdle: true } }],
    });
  } catch (e) {
    debug.warn('[notifications] recipe pack failed:', e);
  }
}

/** Fire on a Pro member's subscription anniversary (needs the Pro-start date). */
export async function celebrateProAnniversary(years: number, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (years < 1) return;
  try {
    const copy = pickRandom(PRO_ANNIVERSARY(years))(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{ id: ENGAGEMENT_IDS.proAnniversary, title: copy.title, body: copy.body, schedule: { at: new Date(Date.now() + 30_000), allowWhileIdle: true } }],
    });
  } catch (e) {
    debug.warn('[notifications] pro anniversary failed:', e);
  }
}

// ── Avo chat discovery — nighttime only, only while the user hasn't chatted ──

export async function scheduleAvoChatNight(shouldSchedule: boolean, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.avoChatNight }] });
    if (!shouldSchedule) return;
    const copy = pickRandom(AVO_CHAT_NIGHT)(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{ id: ENGAGEMENT_IDS.avoChatNight, title: copy.title, body: copy.body, schedule: { at: eveningTime(20, 0), allowWhileIdle: true } }],
    });
  } catch (e) {
    debug.warn('[notifications] avo chat night failed:', e);
  }
}

// ── Grocery day reminder — repeats weekly on the user's chosen day at 5pm ─────

export async function scheduleGroceryReminder(weekday: number | null, userName?: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.groceryReminder }] });
    if (weekday === null) return; // 0 = Sunday … 6 = Saturday; null = off
    const copy = pickRandom(GROCERY_DAY)(firstName(userName));
    await LocalNotifications.schedule({
      notifications: [{
        id: ENGAGEMENT_IDS.groceryReminder,
        title: copy.title,
        body: copy.body,
        // Capacitor weekday is 1 = Sunday … 7 = Saturday. `on` repeats weekly.
        schedule: { on: { weekday: weekday + 1, hour: 17, minute: 0 }, allowWhileIdle: true },
      }],
    });
  } catch (e) {
    debug.warn('[notifications] grocery reminder failed:', e);
  }
}

export async function cancelGroceryReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ENGAGEMENT_IDS.groceryReminder }] });
  } catch (e) {
    debug.warn('[notifications] cancel grocery reminder failed:', e);
  }
}

interface RescheduleContext {
  items: PantryItem[];
  streakDays: number;
  userName?: string | null;
  savedThisWeek?: number;
  expiringNextWeek?: number;
  cookRecipeName?: string | null;
  cookItemName?: string | null;
  avoChatUnused?: boolean;
  groceryWeekday?: number | null;
  isPro?: boolean;
}

export async function rescheduleAllNotifications(ctx: RescheduleContext): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await cancelAllNotifications();
  for (const item of ctx.items) {
    await scheduleItemNotifications(item, ctx.userName);
  }
  await scheduleStreakProtection(ctx.streakDays, ctx.userName);
  await scheduleReEngagement(ctx.userName);
  await scheduleRecipeNudge(ctx.userName);
  await scheduleWeeklyDigest({
    savedThisWeek: ctx.savedThisWeek ?? 0,
    expiringNextWeek: ctx.expiringNextWeek ?? 0,
    userName: ctx.userName,
  });
  await scheduleCookNudge({ recipeName: ctx.cookRecipeName ?? null, itemName: ctx.cookItemName ?? null }, ctx.userName);
  await scheduleAvoChatNight(ctx.avoChatUnused ?? false, ctx.userName);
  await scheduleGroceryReminder(ctx.groceryWeekday ?? null, ctx.userName);
  await schedulePremiumPerks(ctx.isPro ?? false, ctx.userName);
}
