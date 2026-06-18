# Pantre — Design & Brand

← [[Pantre]]

## Name & Mascot
- **App name:** Pantre (play on "pantry") — renamed from Shelf Life on 2026-04-24
- **Mascot:** Avo — a hand-drawn, 2D illustrated avocado with botanical leaf veins, natural feel
- 8 expressions, walking/bouncing/wiggling animations, tap reactions

## Aesthetic
"Farmer's market Saturday morning" — homelike, earthy, warm.

Evolved from a "modern/Zova-like" initial look to something more illustrative and grounded.

### Wooden-table grain texture (2026-06-17)
Final direction: **keep all the original farmer's-market colors** and overlay a **wooden-table wood-grain texture** on the backgrounds and buttons (earlier attempts — paper grain, full wood recolor, and a light-wood outline — were all rejected).
- **Texture** = a single tileable grayscale SVG (`--wgrain` in `globals.css`): horizontal grain lines warped by `feTurbulence` + `feDisplacementMap` into flowing "table" waves.
- **Color-preserving overlay:** applied as a `::before`/`::after` that blends with the surface beneath via `mix-blend-mode`, so green stays green, cream stays cream — only grain is added. Uses the `isolation: isolate` + `z-index:-1` trick to blend with the element's own fill and stay behind content.
- **Per-theme blend** (`--wood-blend` / `--wood-op`): light theme `multiply @ 0.14` (visible grain on cream/white); dark theme `soft-light @ 0.5` (lightens grain on dark). Buttons override to `soft-light @ 0.9` since the saturated green reads as real wood grain.
- **Applied to:** background (`body::before`, fixed), cards (`.card-component::after`), all buttons (`.btn-solid` / `.wood-btn` / `.btn-pill` / `.btn-toggle` / `.btn-icon` / `.btn-outline`), and the tab bar (`.tab-bar::before`).
- All palette tokens (`--bg-primary`, `--bg-card`, `--accent`, text, borders, freshness) are back to their **original** values; works in light + dark.

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
