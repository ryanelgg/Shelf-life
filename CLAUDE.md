# Pantre — Claude Instructions

## Sleep Prevention for Long Tasks
Before starting any long task, run:
```
sudo pmset -a disablesleep 1 && caffeinate -i &
```
After completing any long task, run:
```
killall caffeinate && sudo pmset -a disablesleep 0
```

## Obsidian Superbrain Rule 🧠
**Whenever a new feature is planned, designed, or built for Pantre — add it to the Obsidian vault immediately.**

The Obsidian vault lives at `~/shelf-life/SHELF LIFE/` and is connected via the `obsidian` MCP server.

### Where to log things:
| What | Where in Obsidian |
|---|---|
| New feature (planned or built) | `Pantre/Features.md` — add to the right section (✅ Built / 🔧 Needs Work / 💡 Planned) |
| Complex feature with its own details | Create `Pantre/Features/<Feature Name>.md` and link from Features.md |
| Bug found or fixed | `Pantre/Bug Log.md` |
| New service/API integrated | `Pantre/Services & Integrations.md` + new `Pantre/Services/<Name>.md` |
| Pre-launch task | `Pantre/Launch Checklist.md` |
| Technical gotcha or decision | `Pantre/Technical Notes.md` |
| Design decision | `Pantre/Design & Brand.md` |

### How to log:
Use `mcp__obsidian__vault_patch` to append to existing notes, or `mcp__obsidian__vault_write` to create new ones. Always link back to `[[Pantre]]`.

Do this **in the same response** where the feature is discussed — don't wait to be asked.

## App Context
- App name: **Pantre** (play on "pantry") — formerly "Shelf Life"
- Mascot: **Avo** (avocado AI buddy)
- Repo: `~/shelf-life`, bundle ID: `com.elghazzali.shelflife`
- Stack: Capacitor + React + TypeScript + Zustand + Supabase
- The Obsidian vault at `~/shelf-life/SHELF LIFE/` is the single source of truth for everything Pantre
