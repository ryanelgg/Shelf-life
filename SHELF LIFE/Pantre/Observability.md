# Pantre — Observability

← [[Pantre]]

> Sentry ✅ Done — June 4 2026. PostHog ✅ Done — June 4 2026. BetterStack ⏳ Pending. RevenueCat → Sentry ⏳ Pending.

---

## The Stack

| Tool | Purpose | Free Tier |
|---|---|---|
| **Sentry** | Error tracking + crash reporting | 5k errors/mo, 10k perf events |
| **PostHog** | Product analytics + session replay | 1M events/mo, 5k recordings |
| **Supabase built-ins** | Edge function + DB + auth logs | Already included |
| **BetterStack** | Uptime monitoring + alerting | 10 monitors, 60s checks |

---

## Day 1 — Sentry ✅ DONE (June 4 2026)

**DSN:** `https://ad598e37653f4a0efb8f5688531d9631@o4511508268449792.ingest.us.sentry.io/4511508282146816`

**What was done:**
- Installed `@sentry/react` + `@sentry/capacitor`
- Added `Sentry.init` + `SentryReact.ErrorBoundary` to `src/main.tsx`
- Added `Sentry.init` + `captureException` to all 3 edge functions
- Set `SENTRY_DSN` secret in Supabase
- Deployed all 3 edge functions with Sentry

**Alert rules to set up in Sentry dashboard (still TODO):**
- New issue → email immediately
- Same issue fires 10+ times in 1 hour → email
- Any error tagged `critical:revenuecat_sync` → SMS

---

## Day 2 — PostHog ✅ DONE (June 4 2026)

**Project Token:** `phc_qqS9Vz4xTbWKasnQb3b2HjYNTa3PuMDDj3SXeBg8bZTb`
**Project ID:** `454617`
**Region:** US Cloud

`posthog-js` installed. `posthog.init` in `src/main.tsx`. `posthog.identify` + `posthog.reset` wired in `src/App.tsx` auth handler.

**All events wired (June 4 2026):**

| Event | Where |
|---|---|
| `pantry_item_added` | `useStore.ts` `addPantryItem` — `method: barcode\|manual\|receipt` |
| `pantry_item_eaten` | `PantryScreen.tsx` `handleAction` |
| `pantry_item_wasted` | `PantryScreen.tsx` `handleAction` (tossed) |
| `barcode_scan_failed` | `BarcodeScanner.tsx` — not_found + camera error paths |
| `receipt_ocr_started` | `AddItemScreen.tsx` `processReceiptImage` |
| `receipt_ocr_succeeded` | `AddItemScreen.tsx` `processReceiptImage` |
| `receipt_ocr_failed` | `AddItemScreen.tsx` `processReceiptImage` catch |
| `avo_chat_sent` | `CookScreen.tsx` `sendMessage` |
| `paywall_viewed` | `UpgradeModal.tsx` on mount |
| `pro_purchase_started` | `UpgradeModal.tsx` upgrade button |
| `pro_purchase_completed` | ⏳ Pending — wire after RevenueCat integration |
| `notification_permission_granted` | `SettingsScreen.tsx` `handleToggleNotifications` |
| `notification_permission_denied` | `SettingsScreen.tsx` `handleToggleNotifications` |

---

## Day 3 — BetterStack ⏳ PENDING (~15 min)

Sign up at betterstack.com. Add uptime monitors for:
- `https://fynllpklhftvstxfrega.supabase.co/functions/v1/avo-chat` (HEAD, expect 200 or 401)
- `https://fynllpklhftvstxfrega.supabase.co/functions/v1/receipt-ocr`
- `pantre.app` (once DNS is live)

Settings: 60-second check interval, SMS alert to your phone.

---

## Day 4 — RevenueCat → Sentry ⏳ PENDING (critical) ⚠️

If the RevenueCat webhook fires and the Supabase Pro tier update fails, users will have paid without getting Pro access.

```typescript
try {
  // update profiles set subscription_tier = 'pro'
} catch (err) {
  Sentry.captureException(err, {
    tags: { critical: 'revenuecat_sync' },
    extra: { userId, productId, transactionId },
  });
  throw err;
}
```

The Sentry alert rule for `critical:revenuecat_sync` will fire SMS immediately.

---

## What to Skip

- **Mixpanel / Amplitude** — PostHog covers this for free
- **Datadog** — massive overkill
- **LogRocket** — PostHog has session replay
- **Crashlytics** — Sentry handles native crashes via Capacitor SDK
- **Custom log infrastructure** — Supabase dashboard logs are enough until 10k+ users
