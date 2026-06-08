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

## Known / Outstanding
- **Supabase email confirmations rate-limited** (default SMTP ~2-3/hour) — needs custom SMTP via Resend + domain verification (SPF/DKIM for `pantre.app`)
- **Resend domain `usepantre.me` showed "No activity"** — Supabase SMTP key may not have been saved correctly
- **Receipt OCR** needs `ANTHROPIC_API_KEY` secret + `supabase functions deploy receipt-ocr`
- **delete-account** Edge Function needs deploy + `SUPABASE_SERVICE_ROLE_KEY` secret
- **Notifications untested on real iPhone** — web no-ops cleanly but actual firing unconfirmed
- **RevenueCat not wired** — Pro tier is currently just a local Zustand flag flip
- **TypeScript build errors** to watch for: `Anthropic.MessageParam` used as namespace type, `plannedRecipes` referenced before declaration
