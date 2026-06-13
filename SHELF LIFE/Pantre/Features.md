# Pantre — Features

← [[Pantre]]

## ✅ Built & Shipped

### Pantry Screen
- Inventory grid with freshness color indicators (green/amber/red)
- Filter tabs: All / Fridge / Freezer / Pantry / Counter
- Sort pills
- "Expiring soon" dismissible alert card
- Floating FAB button to add items
- Quick Add (increments existing items instead of creating duplicates — was a bug, now fixed)

### Barcode Scanner
- Native iOS plugin using AVFoundation (no external dependencies)
- Stays live until it detects a barcode (Bevel-style UX)
- Local USDA FoodData Central barcode database: 454,366 entries, 34MB JSON
- Open Food Facts as fallback
- ⚠️ After each `npx cap sync ios`, must manually remove `CapacitorCommunityAppleSignIn` from `Package.swift` (cap sync re-adds it)

### Avo (AI Mascot)
- Hand-drawn, 2D illustrated avocado character
- 8 expressions: happy, excited, sleepy, surprised, wink, love, thinking, normal
- Animations: walking, bouncing, wiggling
- Tap reactions with tips
- Destructive easter egg: 4-tap "squish into guacamole splat" animation
- See [[Avo AI]] for the chat feature

### Recipes & Meal Plan (Plan Screen)
- 60+ recipes with dietary filtering (vegetarian/vegan/gluten-free/dairy-free/nut-free)
- Ingredient availability matching — shows "have/need" per recipe
- Animated bubble filter pills
- Shopping list generated from planned meals only (not all recipes — was a bug)

### Impact Screen
- Money saved, CO2 prevented, water saved
- Waste rate donut chart
- 14-day streak tracker
- Categories tracked: eaten, tossed, composted, shared

### Onboarding Flow
- Steps: name → dietary preferences → 6s animated setup screen (Avo bouncing) → Pro upsell modal → "You're all set"
- Free users re-enter onboarding at name step after signing out and back in
- Name input starts empty (not pre-filled from OAuth)

### Auth
- Sign In with Apple (native Swift plugin)
- Google Sign In (OAuth, fixed redirect URL to `com.elghazzali.shelflife://`)
- Mutex guard prevents Google Sign In browser-reopen loop (iOS delivers same deep link twice)
- Sign out: free users get data wiped + reset to onboarding; Pro users data stays in Supabase

### Settings Screen
- Email + sign-in provider display
- Display Name (editable)
- Avo AI consent toggle
- Manage Subscription deep link (Pro only)
- Support & Legal card (privacy policy, terms, contact, feedback, rate app)
- Powered By: Supabase, Anthropic, Apple, Google
- Smart sign-out / account deletion

### Account Deletion
- Confirmation modal requires typing "DELETE"
- Supabase Edge Function wipes: `pantry_items`, `waste_logs`, `profiles`, `auth.users`
- ⚠️ Must be deployed: `npx supabase functions deploy delete-account --no-verify-jwt`

### Avo AI Consent
- `AvoConsentModal` shown on first Chat tab visit
- `avoAiConsent: 'granted' | 'declined' | null` in Zustand store (persisted)
- Disabled chat input shows "Turn on Avo AI" placeholder until granted

### Receipt OCR
- Supabase Edge Function using Claude's vision API
- Extracts item names/prices from receipt photos
- ⚠️ Needs deploy + `ANTHROPIC_API_KEY` secret set

### Local Notifications
- 5 notification types via `@capacitor/local-notifications`
- Toggle in Settings → "Avo Notifications"
- See [[Technical Notes]] for full details
- ⚠️ Needs testing on real iPhone

### Freemium / Paywall
- Free: 20 pantry items, 5 Avo chats/month
- Pro: $5.99/month ("Pantre Pro")
- UpgradeModal: full-page with 6-second "Maybe later" delay
- CancelProModal: broken crown SVG animation (intentional)
- ⚠️ RevenueCat not wired — `setSubscriptionTier('pro')` just flips a local flag. See [[RevenueCat]]

## 🔧 Partially Built / Needs Work
- Receipt OCR (deployed but needs secrets set)
- Real StoreKit/RevenueCat IAP (see [[RevenueCat]])
- Account deletion Edge Function (needs deploy)
- Supabase email confirmations (needs custom SMTP via Resend)

## 💡 Planned / Nice-to-have
- Data export (GDPR portability — JSON download)
- Trademark search for "Pantre"
- App icon: finalize SVG, generate iOS asset catalog (light/dark/tinted)
- App Store screenshots (6.7" + 6.5") — mockups exist at `app-store-mockups.html`
- **Apple Health + Samsung Health integration (PLANNED — needs native build)**
  - Goal: link Pantre to HealthKit (iOS) and Samsung Health / Health Connect (Android).
  - **Open decision before building — what data flows, and which way?**
    - *Most likely:* when a user logs eating a food, write its nutrition (dietary
      energy / calories, maybe macros) to Health so meals show up there. Pantre
      → Health (write).
    - *Optional later:* read activity/calorie-burn from Health to tailor recipe
      portion suggestions. Health → Pantre (read).
  - **Why it can't be done in a web session:** requires native plugins +
    capability entitlements + on-device testing.
    - iOS: `HealthKit` capability + `NSHealthShareUsageDescription` /
      `NSHealthUpdateUsageDescription` Info.plist keys + a Capacitor HealthKit
      plugin (e.g. `@perfood/capacitor-healthkit` or a custom Swift bridge).
    - Android: Health Connect API + a Capacitor plugin/bridge.
  - **Caveat:** Apple's HealthKit data model is nutrition/biometrics — there's no
    "food inventory" type, so the realistic link is the *nutrition of meals you
    log*, not the pantry list itself. Worth confirming this is the intent.
- **Shared / household pantry (PREMIUM)** — two+ people sync the same pantry.
  Design decision: gated behind Pro, but only ONE member of the household needs
  a Pro subscription for the whole shared pantry to work (the others join free).
  Builds on the existing Supabase sync layer (add a household/group id to the
  `pantry_items` row scope). Strong word-of-mouth driver.

## ✅ Integrations shipped (2026-06-13)
- **Food-rescue deep links** — tossing a *still-edible* item now opens a "rescue it
  instead?" sheet (`RescueModal`) with Olio / Too Good To Go / "offer to a friend"
  (native share). Rescuing logs it as **shared** (counts toward savings, not waste).
  Expired items skip straight to toss. Lib: `src/lib/foodRescue.ts`. No API keys —
  plain universal links + share sheet. Device-verify the deep links open.
- **Meal plan → Calendar export** — "Add to Calendar" button on the Plan screen
  builds an `.ics` and shares it (share sheet on native, download on web). Each
  meal lands on its upcoming weekday at 6pm. Lib: `src/lib/calendarExport.ts`.

## 🗒️ Notes from daily code check (2026-06-13)
- **Barcode auto shelf-life** — already implemented. On scan, `AddItemScreen`
  calls `lookupShelfLife(product.name, location)` and pre-fills the expiry
  (`AddItemScreen.tsx:723-732`). No work needed.
- **"Use It Up" digest** — already covered by Avo's Daily Briefing (CookScreen +
  PantryScreen) plus per-item expiration notifications. Not building separately.
- **Shelf-life standalone keys** — added `beef / pork / lamb / fish / tuna`
  (previously returned null → coarse category default). Verified longer keys
  ("ground beef", "tuna steak", "canned tuna") still win via longest-match.
- **Known minor quirk (not yet fixed):** plain "milk" resolves to 10 days
  (matches "soy/oat milk" via the 50%-length rule) instead of dairy milk's 7.
  Over-estimates by 3 days. Pre-existing; left as-is pending a matcher tweak.
