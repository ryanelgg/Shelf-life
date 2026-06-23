# Pantre home-screen widget — Xcode setup

The code is done. These are the one-time clicks in Xcode that I can't do
headlessly (they edit the `.xcodeproj`, which must be done in Xcode to stay
valid). Budget ~10 minutes.

## What's already in the repo
- **JS publisher** — `src/lib/widget.ts`. Computes the 3 soonest-expiring items
  and hands them to the native plugin. Wired in `src/App.tsx` to run on every
  pantry change. No-op off iOS.
- **Native bridge** — `ios/App/App/PantreWidgetPlugin.swift`. Writes the
  snapshot to the shared App Group and calls `WidgetCenter.reloadAllTimelines()`.
  Auto-registers via `CAPBridgedPlugin` (same as the barcode plugin).
- **Widget extension source** — `ios/App/PantreWidget/` (`PantreWidget.swift`,
  `Info.plist`, `PantreWidget.entitlements`).
- **App Group entitlement** on the app target — `ios/App/App/App.entitlements`
  already lists `group.com.elghazzali.shelflife`.

## Steps in Xcode

1. **Sync Capacitor** so the new plugin compiles into the app target:
   ```
   npm run build && npx cap sync ios
   ```

2. **Add the widget target.** Open `ios/App/App.xcworkspace` →
   *File ▸ New ▸ Target… ▸ Widget Extension*.
   - Product Name: **PantreWidget**
   - Uncheck "Include Configuration App Intent" (this widget is static).
   - Embed in the **App** target when prompted. Click *Activate* scheme.

3. **Use the source in this repo, not the generated stubs.** Xcode generates a
   placeholder `PantreWidget.swift`/`Info.plist`. Delete its generated Swift
   file and instead *Add Files…* the three files in
   `ios/App/PantreWidget/` (or paste their contents over the generated ones).
   Make sure `PantreWidget.swift` is a member of the **PantreWidget** target
   only.

4. **App Group on the widget target.** Select the **PantreWidget** target ▸
   *Signing & Capabilities* ▸ **+ Capability ▸ App Groups** ▸ add
   `group.com.elghazzali.shelflife`. Point the target's *Code Signing
   Entitlements* build setting at `PantreWidget/PantreWidget.entitlements`.
   The **App** target already has this group enabled.

5. **Register the App Group in the Developer Portal.** Apple Developer ▸
   Identifiers ▸ App Groups ▸ ensure `group.com.elghazzali.shelflife` exists,
   and that both the app and widget App IDs include it. Let Xcode regenerate
   provisioning profiles.

6. **Deployment target.** Set PantreWidget's minimum iOS to **17.0**
   (`.containerBackground` is used). The app already targets a recent iOS.

7. **Run.** Build the app to a device/simulator, add a few pantry items, then
   long-press the home screen ▸ **+** ▸ search "Pantre" ▸ add the widget.

## How the data flows
```
pantry changes → App.tsx effect → publishWidgetData()
  → PantreWidget.setData({value}) [native]
  → UserDefaults(group).set(json) + WidgetCenter.reloadAllTimelines()
  → widget Provider.loadPayload() decodes json → SwiftUI view
```

## Verifying without the UI
The JSON contract is unit-tested on the JS side (`buildWidgetPayload`). If the
widget shows the placeholder ("Spinach / Greek Yogurt / Chicken"), the App
Group isn't shared yet — re-check steps 4–5. If it shows "Nothing expiring
soon," the app wrote an empty list (no items within range) — add an item with a
near expiry and confirm it appears.
