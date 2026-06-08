# Pantre — Technical Notes

← [[Pantre]]

## Stack
- **Framework:** Capacitor + React (TypeScript)
- **Backend:** Supabase (auth, DB, Edge Functions)
- **Payments:** RevenueCat (pending integration — see [[RevenueCat]])
- **Repo:** `~/shelf-life`
- **Bundle ID:** `com.elghazzali.shelflife`

## Capacitor Plugin Registration ⚠️
**Always use `registerPluginInstance`, never `registerPluginType`.**

Custom native iOS plugins are registered in `ios/App/App/MainViewController.swift` via:
```swift
bridge?.registerPluginInstance(MyPlugin())
```
inside `capacitorDidLoad()`.

### Why this matters
`registerPluginType()` is a **silent no-op** when `autoRegisterPlugins` is true (the default). It early-returns without registering, so the JS bridge returns `UNIMPLEMENTED` even though the Swift code "succeeded." Discovered after hours of debugging "SignInWithApple plugin is not implemented on ios."

### Rules
- Never switch back to `registerPluginType`
- New custom native plugins → register instance in `MainViewController.capacitorDidLoad()`
- Don't register from `AppDelegate.didFinishLaunchingWithOptions` — the bridge isn't ready yet

### Current custom plugins
- `ios/App/App/SignInWithApplePlugin.swift`
- `ios/App/App/BarcodeScannerPlugin.swift`

The storyboard at `ios/App/App/Base.lproj/Main.storyboard` points its root viewController at `MainViewController` (custom class of `App` module).

## Local Notifications
Implemented via `@capacitor/local-notifications`. Helper at `src/lib/notifications.ts`.

Five notification types:
1. **Expiration** — 3 per item (2 days before, 1 day before, day-of) at 10am local
2. **Streak protection** — 7pm tomorrow if streak active, refreshed each waste log
3. **Streak milestones** — fires immediately at 3/7/14/30/50/100/365 days
4. **Re-engagement** — 6pm 3 days after last activity ("Avo misses you")
5. **Recipe nudge** — 5pm 5 days after last 'eaten' log

Toggle in Settings → "Avo Notifications." Wired into `addPantryItem`, `updatePantryItem`, `removePantryItem`, `addWasteLog`, `clearPantry`, `resetOnboarding`. Web no-ops cleanly.

⚠️ **Needs testing on real iPhone** to confirm notifications actually fire.

## Native Rebuild Command
```bash
cd ~/shelf-life && npm run build && npx cap sync ios && npx cap open ios
```

## Supabase Edge Functions
- `delete-account` — deletes user data on request (required by Apple)
  - Deploy: `npx supabase functions deploy delete-account --no-verify-jwt`
  - Secret: `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`
