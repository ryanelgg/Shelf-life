# GitHub

← [[Services & Integrations]]

**Website:** https://github.com
**Type:** Source code hosting + version control
**Status:** ✅ Active

## Used for in Pantre
- Hosts the Pantre codebase (repo lives locally at `~/shelf-life`)

## ⚠️ Security reminder
- `.env` contains live API keys — confirmed it's in `.gitignore` ✅
- Never force-push or accidentally commit `.env`, `.env.local`, or any file with secrets
- The bundle ID `com.elghazzali.shelflife` and Supabase project URL are visible in code — that's fine, they're not secret
