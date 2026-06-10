# Pantre — To-Do List

Last updated: 2026-05-09

---

## ✅ Already done

- Email + password sign-in with inline drop-down on onboarding sign-in screen
- Data export — "Download My Data" in Settings → JSON via iOS share sheet
- Console log cleanup — `debug.ts` wrapper, all 35 calls converted, prod-stripped
- Empty states — Impact + Plan show friendly Avo onboarding when no data
- Local notifications — full system with 5 types (expiration, streak protection, milestones, re-engagement, recipe nudge), Duolingo-style copy, Settings toggle
- Account deletion — Edge Function + DeleteAccountModal with type-DELETE confirmation
- Settings additions — display name, email, sign-in provider, Avo AI toggle, manage subscription deep link, support/legal section, acknowledgments
- App rename — Pantre everywhere (Info.plist, onboarding, Avo system prompt, settings, etc.)
- Resend SMTP wired up — confirmation emails arriving
- **Domain + email** — `usepantre.me` via GitHub Student Pack, Cloudflare Email Routing for support/privacy/feedback, Gmail "Send as", Resend domain verified, Supabase sender = `noreply@usepantre.me`
- **Trademark search** — "Pantre" is CLEAR. Safe to file cl.009 + cl.042 when ready (~$350/class)
- **Polish pass** — haptic feedback (@capacitor/haptics), Avo AI medical disclaimer, UpgradeModal Privacy/ToS links, onboarding progress dots, sync retry with exponential backoff
- **Bug fixes** — chat history leak, Sign Out browser confirm, empty cloud resurrection, receipt stale form values, duplicate receipt name filter, 0-day expiration as falsy
- Pro tier restored in SQL

---

## 🚨 Top blocker — adult required for Apple Developer Program

A parent/guardian (or other trusted 18+ adult) needs to be the named legal owner. Their name goes on:

- Apple Developer Program enrollment
- ASC Paid Apps Agreement signature
- Bank account receiving payouts
- W-9 / W-8BEN tax form
- Termly privacy policy "Full legal name of company" field
- App Store copyright string

You can still operate Pantre day-to-day. You just can't be the legal entity.

---

## 🟡 Privacy policy + Terms (blocked on adult only)

- [ ] Finish Termly privacy policy form (swap parent's legal name into "Full legal name of company")
- [ ] Publish Termly policy → get the public URL
- [ ] Replace placeholder URLs in `src/screens/SettingsScreen.tsx` and `src/components/UpgradeModal.tsx` — `pantre.app/privacy` → `usepantre.me/privacy`, `pantre.app/terms` → `usepantre.me/terms`
- [ ] Test sign-up with someone else's real email to confirm global delivery via `noreply@usepantre.me`

---

## 🟡 App Store Connect (blocked on adult)

- [ ] Tax & Banking — Paid Apps Agreement, bank account, tax form (W-9 or W-8BEN)
- [ ] Wait 1-3 days for Apple's tax review
- [ ] Create subscription product `pantre_pro_monthly`
- [ ] App Store screenshots (1290×2796 for 6.7" iPhone)
- [ ] App icon at 1024×1024 (no transparency, no rounded corners)
- [ ] App description, keywords (100 chars comma-separated), category Food & Drink
- [ ] Privacy nutrition labels — must match Termly disclosures
- [ ] App Store reviewer test account credentials (note in review submission)

---

## 🟡 RevenueCat (blocked on ASC tax being Active)

- [ ] Create RevenueCat project
- [ ] Upload App-Specific Shared Secret + `.p8` key + Key ID + Issuer ID
- [ ] Create entitlement `pro` and offering `default`
- [ ] `npm install @revenuecat/purchases-capacitor`
- [ ] Wire `Purchases.configure` at app boot
- [ ] Wire `Purchases.logIn` / `logOut` into auth listener
- [ ] Replace fake upgrade flow with `purchasePackage`
- [ ] Replace cancel flow with deep-link to Apple Settings
- [ ] Add Restore Purchases button on paywall + in Settings (Apple requires)
- [ ] Sync subscription state on app boot + foreground
- [ ] Update paywall copy with auto-renewal disclosure
- [ ] Sandbox test on real iPhone

---

## 🟢 Can do RIGHT NOW

### Design / branding
- [x] App icon decision — picked a custom design (not one of the `logo-1`…`logo-5` variants)
- [ ] Generate iOS asset catalog (light/dark/tinted variants) from the chosen icon
- [ ] App Store screenshot mockups in Canva (drafts) — 1290×2796
- [ ] App description / keywords drafts in a Notes doc

### Code / polish
- [ ] Native rebuild + verify: `npm run build && npx cap sync ios && Xcode Run`
  - Confirm home-screen icon label = "Pantre"
  - Camera permission dialog says "Pantre uses…"
  - Onboarding welcome says "your Pantre buddy"
- [ ] Pre-create reviewer email/password test account once submission is ready

---

## Privacy Contact details for Termly

- `privacy@usepantre.me` is filled as Privacy Contact email; phone skipped; "same address as company" checked
- That email is now live and forwards to your Gmail
- Title in policy should be "Privacy Contact" (NOT formal "DPO")
- If Termly used "DPO" wording, ask Termly support to change the title to "Privacy Contact" before publishing

---

## Suggested order

1. Pick app icon (one of `logo-*` variants → asset catalog)
2. App Store screenshot mockups (Canva drafts)
3. App description / keywords drafts
4. Native rebuild + verify on iPhone
5. Talk to a parent when ready (unblocks Termly publish, App Store Connect, RevenueCat)
