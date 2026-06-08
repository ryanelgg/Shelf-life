# Termly

← [[Services & Integrations]]

**Website:** https://termly.io
**Type:** Privacy policy + Terms of Service generator
**Status:** ⚠️ In progress — policy not yet published

## Used for in Pantre
- Generating a GDPR/CCPA-compliant privacy policy and Terms of Service
- Required by Apple before App Store submission

## Status
- Form partially filled in
- Privacy Contact email set to `privacy@pantre.app` (must be live before publishing — see [[Cloudflare]])
- Once published, update these placeholders in `src/screens/SettingsScreen.tsx`:
  - `https://pantre.app/privacy`
  - `https://pantre.app/terms`
- Also add links to UpgradeModal paywall

## Important notes
- Title should say **"Privacy Contact"** — not "DPO"
  - Solo founder doesn't qualify as a formal DPO under GDPR Art. 37
  - Ask Termly support to change wording if it says DPO
- Third parties disclosed in policy: Supabase, Anthropic, Apple, Google
- No location tracking, no ad targeting, no behavioral tracking
- Camera: barcode frames are momentary, not stored
- Receipt photos: sent to Edge Function, not stored
- Data retained as long as account exists

## Legal name in policy
Must use the **18+ Account Holder's legal name** — see [[Pantre]] → Top Blocker
