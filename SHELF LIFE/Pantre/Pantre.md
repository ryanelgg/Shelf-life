# Pantre 🥑

> Formerly "Shelf Life" — renamed April 24, 2026 because "Shelf Life" was taken on the App Store.
> "Pantre" is a play on "pantry." The AI mascot is named **Avo**.

## What is it?
A food pantry / expiration tracking iOS app built with Capacitor + React. Users scan barcodes to add items, get notified before things expire, and log food waste. There's a Pro tier ("Pantre Pro") for power features.

## Key details
- **Repo:** `~/shelf-life`
- **Bundle ID:** `com.elghazzali.shelflife` *(unchanged, users never see it)*
- **App Store name:** Pantre
- **Mascot:** Avo (avocado AI buddy)
- **Backend:** Supabase — https://supabase.com/dashboard/project/fynllpklhftvstxfrega
- **Payments:** RevenueCat (pending)
- **Stack:** Capacitor + React + TypeScript + Zustand + Supabase

## The Web
| Note | What's in it |
|---|---|
| [[Features]] | Everything built — pantry, barcode, Avo, recipes, auth, notifications |
| [[Avo AI]] | Chat feature, Groq/Claude backend, consent flow |
| [[Design & Brand]] | Aesthetic, color palette, typography, Avo character |
| [[Backend]] | Supabase tables, Edge Functions, barcode DB, deploy commands |
| [[Bug Log]] | All bugs fixed + known outstanding issues |
| [[Services & Integrations]] | Every third-party service, platform and API key location |
| [[Launch Checklist]] | Every TODO before App Store submission |
| [[Technical Notes]] | Dev gotchas — Capacitor plugin registration, build commands |
| [[Legal & Privacy]] | Domain, email routing, Termly, privacy policy |
| [[App Store Connect]] | ASC steps in order |
| [[RevenueCat]] | Subscription integration steps |

## 🚨 Top Blocker
User is a minor (under 18). Apple requires the Account Holder to be 18+. A parent/guardian must be the legal entity on:
- Apple Developer Program
- ASC Paid Apps Agreement
- Bank account receiving payouts
- W-9 / W-8BEN tax form
- Termly legal name + App Store copyright string

User can still build, design, and run the brand day-to-day.

## Quick Commands
```bash
# Native rebuild
cd ~/shelf-life && npm run build && npx cap sync ios && npx cap open ios

# After cap sync — remove these two lines from ios/App/App/Package.swift:
# .package(url: "https://github.com/capacitor-community/apple-sign-in", ...)
# .product(name: "Plugin", package: "capacitor-community-apple-sign-in"),
```








