# Pantre — Design & Brand

← [[Pantre]]

## Name & Mascot
- **App name:** Pantre (play on "pantry") — renamed from Shelf Life on 2026-04-24
- **Mascot:** Avo — a hand-drawn, 2D illustrated avocado with botanical leaf veins, natural feel
- 8 expressions, walking/bouncing/wiggling animations, tap reactions

## Aesthetic
"Farmer's market Saturday morning" — homelike, earthy, warm.

Evolved from a "modern/Zova-like" initial look to something more illustrative and grounded.

### Wood-texture revamp (2026-06-17)
Gave the whole app a natural **real-wood** look (replacing an initial paper-grain attempt that read too "grainy").
- **Wood grain = SVG noise over a brown gradient.** Two anisotropic `feTurbulence` SVGs (grayscale streaks, tokens `--wgrain` + `--wgrain-fine` in `globals.css`) are blended via `soft-light` over a warm brown `linear-gradient` to read as wood.
- **Three wood tones** (`.wood-oak` / `.wood-board` / `.wood-walnut` mixins):
  - **Oak** — app background / "table" (`body`) and tab bar shelf (`.tab-bar::before`)
  - **Light board** — cards (`.card-component::after`), like a cutting board
  - **Walnut** — primary buttons (`.btn-solid::before`) and the FAB (`.wood-btn`)
- **Buttons & everything:** primary CTAs are solid walnut; secondary buttons (pills/toggles/icon/outline) keep their color but get a wood-grain *sheen* via a `soft-light` `::before` so state colors still read.
- Surface overlays use the `isolation: isolate` + `z-index:-1` trick so the wood covers each surface's fill but stays behind content — text stays crisp.
- **Palette shifted to wood:** `--bg-primary` oak `#c39e6d`, `--bg-card` board `#ecd9b6`, `--tab-bg` `#b88f5d`; text darkened (`--text-primary #3a2a18`, `--text-muted #6f5b41`) for contrast on wood.
- **Dark mode** = stained walnut (darker wood gradients + cream text).

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
