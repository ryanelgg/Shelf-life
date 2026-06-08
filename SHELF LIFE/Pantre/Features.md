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
