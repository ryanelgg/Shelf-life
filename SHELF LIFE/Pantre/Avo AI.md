# Pantre — Avo AI Chat

← [[Pantre]]

## What it is
Avo is Pantre's avocado AI mascot who also powers an in-app chat. Users can ask Avo about recipes, food storage, expiration, etc.

## Implementation
- **Primary model:** Groq (llama-3.3-70b)
- **Fallback:** Anthropic Claude
- **Deployed as:** Supabase Edge Function (`avo-chat`)
- **System prompt:** `avoPrompt.ts` — defines Avo's personality and food-focused scope
- **API key:** Anthropic key stored in Supabase secrets

## Consent
- `AvoConsentModal` shown on first Chat tab visit
- State: `avoAiConsent: 'granted' | 'declined' | null` in Zustand (persisted)
- Disabled chat input shows "Turn on Avo AI" until granted
- Toggle available in Settings to revoke/re-grant

## Free vs Pro
- Free users: **5 Avo chats/month**
- Pro users: **unlimited**
- Visual distinction between Pro Avo and free Avo

## History
- Originally implemented as keyword-matching (same canned response every time)
- Then wired to real Groq with Claude as fallback, deployed as Edge Function

## Outstanding
- ⚠️ Make sure `ANTHROPIC_API_KEY` is set in Supabase secrets
- ⚠️ `avo-chat` Edge Function must be deployed
