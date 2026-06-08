# Apple

← [[Services & Integrations]]

**Developer portal:** https://developer.apple.com
**App Store Connect:** https://appstoreconnect.apple.com
**Type:** iOS platform + App Store distribution

## Used for in Pantre
- Sign In with Apple (native Swift plugin — `SignInWithApplePlugin.swift`)
- App Store distribution
- In-app subscriptions (via [[RevenueCat]] wrapper over StoreKit)
- "Manage Subscription" deep link: `https://apps.apple.com/account/subscriptions`

## Account situation
⚠️ Account Holder must be **18+**. User is a minor — a parent/guardian needs to be the legal Account Holder. See [[Pantre]] → Top Blocker.

## App Store Connect tasks
- Create subscription product: `pantre_pro_monthly` (ID can't be changed later)
- Complete Paid Apps Agreement, banking, W-9/W-8BEN tax form
- See [[App Store Connect]] for full checklist

## Capability required in Xcode
- "Sign In with Apple" capability must be enabled in the app target

## Gotcha
- `@capacitor-community/apple-sign-in` npm package conflicts with native Swift plugin — must be uninstalled
- After every `npx cap sync ios`, manually remove two `CapacitorCommunityAppleSignIn` lines from `Package.swift`
