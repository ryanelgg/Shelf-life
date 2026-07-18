import type { JSX } from 'react';

// ── Line-icon set ────────────────────────────────────────────────────────────
//
// Pantre is emoji-free: every glyph in the UI chrome (tutorial, section headers,
// buttons, chips) is a hand-drawn line icon in the same language as the + menu
// icons — viewBox 0 0 24 24, no fill, stroke = currentColor, ~1.8 stroke width.
// Pass `color` to override, or just set `color` on the parent (currentColor).

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

function base(size: number): { width: number; height: number; viewBox: string; fill: string } {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' };
}

function svgProps({ size = 18, color = 'currentColor', strokeWidth = 1.8, className, style }: IconProps) {
  return {
    ...base(size),
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    'aria-hidden': true,
  };
}

// Plus / add
export function PlusIcon(p: IconProps): JSX.Element {
  return <svg {...svgProps(p)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}

// Pantry jar (stands in for the old 🥫)
export function JarIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M7 8h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8Z" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

// Chat bubble (💬)
export function ChatIcon(p: IconProps): JSX.Element {
  return <svg {...svgProps(p)}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" /></svg>;
}

// Alert / recall (🚨) — bell with a ring
export function AlertIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

// Warning triangle (⚠️)
export function WarningIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Sparkle (✨) — the AI / "generate with Avo" mark
export function SparkleIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15Z" />
    </svg>
  );
}

// Star (⭐) — filled so "Rate Pantre" reads clearly
export function StarIcon({ size = 18, color = 'currentColor', className, style }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.2Z" />
    </svg>
  );
}

// Heart (❤️)
export function HeartIcon({ size = 18, color = 'currentColor', className, style }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 20.5S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 6.7a4.4 4.4 0 0 1 8.5 2.2C20.5 15 12 20.5 12 20.5Z" />
    </svg>
  );
}

// Medical cross (⚕️) — for the Avo medical disclaimer
export function MedicalIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

// Radar / satellite dish (🛰️) — Shopping Radar
export function RadarIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9" /><path d="M12 8a4 4 0 0 1 4 4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Shopping cart (🛒)
export function CartIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6" />
    </svg>
  );
}

// Takeout box (🥡) — leftovers
export function TakeoutIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M5 8h14l-1.3 11a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M4 8l3-4.5M20 8l-3-4.5M9 3.5h6" /><line x1="12" y1="8" x2="12" y2="21" />
    </svg>
  );
}

// Check in a circle (✅) — success confirmations
export function CheckCircleIcon(p: IconProps): JSX.Element {
  return <svg {...svgProps(p)}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>;
}

// Party popper (🎉) — celebrations
export function PartyIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M3 21l6.5-2.2-4.3-4.3L3 21Z" />
      <path d="M5.2 14.5 14 5.7a3.5 3.5 0 0 1 4.9 0l.4.4" />
      <line x1="15" y1="4" x2="15" y2="2" /><line x1="19.5" y1="6.5" x2="21" y2="5" /><line x1="20" y1="11" x2="22" y2="11" />
    </svg>
  );
}

// Medal / rank (🥇🥈🥉) — leaderboard positions. `place` colours the ribbon.
export function MedalIcon({ size = 18, place = 1, style }: IconProps & { place?: number }): JSX.Element {
  const metal = place === 1 ? '#D4A44A' : place === 2 ? '#AEB4BA' : '#B67A46';
  return (
    <svg {...base(size)} style={style} aria-hidden="true">
      <path d="M8 3H5l3.2 6.2A5 5 0 0 1 12 8V3H8Z" fill="none" stroke={metal} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 3h3l-3.2 6.2A5 5 0 0 0 12 8V3h4Z" fill="none" stroke={metal} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="6" fill="none" stroke={metal} strokeWidth="1.8" />
      <circle cx="12" cy="15" r="2.4" fill={metal} />
    </svg>
  );
}

// ── Diet chips (onboarding) ──────────────────────────────────────────────────

// Plate + utensils (🍽️ — "no restrictions")
export function PlateIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

// Leaf (🥬 — vegetarian)
export function LeafIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M20 4S9 3 5.5 9.5 8 20 8 20s8 .5 11-6S20 4 20 4Z" />
      <path d="M8 20C10 14 13 10 18 7" />
    </svg>
  );
}

// Sprout (🌱 — vegan)
export function SproutIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M12 21v-8" />
      <path d="M12 13C12 9 8 7 4 8c0 4 4 6 8 5Z" />
      <path d="M12 11c0-3.5 4-5.5 8-4.5 0 3.6-4 5.6-8 4.5Z" />
    </svg>
  );
}

// Wheat (🌾 — gluten-free base; caller can add a slash for "free")
export function WheatIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M12 21V9" />
      <path d="M12 9c-2-1-3.2-2.6-3-5 2.2-.2 3.8.9 4 3M12 9c2-1 3.2-2.6 3-5-2.2-.2-3.8.9-4 3" />
      <path d="M12 15c-2-1-3.2-2.6-3-5M12 15c2-1 3.2-2.6 3-5" />
    </svg>
  );
}

// Milk glass (🥛 — dairy-free base)
export function MilkIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M7 3h10l-1 5v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8L7 3Z" />
      <line x1="7.6" y1="8" x2="16.4" y2="8" />
    </svg>
  );
}

// Peanut (🥜 — nut-free base)
export function PeanutIcon(p: IconProps): JSX.Element {
  return (
    <svg {...svgProps(p)}>
      <path d="M9 3.5a3.5 3.5 0 0 1 6 0c0 1.6-.8 2.3-.8 3.8s.8 2 .8 3.7a3.5 3.5 0 0 1-6 0c0-1.7.8-2.2.8-3.7S9 5.1 9 3.5Z" transform="translate(0 4) scale(1 0.9)" />
      <path d="M10 10h4" />
    </svg>
  );
}

// A small diagonal slash overlay to signal "free of" (dairy-free, nut-free, GF).
export function FreeOfSlash({ size = 18, color = 'var(--expired)' }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <line x1="4" y1="20" x2="20" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Streak sprout ────────────────────────────────────────────────────────────
//
// The zero-waste streak drawn as a growing plant: seed → seedling → sapling →
// leafy plant → small tree. Stage thresholds mirror the milestone ladder
// (3 / 7 / 14 / 30 / 100 days). Stroke follows the app accent.

export function StreakSprout({ days, size = 44, color = 'var(--accent)' }: { days: number; size?: number; color?: string }): JSX.Element {
  const stage = days <= 0 ? 0 : days < 3 ? 1 : days < 7 ? 2 : days < 14 ? 3 : days < 30 ? 4 : days < 100 ? 5 : 6;
  const p = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* soil mound — always there */}
      <path {...p} d="M6 21c2-1.6 10-1.6 12 0" />
      {stage === 0 && <circle {...p} cx="12" cy="19" r="1.6" />}
      {stage >= 1 && <path {...p} d={`M12 21V${21 - [0, 5, 8, 10, 12, 13, 14][stage]}`} />}
      {/* first leaf pair */}
      {stage >= 1 && <path {...p} d="M12 17c-1.6-.4-3-1.7-3.2-3.4 1.8-.2 3 .9 3.2 2.4Z" />}
      {stage >= 2 && <path {...p} d="M12 16c1.6-.4 3-1.7 3.2-3.4-1.8-.2-3 .9-3.2 2.4Z" />}
      {/* second pair, higher */}
      {stage >= 3 && <path {...p} d="M12 13c-1.5-.3-2.7-1.4-2.9-2.9 1.6-.2 2.7.7 2.9 2Z" />}
      {stage >= 4 && <path {...p} d="M12 12c1.5-.3 2.7-1.4 2.9-2.9-1.6-.2-2.7.7-2.9 2Z" />}
      {/* crown */}
      {stage === 5 && <path {...p} d="M12 8c-.9-1.5-.5-3.3 1-4.4 1 1.4.7 3.2-1 4.4Z" />}
      {stage >= 6 && <circle {...p} cx="12" cy="6" r="3.4" />}
    </svg>
  );
}
