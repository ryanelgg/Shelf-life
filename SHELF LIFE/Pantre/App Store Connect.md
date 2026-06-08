# Pantre — App Store Connect

← [[Pantre]]

## Status
Partially started. Blocked on adult Account Holder (see [[Pantre]] → Top Blocker).

## Steps (in order)
1. **Agreements / Tax / Banking**
   - Sign Paid Apps Agreement (requires 18+ Account Holder)
   - Add bank account for payouts
   - Fill W-9 (US) or W-8BEN (non-US) tax form
   - Wait 1–3 days for tax review → status goes "Active"

2. **Create subscription product**
   - Product ID: `pantre_pro_monthly`
   - ⚠️ Product IDs can't be renamed later — use `pantre_` prefix, not `shelflife_`
   - Connect to RevenueCat after creating (see [[RevenueCat]])

3. **App metadata**
   - Display name: **Pantre**
   - Category: **Food & Drink** (primary)
   - Description, keywords, subtitle
   - Copyright: Legal Account Holder's name + year

4. **Screenshots**
   - Required sizes: 6.7" + 6.5" iPhone
   - Can generate in Simulator or design tool

5. **App icon**
   - 1024×1024 PNG
   - No transparency, no rounded corners (Apple adds them)
   - Pick from existing SVG variants, generate iOS asset catalog (light/dark/tinted)

6. **Privacy nutrition labels**
   - Must match the Termly privacy policy exactly
   - See [[Legal & Privacy]]

7. **App Store ID**
   - After first submission, get the numeric App Store ID
   - Replace `idYOUR_APP_ID` placeholder in Settings → Rate Pantre URL

## Reviewer access
- Add email/password login for App Store reviewers
- OR provide a test guest account they can use to explore the app
