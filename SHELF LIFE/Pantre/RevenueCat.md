# Pantre — RevenueCat

← [[Pantre]]

## Prerequisites
- ASC tax status must be **Active** before setting up RevenueCat
- Subscription product `pantre_pro_monthly` must exist in [[App Store Connect]]

## Setup Steps
1. Create RevenueCat project at app.revenuecat.com
2. Connect App Store Connect:
   - ASC API key (.p8 file)
   - App-Specific Shared Secret
3. In RevenueCat dashboard:
   - Create entitlement: `pro`
   - Create offering: `default`
   - Attach `pantre_pro_monthly` product

## Code Integration
```bash
npm install @revenuecat/purchases-capacitor
```

Wire up in app:
- `Purchases.configure(...)` — on app start
- `Purchases.logIn(userId)` — after Supabase auth
- `Purchases.logOut()` — on sign-out
- Real upgrade flow in UpgradeModal (replace current mock)
- Restore purchases button
- Sync entitlement on launch to catch web purchases / renewals

## Paywall copy
- Update auto-renewal disclosure text to meet Apple guidelines
- Add privacy policy + ToS links (see [[Legal & Privacy]])

## Testing
- ⚠️ Must sandbox test on **real iPhone**, not simulator
- Use a Sandbox Apple ID in Settings → App Store on the test device
