# Pantre — Services & Integrations

← [[Pantre]]

Every third-party service, platform, and tool wired into the app. Each has its own note with dashboard links, keys, and gotchas.

---

## 🔴 Live / Active

| Service                   | Used for                           | Note                               |
| ------------------------- | ---------------------------------- | ---------------------------------- |
| **Supabase**              | Auth, database, Edge Functions     | [[Services/Supabase]]              |
| **Groq**                  | Avo AI chat (llama-3.3-70b)        | [[Services/Groq]]                  |
| **Anthropic**             | Avo fallback + receipt OCR         | [[Services/Anthropic]]             |
| **Apple**                 | Sign In with Apple + App Store     | [[Services/Apple]]                 |
| **Google**                | Google Sign In (OAuth)             | [[Services/Google]]                |
| **Open Food Facts**       | Barcode lookup fallback            | [[Services/Open Food Facts]]       |
| **USDA FoodData Central** | Local 454k barcode database        | [[Services/USDA FoodData Central]] |
| **Instacart**             | "Order on Instacart" shopping link | [[Services/Instacart]]             |
| **GitHub**                | Source code hosting                | [[Services/GitHub]]                |

## 🟡 Planned / Not Yet Active

| Service | Used for | Note |
|---|---|---|
| **RevenueCat** | Real subscription payments | [[Services/RevenueCat]] |
| **Resend** | Transactional email (replaces Supabase default SMTP) | [[Services/Resend]] |
| **Cloudflare** | `pantre.app` domain + email routing | [[Services/Cloudflare]] |
| **Termly** | Privacy policy + Terms of Service | [[Services/Termly]] |
| **Vercel** | Optional contact form hosting | [[Services/Vercel]] |

## 🔑 Where Keys Live

| Key | Where |
|---|---|
| `VITE_SUPABASE_URL` | `.env` |
| `VITE_SUPABASE_ANON_KEY` | `.env` |
| `VITE_ANTHROPIC_API_KEY` | `.env` (local dev only) |
| `GROQ_API_KEY` | Supabase secrets |
| `ANTHROPIC_API_KEY` | Supabase secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets |

⚠️ `.env` is confirmed in `.gitignore` — never commit it.

## 🔑 Observability Keys

| Key | Value |
|---|---|
| **Sentry DSN** | `https://ad598e37653f4a0efb8f5688531d9631@o4511508268449792.ingest.us.sentry.io/4511508282146816` |
| **PostHog Project Token** | `phc_qqS9Vz4xTbWKasnQb3b2HjYNTa3PuMDDj3SXeBg8bZTb` |
| **PostHog Project ID** | `454617` |

See [[Observability]] for full setup notes.
