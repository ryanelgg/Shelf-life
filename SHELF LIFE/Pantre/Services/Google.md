# Google

← [[Services & Integrations]]

**Console:** https://console.cloud.google.com
**Type:** OAuth provider (Google Sign In)

## Used for in Pantre
- Google Sign In via Supabase OAuth

## Setup locations
- OAuth consent screen: Google Cloud Console → APIs & Services → OAuth consent screen
- App name shown to users must match (was showing raw Supabase URL — fixed)
- Redirect URI must be: `com.elghazzali.shelflife://` (must match Supabase allowlist exactly)

## Gotchas
- iOS delivers the same deep link twice → fixed with deduplication mutex `googleSignInInFlight` + last-URL guard to prevent browser-reopen loop
- If the app name on the consent screen shows the raw Supabase URL, fix it in Google Cloud Console
