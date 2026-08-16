// ─────────────────────────────────────────────────────────────────────────────
// Feature flags — launch-lean configuration.
//
// A single place to turn non-core features on/off without deleting code, so the
// launch build stays focused on the core loop (track → don't waste → cook) and
// the heavier extras can be switched back on later by flipping one boolean.
//
// Everything here is a build-time constant: `tsc` and the bundler tree-shake the
// gated code paths, and flipping a flag is fully reversible.
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_FLAGS = {
  /**
   * Engagement / retention notifications beyond expiry reminders — streak
   * protection, streak-milestone celebrations, re-engagement nudges, and the
   * recipe nudge. Expiration reminders (the ones that map to the core promise)
   * are always on and are NOT controlled by this flag.
   *
   * Held for launch: this retention machinery can read as spammy and needs real
   * usage data to tune. Flip to `true` to bring it back.
   */
  engagementNotifications: false,

  /**
   * Meal-Plan Autopilot (Pro) — the hands-free weekly plan + auto-built shopping
   * list. The manual "plan / what can I cook now" flow stays fully available;
   * this only hides the automatic weekly run and its toggle.
   *
   * Held for launch: repeated source of shopping-list bugs and it needs the
   * manual flow proven first. Flip to `true` to bring it back.
   */
  mealPlanAutopilot: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
