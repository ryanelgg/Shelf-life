# Supabase

← [[Services & Integrations]]

**Website:** https://supabase.com
**Dashboard:** https://supabase.com/dashboard/project/fynllpklhftvstxfrega
**Type:** Backend-as-a-service (auth, database, edge functions)

## Used for in Pantre
- User auth (Google OAuth + Apple Sign In)
- Postgres database (profiles, pantry_items, waste_logs)
- Edge Functions: avo-chat, receipt-ocr, delete-account
- Cloud sync for Pro users

## Keys (stored in `.env`)
- `VITE_SUPABASE_URL` = project URL
- `VITE_SUPABASE_ANON_KEY` = public anon key

## Secrets (set via CLI, not in .env)
```bash
npx supabase secrets set ANTHROPIC_API_KEY=<key>
npx supabase secrets set GROQ_API_KEY=<key>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
```

## Deploy Edge Functions
```bash
npx supabase functions deploy avo-chat
npx supabase functions deploy receipt-ocr
npx supabase functions deploy delete-account --no-verify-jwt
```

## Gotchas
- Use `.maybeSingle()` not `.single()` — `.single()` throws PGRST116 when no rows exist
- `signOut()` must use `scope: 'global'` to revoke server-side refresh token
- Default SMTP rate-limited to ~2-3 emails/hour → use [[Resend]] for email confirmations

## Tables
| Table | Purpose |
|---|---|
| `profiles` | User profile, subscription tier, streak, Avo chat count |
| `pantry_items` | All pantry items per user |
| `waste_logs` | Waste/eaten/composted/shared log entries |
