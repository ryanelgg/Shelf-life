# Resend

← [[Services & Integrations]]

**Website:** https://resend.com
**Dashboard:** https://resend.com/overview
**Type:** Transactional email API
**Status:** ⚠️ Planned — not yet active

## Used for in Pantre
- Supabase transactional emails (email confirmation, magic links)
- Supabase's default SMTP is rate-limited to ~2-3 emails/hour — Resend removes that limit

## Setup required
1. Create account at resend.com
2. Add and verify domain `pantre.app` with SPF/DKIM DNS records in [[Cloudflare]]
3. Generate API key
4. Enter SMTP credentials in Supabase dashboard → Settings → Auth → SMTP

## Gotcha
- Previously the Resend domain `usepantre.me` showed "No activity" on both API keys — the Supabase SMTP key may not have been saved correctly. Double-check after setup.
