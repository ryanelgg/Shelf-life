# Pantre — Design & Brand

← [[Pantre]]

## Name & Mascot
- **App name:** Pantre (play on "pantry") — renamed from Shelf Life on 2026-04-24
- **Mascot:** Avo — a hand-drawn, 2D illustrated avocado with botanical leaf veins, natural feel
- 8 expressions, walking/bouncing/wiggling animations, tap reactions

## Aesthetic
"Farmer's market Saturday morning" — homelike, earthy, warm.

Evolved from a "modern/Zova-like" initial look to something more illustrative and grounded.

### Paper-grain texture revamp (2026-06-17)
Gave the whole app a hand-painted, "naturey" feel inspired by Avo's portrait (soft gouache-on-paper texture).
- **Tileable fractal-noise grain** (`feTurbulence` SVG, exposed as the `--grain` CSS token in `globals.css`) overlaid via `soft-light` blend on:
  - the page background (`body::before`, fixed, app-wide)
  - cards (`.card-component::after`)
  - the tab bar (`.tab-bar::before`)
  - Overlays use a stacking-context trick (`isolation: isolate` + `z-index:-1`) so grain sits above each surface's fill but behind its content — keeps text crisp.
- **Organic color washes:** subtle forest/wheat/lichen radial gradients on `body` for pigment-settling-into-paper depth.
- **Warmer surfaces:** `--bg-primary` → `#f6f1e7`, `--bg-card`/`--tab-bg` cream `#fcf9f2` (was pure white) so cards read like painted paper.
- Grain intensity is theme-aware (`--grain-opacity` / `--card-grain-opacity`, dimmed in dark mode).

## Color Palette
| Token | Hex | Usage |
|---|---|---|
| Background | `#0A1A0F` | Deep forest green |
| Text | cream/linen | Primary text |
| Accent | `#4CAF50` | Fresh green |
| Linen | `#faf7f2` | Warm backgrounds |
| Forest | `#4a7c59` | Brand green |
| Bark | `#2d2418` | Dark brown |

## Typography
- **Headings:** Cormorant Garamond (serif)
- **Body:** DM Sans
- **Mono:** DM Mono

## Icons
- Thin brown-outline SVG icons for all food categories
- Replaced emojis with hand-drawn illustrated style
- App icon: needs finalization — pick one SVG variant, generate iOS asset catalog (light/dark/tinted)
  - 1024×1024 PNG, no transparency, no rounded corners

## App Store Screenshots
- Mockups exist at `app-store-mockups.html` in the repo
- Required sizes: 6.7" + 6.5" iPhone

## Branding Rules
- Use "Pantre" everywhere user-facing (not "Shelf Life")
- Use "Pantre Pro" (not "Shelf Life Pro") in all subscription copy
- Mascot name is always "Avo"
- Bundle ID stays `com.elghazzali.shelflife` — users never see it
