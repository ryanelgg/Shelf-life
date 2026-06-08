# Anthropic

← [[Services & Integrations]]

**Website:** https://anthropic.com
**Dashboard:** https://console.anthropic.com
**Type:** AI API (Claude models)

## Used for in Pantre
- Fallback for Avo AI chat (if [[Groq]] fails)
- Receipt OCR — Claude's vision API reads receipt photos and extracts item names/prices
- Called from Supabase Edge Functions `avo-chat` + `receipt-ocr`

## Keys
- `ANTHROPIC_API_KEY` — stored as a Supabase secret (not in `.env`)
- Also in `.env` as `VITE_ANTHROPIC_API_KEY` for local dev (do not commit)

## API endpoints used
- `https://api.anthropic.com/v1/messages`
- Version header: `anthropic-version: 2023-06-01`
