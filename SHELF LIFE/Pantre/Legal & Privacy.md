# Pantre — Legal & Privacy

← [[Pantre]]

## Domain
- Target domain: `pantre.app`
- Recommended registrars: Namecheap, Cloudflare Registrar
- Pages needed: `pantre.app/privacy`, `pantre.app/terms`, `pantre.app/contact`

## Email Setup (Cloudflare Email Routing — free)
| Address | Forwards to |
|---|---|
| `support@pantre.app` | personal Gmail |
| `feedback@pantre.app` | personal Gmail |
| `privacy@pantre.app` | personal Gmail (CCPA contact) |

## Privacy Policy (Termly)
- In progress — finish the Termly form
- Privacy Contact title should say **"Privacy Contact"**, not "DPO"
  - Solo founder doesn't qualify as formal DPO under GDPR Art. 37 independence rules
  - Ask Termly support to change wording if needed
- Once published, update these placeholders in `src/screens/SettingsScreen.tsx`:
  - `https://pantre.app/privacy`
  - `https://pantre.app/terms`
- Also add links to UpgradeModal paywall (Apple requires)

## Termly DPO / Privacy Contact fields filled
- Email: `privacy@pantre.app`
- Phone: skipped
- Address: same as company address

⚠️ Once policy publishes, `privacy@pantre.app` **must be live** or privacy requests will bounce.

## App Store Copyright String
Must use the legal Account Holder's name (18+ adult). See [[Pantre]] → Top Blocker.

## Trademark
- [ ] Search "Pantre" at tmsearch.uspto.gov before App Store listing
