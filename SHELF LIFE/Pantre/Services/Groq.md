# Groq

← [[Services & Integrations]]

**Website:** https://groq.com
**Dashboard:** https://console.groq.com
**Type:** Fast LLM inference API

## Used for in Pantre
- Primary model for Avo AI chat
- Model: `llama-3.3-70b`
- Called from Supabase Edge Function `avo-chat`

## Keys
- `GROQ_API_KEY` — stored as a Supabase secret (not in `.env`)

## Notes
- Groq is used because it's significantly faster than Anthropic for chat responses
- If Groq fails, the Edge Function falls back to [[Anthropic]]
