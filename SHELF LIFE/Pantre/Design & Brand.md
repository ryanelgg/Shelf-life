# Pantre — Design & Brand

← [[Pantre]]

## Name & Mascot
- **App name:** Pantre (play on "pantry") — renamed from Shelf Life on 2026-04-24
- **Mascot:** Avo — a hand-drawn, 2D illustrated avocado with botanical leaf veins, natural feel
- 8 expressions, walking/bouncing/wiggling animations, tap reactions

## Aesthetic
"Farmer's market Saturday morning" — homelike, earthy, warm.

Evolved from a "modern/Zova-like" initial look to something more illustrative and grounded.

### Light-wood outline (2026-06-17)
Final direction: **keep the original farmer's-market colors** and add a thin **light-wood outline/frame** around UI elements (not a full wood recolor — earlier attempts at paper grain, then full wood surfaces, were both rejected).
- **Light-wood texture** = two anisotropic `feTurbulence` grain SVGs (`--wgrain` + `--wgrain-fine`) blended `soft-light` over a light-oak gradient. Exposed as reusable tokens: `--wood-frame-color/-image/-size/-blend` and `--wood-frame-w` (frame width, 3px) in `globals.css`.
- **Framing technique:** a `::before` fills the element box with wood, then a `mask` (content-box exclude) punches out the center, leaving only the ring. `border-radius: inherit` makes one rule frame any shape — cards (16px), buttons, the round FAB.
- **Applied to:** cards (`.card-component::before`), primary buttons (`.btn-solid`), the FAB (`.wood-btn`). Tab bar gets a thin wood lip strip along its top (`.tab-bar::before`).
- **Outline colors:** `--card-border`, `--tab-border`, `--input-border` recolored to light-wood tones so 1px borders (pills, inputs, chips) read as wood too.
- All original palette tokens (`--bg-primary`, `--bg-card`, `--accent`, text, freshness) are **unchanged**; works in light + dark.

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
