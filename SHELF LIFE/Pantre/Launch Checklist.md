# Pantre — Launch Checklist

← [[Pantre]]

## 🚨 Adult required (top blocker)
- [ ] Find a parent/guardian or trusted adult (18+) to be the legal Account Holder
- Their name goes on: Apple Developer Program, ASC Paid Apps Agreement, bank account, W-9/W-8BEN, Termly legal name, App Store copyright string

## Domain + Email
- [ ] Buy `pantre.app` domain (Namecheap, Cloudflare Registrar, etc.)
- [ ] Set up Cloudflare Email Routing (free) → `support@pantre.app` forwards to Gmail
- [ ] Set up `feedback@pantre.app` alias
- [ ] Set up `privacy@pantre.app` alias (needed for CCPA + Termly)
- [ ] Host contact form at `pantre.app/contact` (Termly hosted form or tiny Vercel page)

## Privacy & Legal
- [ ] Finish Termly privacy policy form
- [ ] Publish Termly policy → get public URL
- [ ] Update `pantre.app/privacy` + `pantre.app/terms` placeholders in `src/screens/SettingsScreen.tsx`
- [ ] Add privacy policy + ToS links to UpgradeModal paywall (Apple requires this)
- [ ] Confirm Termly shows "Privacy Contact" not "DPO" (solo founder doesn't qualify under GDPR Art. 37)

See [[Legal & Privacy]] for details.

## App Store Connect
- [ ] Complete Agreements / Tax / Banking (Paid Apps agreement, bank account, W-9/W-8BEN)
- [ ] Wait for tax review (1–3 days)
- [ ] Create subscription product `pantre_pro_monthly` in ASC
- [ ] App Store screenshots (6.7" + 6.5" iPhone sizes)
- [ ] App icon 1024×1024 (no transparency, no rounded corners)
- [ ] App description, keywords, category: **Food & Drink** (primary)
- [ ] Privacy nutrition labels — must match Termly policy

See [[App Store Connect]] for details.

## RevenueCat
- [ ] After ASC tax is Active → create RevenueCat project
- [ ] Connect ASC API + App-Specific Shared Secret + .p8 key
- [ ] Create entitlement `pro` and offering `default`
- [ ] Install `@revenuecat/purchases-capacitor`
- [ ] Wire `Purchases.configure`, `logIn/logOut`, real upgrade flow, restore purchases, sync on launch
- [ ] Update paywall copy with auto-renewal disclosure
- [ ] Sandbox test on real iPhone (not simulator)
- [ ] Wire `posthog.capture('pro_purchase_completed', { product_id })` in the RevenueCat purchase confirmation callback (`pro_purchase_started` already fires in UpgradeModal)

See [[RevenueCat]] for details.

## Account
- [ ] Add email/password sign-in for App Store reviewers OR a guest test account
- [ ] Deploy `delete-account` Edge Function: `npx supabase functions deploy delete-account --no-verify-jwt`
- [ ] Set service role secret: `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`

## Code Cleanup
- [ ] Gate `console.log` statements behind `import.meta.env.DEV` (`[loadProfile]`, `[auth] state change`, etc.)
- [ ] Restore Pro tier in DB after sign-out wiped it: `update profiles set subscription_tier = 'pro' where id = '<supabase-user-id>';`
- [ ] Replace `idYOUR_APP_ID` in Settings → Rate Pantre URL with real App Store ID

## Native Rebuild
- [ ] `cd ~/shelf-life && npm run build && npx cap sync ios && npx cap open ios`
- [ ] Verify home-screen icon label says "Pantre"
- [ ] Verify camera permission dialog says "Pantre uses…"
- [ ] Verify onboarding welcome says "your Pantre buddy"

## Future / Nice-to-haves
- [ ] Data export (GDPR portability) — JSON download of user data
- [ ] Trademark search for "Pantre" at tmsearch.uspto.gov before listing
- [ ] App icon: finalize one SVG variant, generate iOS asset catalog (light/dark/tinted)

## Cloudflare Security (added 2026-06-07)

Issues flagged by Cloudflare Security Insights for `usepantre.me`.

### 🔴 Critical — fix before launch

- [ ] **Add DMARC record for `usepantre.me`**
  - Cloudflare → DNS → Records → Add record
  - Type: `TXT`
  - Name: `_dmarc`
  - Content: `v=DMARC1; p=quarantine; rua=mailto:rayanelghazzali@gmail.com; pct=100; adkim=s; aspf=s`
  - TTL: Auto
  - **Why:** Without DMARC, Resend confirmation emails (signup codes) can land in Gmail/Apple Mail spam folders. Most important one.

- [ ] **Add DMARC record for `send.usepantre.me`**
  - Same as above, but Name: `_dmarc.send`
  - Resend uses this subdomain to send mail, so it needs its own DMARC

- [ ] **Enable Bot Fight Mode**
  - Cloudflare → Security → Bots → toggle Bot Fight Mode ON
  - Free, no downside. Blocks scrapers and credential-stuffing bots from the landing page

### 🟡 Optional — nice to have

- [ ] **Configure security.txt** — `.well-known/security.txt` so researchers know how to report vulns. Not required for App Store. Add later.
- [ ] **Enable AI Labyrinth** — traps AI scrapers (ChatGPT, Claude bot, etc.) so they don't ingest the marketing site. Toggle if you don't want your site in AI training data.

### Verification

After DMARC records propagate (~15 min), check from terminal:
```
dig TXT _dmarc.usepantre.me +short
dig TXT _dmarc.send.usepantre.me +short
```
Both should return the `v=DMARC1...` string.

Related: [[Pantre]] · [[Services & Integrations]]
