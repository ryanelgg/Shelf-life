# Pantre — Bug Log

← [[Pantre]]

## Fixed

### Auth & Sign In
- **Apple Sign In "UNIMPLEMENTED on ios"** — `registerPluginType` is a silent no-op; fixed by switching to `registerPluginInstance` in `MainViewController.capacitorDidLoad`
- **Google Sign In redirect loop** — iOS delivers the same deep link twice; fixed with a deduplication mutex (`googleSignInInFlight`) + last-URL guard
- **Google Sign In app name showed raw Supabase URL** — fixed in Google Cloud Console OAuth consent screen
- **Wrong redirect URL** — was `com.shelflife.app://` instead of `com.elghazzali.shelflife://` in Supabase allowlist
- **App skipping onboarding on every relaunch** — fixed persistent session check
- **Avo name pre-filled from OAuth data** — removed `setName(nextUser.name.split(' ')[0])` call

### Data & State
- **Reset All Data didn't fully clear state** — now wipes localStorage + all Zustand state + all Supabase tables
- **Quick Add created duplicates** — fixed to increment existing items instead
- **Streak defaulted to 7 for new users** — changed `|| 7` to `?? 0`
- **Streak visualization broke at exact 7-day multiples** — fixed with `streakDays % 7 || (streakDays > 0 ? 7 : 0)`
- **Impact screen showed "7-day default" for new users** — removed bogus default
- **Sign-out used `scope: 'local'`** — changed to `scope: 'global'` so server-side refresh token is also revoked

### Recipes & Shopping
- **"What to Buy" pulled from all 60+ recipes** instead of only planned meals — fixed to search `[...recipes, ...browseRecipes]` for current meal plan items only
- **Unit-blind ingredient matching** (e.g. "4 cloves" vs "1 head") — gated raw number comparison to only run when both sides use plain unit counts
- **UTC date display in ShoppingListScreen** showed wrong day — fixed to use local timezone

### UI / Native
- **Settings screen flash on first open** — lazy-loaded component caused half-screen flash; fixed by eagerly importing + GPU-composited animation with `translate3d` + `will-change: transform`
- **Avocado off-center after squish animation** — recentered
- **Selectable/highlightable text on iOS** — disabled `user-select`
- **SVG category logos not visible on mobile** — fixed
- **Dark mode toggle didn't visually apply** — fixed CSS class application to root element
- **Keyboard pushing app content up** — fixed with `@capacitor/keyboard` + `resize: 'none'` + `scrollEnabled: false`

### Native / Build
- **Missing camera permission key** `NSPhotoLibraryAddUsageDescription` — was causing crash
- **`cap sync ios` re-adds `CapacitorCommunityAppleSignIn` to `Package.swift`** every time — must manually remove two lines after each sync
- **Supabase `.single()` PGRST116 error on first sign-in** — switched to `.maybeSingle()`

### Content
- **Chicken on "counter" showing 1095 days expiry** — "chicken broth canned" was matching "counter" storage pattern; fixed shelf life lookup logic

## Daily Code Check — 2026-06-14

### Fixed this pass (auto-applied + verified: lint, tsc, build all green)
- **Avo chat counter could render negative** (`CookScreen.tsx`) — free `avoChatCount` keeps climbing past the limit, so the badge showed e.g. "−2/5 free chats"; clamped with `Math.max(0, …)`
- **Receipt scan crashed on malformed success body** (`receiptApi.ts`) — `response.json()` on a 2xx response had no `.catch`; now falls back to `{}`
- **Community-product lookups/submits failed silently** (`communityProducts.ts`) — Supabase `error` was discarded, making a network/RLS failure indistinguishable from "no match"; now logged via `debug.warn`
- **ESLint scanned the Obsidian vault + native folders** — flooded output with bogus errors; added `SHELF LIFE/**`, `android/**`, `ios/**` to ignores and an `argsIgnorePattern: '^_'` rule so intentional unused `_args`/`_u` params stop erroring
- **14 unnecessary `\'` escapes** in `notifications.ts` template literals — cleaned up

## Known / Outstanding
- **Supabase email confirmations rate-limited** (default SMTP ~2-3/hour) — needs custom SMTP via Resend + domain verification (SPF/DKIM for `pantre.app`)
- **Resend domain `usepantre.me` showed "No activity"** — Supabase SMTP key may not have been saved correctly
- **Receipt OCR** needs `ANTHROPIC_API_KEY` secret + `supabase functions deploy receipt-ocr`
- **delete-account** Edge Function needs deploy + `SUPABASE_SERVICE_ROLE_KEY` secret
- **Notifications untested on real iPhone** — web no-ops cleanly but actual firing unconfirmed
- **RevenueCat not wired** — Pro tier is currently just a local Zustand flag flip
- **TypeScript build errors** to watch for: `Anthropic.MessageParam` used as namespace type, `plannedRecipes` referenced before declaration

### Found 2026-06-14 — need a manual decision before fixing
- **Notification ID collisions for heavy users** (`notifications.ts` `hashStringToInt` → `notificationIdsForItem`) — two item IDs hashing to the same mod-1e8 bucket produce identical notification IDs, so adding one item can silently cancel another's reminders. Needs a wider/namespaced ID scheme.
- **Streak milestone can re-fire on repeat same-day logs** (`useStore.ts` `addWasteLog`/`celebrateStreakMilestone`) — milestone check runs even when `streakDays` didn't increment, re-arming the same notification. Should only celebrate when the streak actually went up this call.
- **`syncProfileUpdates` has no retry** (`supabaseSync.ts:253`) — unlike `syncWrite`, a transient failure silently drops the streak/last-active cloud write. Route it through `syncWrite` (but it's currently `await`ed by some callers, so the contract change needs review).
- **BarcodeScanner stream cleanup** (`BarcodeScanner.tsx`) — discards `decodeFromVideoDevice` controls and calls the app-wide `releaseAllStreams()`; async decode callback can also fire post-unmount. Should capture `IScannerControls` and `.stop()` it + guard state updates. Depends on `@zxing/browser` version API.
- **Freezing an item can shorten its shelf life** (`PantryScreen.tsx` `handleFreezeItem`) — sets expiry to `today + freezerDays` even when the current expiry is later. Should use `max(currentDaysLeft, freezerDays)`.
- **Negative/garbage "days" accepted on Add Item** (`AddItemScreen.tsx`) — `parseInt('5abc')`→5, `'-3'`→past date. Tighten to `n >= 0`.
- **Env var crash risk** (`avoApi.ts` / `receiptApi.ts`) — `supabaseUrl.replace(...)` at module load throws if `VITE_SUPABASE_URL` is missing.
