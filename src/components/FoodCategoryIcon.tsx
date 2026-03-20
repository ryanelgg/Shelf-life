import type { FoodCategory } from '../types';

interface Props {
  category: FoodCategory;
  size?: number;
  color?: string;
}

// Thin brown outline SVG icons — one per food category
const ICONS: Record<FoodCategory, (color: string) => JSX.Element> = {

  Produce: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* stem + leaf curl */}
      <path d="M12 7C12 7 11.5 4.5 9 3.5" />
      <path d="M12 7C12 7 13.5 5 15 5.5" />
      {/* apple body */}
      <path d="M8 9.5C6 10.5 4.5 12.5 4.5 15C4.5 18.5 7.5 21.5 12 21.5C16.5 21.5 19.5 18.5 19.5 15C19.5 12.5 18 10.5 16 9.5C14.5 8.5 13 8.5 12 8.5C11 8.5 9.5 8.5 8 9.5Z" />
    </svg>
  ),

  Dairy: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* cap */}
      <rect x="9.5" y="2.5" width="5" height="2.5" rx="0.6" />
      {/* bottle body */}
      <path d="M9.5 5C8.5 5 7.5 6 7.5 7.5V19.5C7.5 20.5 9 21.5 12 21.5C15 21.5 16.5 20.5 16.5 19.5V7.5C16.5 6 15.5 5 14.5 5H9.5Z" />
      {/* label lines */}
      <path d="M9.5 13H14.5M9.5 15.5H13" />
    </svg>
  ),

  Meat: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* drumstick body */}
      <path d="M15.5 4C15.5 4 19.5 8 15.5 12L10 17.5L8.5 16L14 10.5C10.5 7 12 3 15.5 4Z" />
      {/* bone end circle */}
      <circle cx="8" cy="17.5" r="2.5" />
    </svg>
  ),

  Seafood: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* fish body */}
      <ellipse cx="10.5" cy="12" rx="6" ry="4" />
      {/* tail */}
      <path d="M16.5 12L21 8.5V15.5L16.5 12Z" />
      {/* eye */}
      <circle cx="8.5" cy="11" r="0.9" fill={c} />
      {/* top fin */}
      <path d="M10 8.5C11.5 7 13 7.5 12.5 9" />
    </svg>
  ),

  Grains: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* center stalk */}
      <path d="M12 21V7" />
      {/* top grain pair */}
      <path d="M12 9C11 7.5 9 7 9 5.5C11 5 12 7.5 12 9Z" />
      <path d="M12 9C13 7.5 15 7 15 5.5C13 5 12 7.5 12 9Z" />
      {/* middle grain pair */}
      <path d="M12 13C11 11.5 9 11 9 9.5C11 9 12 11.5 12 13Z" />
      <path d="M12 13C13 11.5 15 11 15 9.5C13 9 12 11.5 12 13Z" />
      {/* lower grain pair */}
      <path d="M12 17C11 15.5 9 15 9 13.5C11 13 12 15.5 12 17Z" />
      <path d="M12 17C13 15.5 15 15 15 13.5C13 13 12 15.5 12 17Z" />
    </svg>
  ),

  Frozen: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* main cross axes */}
      <path d="M12 3V21M3 12H21" />
      {/* diagonal axes */}
      <path d="M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4" />
      {/* small branch tips */}
      <path d="M12 3L10 5M12 3L14 5M12 21L10 19M12 21L14 19" />
      <path d="M3 12L5 10M3 12L5 14M21 12L19 10M21 12L19 14" />
    </svg>
  ),

  Canned: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* top ellipse */}
      <ellipse cx="12" cy="6" rx="6" ry="2" />
      {/* sides */}
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="18" y1="6" x2="18" y2="18" />
      {/* bottom ellipse */}
      <ellipse cx="12" cy="18" rx="6" ry="2" />
      {/* label lines */}
      <path d="M8.5 11.5H15.5M8.5 13.5H13.5" />
    </svg>
  ),

  Snacks: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* bag top twist */}
      <path d="M9 6.5C9 6.5 9 4 12 4C15 4 15 6.5 15 6.5" />
      {/* bag body */}
      <path d="M9 6.5L7.5 20.5H16.5L15 6.5" />
      {/* label lines */}
      <path d="M9.5 12.5H14.5M10 15H14" />
    </svg>
  ),

  Beverages: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* cup/glass body */}
      <path d="M6.5 3.5H17.5L16 21H8L6.5 3.5Z" />
      {/* liquid fill line */}
      <path d="M7.5 8.5H16.5" />
      {/* straw */}
      <path d="M14 3.5L16.5 20" strokeDasharray="1.5 1.5" />
    </svg>
  ),

  Condiments: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* nozzle */}
      <path d="M11 2.5H13V5.5H11V2.5Z" />
      {/* drip */}
      <path d="M12 5.5V7" />
      {/* bottle body */}
      <path d="M9 7C8 7.5 7.5 9 7.5 10.5V19C7.5 20.1 9 21.5 12 21.5C15 21.5 16.5 20.1 16.5 19V10.5C16.5 9 16 7.5 15 7H9Z" />
      {/* label lines */}
      <path d="M9.5 14.5H14.5M9.5 16.5H13" />
    </svg>
  ),

  Bakery: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* loaf body */}
      <path d="M5 15C5 10.5 7.5 7 12 7C16.5 7 19 10.5 19 15V21H5V15Z" />
      {/* dome score line on top */}
      <path d="M8.5 11.5C8.5 11.5 10 9 12 9C14 9 15.5 11.5 15.5 11.5" />
      {/* slice cuts */}
      <path d="M9 15V21M14 15V21" />
    </svg>
  ),

  Deli: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* top bread dome */}
      <path d="M4.5 9C4.5 9 5.5 6 12 6C18.5 6 19.5 9 19.5 9V11H4.5V9Z" />
      {/* filling bulge top */}
      <path d="M4.5 11C4.5 11 6 13.5 12 13.5C18 13.5 19.5 11 19.5 11" />
      {/* filling bulge bottom */}
      <path d="M4.5 15C4.5 15 6 13.5 12 13.5C18 13.5 19.5 15 19.5 15" />
      {/* bottom bread flat */}
      <path d="M4.5 15V17C4.5 17 5.5 19 12 19C18.5 19 19.5 17 19.5 17V15H4.5Z" />
    </svg>
  ),

  Other: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* box front face */}
      <rect x="4" y="10" width="16" height="12" rx="0.8" />
      {/* top flap left */}
      <path d="M4 10L12 5.5L20 10" />
      {/* center fold */}
      <path d="M12 5.5V22" />
      {/* tape strip */}
      <path d="M9.5 13.5H14.5" />
    </svg>
  ),
};

export function FoodCategoryIcon({ category, size = 22, color = 'var(--stone)' }: Props) {
  const icon = ICONS[category];
  if (!icon) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flexShrink: 0,
    }}>
      {icon(color)}
    </span>
  );
}
