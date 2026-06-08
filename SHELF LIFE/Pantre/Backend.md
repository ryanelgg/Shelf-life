# Pantre — Backend & Infrastructure

← [[Pantre]]

## Supabase
- **Auth:** Google OAuth + Apple Sign In
- **Database:** Postgres with RLS policies
- **Tables:** `profiles`, `pantry_items`, `waste_logs`
- **Cloud sync:** Pro users only

### Key Gotchas
- Use `.maybeSingle()` not `.single()` — `.single()` throws PGRST116 when no rows exist (hits on first sign-in)
- `signOut()` must use `scope: 'global'` to revoke server-side refresh token (default `scope: 'local'` does not)
- Default SMTP is rate-limited (~2-3 emails/hour) — must configure custom SMTP via Resend for email confirmations
- Resend requires SPF/DKIM DNS verification for your sender domain (`pantre.app`)

### Edge Functions
| Function | Status | Notes |
|---|---|---|
| `avo-chat` | ✅ Deployed | Groq primary, Claude fallback. Needs `ANTHROPIC_API_KEY` secret |
| `receipt-ocr` | ⚠️ Needs deploy | `supabase functions deploy receipt-ocr` + `ANTHROPIC_API_KEY` secret |
| `delete-account` | ⚠️ Needs deploy | `supabase functions deploy delete-account --no-verify-jwt` + `SUPABASE_SERVICE_ROLE_KEY` secret |

### Deploy Commands
```bash
# Deploy functions
npx supabase functions deploy avo-chat
npx supabase functions deploy receipt-ocr
npx supabase functions deploy delete-account --no-verify-jwt

# Set secrets
npx supabase secrets set ANTHROPIC_API_KEY=<key>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
```

### Fix broken Pro tier in DB (after sign-out wiped it)
```sql
update profiles set subscription_tier = 'pro' where id = '<supabase-user-id>';
```

## Barcode Database
- Source: USDA FoodData Central (~3.1GB raw, processed with streaming parser)
- Output: 454,366-entry, 34MB local JSON file bundled in the app
- Fallback: Open Food Facts API

## AI / External APIs
- **Groq** (`llama-3.3-70b`) — primary Avo chat model
- **Anthropic Claude** — fallback for Avo chat; also used for receipt OCR vision

## Email (planned)
- Resend for transactional email
- Sender domain: `pantre.app` (needs DNS verification)
- Support address: `support@pantre.app` → forwards to personal Gmail via Cloudflare Email Routing
