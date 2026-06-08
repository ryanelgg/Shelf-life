# Cloudflare

← [[Services & Integrations]]

**Website:** https://cloudflare.com
**Dashboard:** https://dash.cloudflare.com
**Type:** Domain registrar + DNS + free email routing
**Status:** ⚠️ Planned — domain not yet purchased

## Used for in Pantre
- Register and manage `pantre.app` domain
- DNS records for the domain
- **Email Routing** (free) — forward Pantre addresses to personal Gmail:

| Address | Forwards to |
|---|---|
| `support@pantre.app` | personal Gmail |
| `feedback@pantre.app` | personal Gmail |
| `privacy@pantre.app` | personal Gmail |

- SPF/DKIM records for [[Resend]] email sending

## Setup steps
1. Buy `pantre.app` at cloudflare.com/products/registrar (or Namecheap)
2. Enable Cloudflare Email Routing → add forwarding rules
3. Add SPF/DKIM DNS records for Resend
4. Point `pantre.app/privacy`, `/terms`, `/contact` to wherever they're hosted ([[Vercel]] or static)
