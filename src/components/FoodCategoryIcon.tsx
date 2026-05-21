import type { JSX } from 'react';
import type { FoodCategory } from '../types';

interface Props {
  category: FoodCategory;
  size?: number;
  color?: string;
}

// Outline SVG icons — one per food category
// strokeWidth is passed in so small icons stay visible
const ICONS: Record<FoodCategory, (c: string, sw: number) => JSX.Element> = {

  Produce: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7C12 7 11.5 4.5 9 3.5" />
      <path d="M12 7C12 7 13.5 5 15 5.5" />
      <path d="M8 9.5C6 10.5 4.5 12.5 4.5 15C4.5 18.5 7.5 21.5 12 21.5C16.5 21.5 19.5 18.5 19.5 15C19.5 12.5 18 10.5 16 9.5C14.5 8.5 13 8.5 12 8.5C11 8.5 9.5 8.5 8 9.5Z" />
    </svg>
  ),

  Dairy: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9.5" y="2.5" width="5" height="2.5" rx="0.6" />
      <path d="M9.5 5C8.5 5 7.5 6 7.5 7.5V19.5C7.5 20.5 9 21.5 12 21.5C15 21.5 16.5 20.5 16.5 19.5V7.5C16.5 6 15.5 5 14.5 5H9.5Z" />
      <path d="M9.5 13H14.5M9.5 15.5H13" />
    </svg>
  ),

  Meat: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 4C15.5 4 19.5 8 15.5 12L10 17.5L8.5 16L14 10.5C10.5 7 12 3 15.5 4Z" />
      <circle cx="8" cy="17.5" r="2.5" />
    </svg>
  ),

  Seafood: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10.5" cy="12" rx="6" ry="4" />
      <path d="M16.5 12L21 8.5V15.5L16.5 12Z" />
      <circle cx="8.5" cy="11" r="0.9" fill={c} />
      <path d="M10 8.5C11.5 7 13 7.5 12.5 9" />
    </svg>
  ),

  Grains: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V7" />
      <path d="M12 9C11 7.5 9 7 9 5.5C11 5 12 7.5 12 9Z" />
      <path d="M12 9C13 7.5 15 7 15 5.5C13 5 12 7.5 12 9Z" />
      <path d="M12 13C11 11.5 9 11 9 9.5C11 9 12 11.5 12 13Z" />
      <path d="M12 13C13 11.5 15 11 15 9.5C13 9 12 11.5 12 13Z" />
      <path d="M12 17C11 15.5 9 15 9 13.5C11 13 12 15.5 12 17Z" />
      <path d="M12 17C13 15.5 15 15 15 13.5C13 13 12 15.5 12 17Z" />
    </svg>
  ),

  Frozen: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3V21M3 12H21" />
      <path d="M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4" />
      <path d="M12 3L10 5M12 3L14 5M12 21L10 19M12 21L14 19" />
      <path d="M3 12L5 10M3 12L5 14M21 12L19 10M21 12L19 14" />
    </svg>
  ),

  Canned: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="6" ry="2" />
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="18" y1="6" x2="18" y2="18" />
      <ellipse cx="12" cy="18" rx="6" ry="2" />
      <path d="M8.5 11.5H15.5M8.5 13.5H13.5" />
    </svg>
  ),

  Snacks: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6.5C9 6.5 9 4 12 4C15 4 15 6.5 15 6.5" />
      <path d="M9 6.5L7.5 20.5H16.5L15 6.5" />
      <path d="M9.5 12.5H14.5M10 15H14" />
    </svg>
  ),

  Beverages: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5H17.5L16 21H8L6.5 3.5Z" />
      <path d="M7.5 8.5H16.5" />
      <path d="M14 3.5L16.5 20" strokeDasharray="1.5 1.5" />
    </svg>
  ),

  Condiments: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5H13V5.5H11V2.5Z" />
      <path d="M12 5.5V7" />
      <path d="M9 7C8 7.5 7.5 9 7.5 10.5V19C7.5 20.1 9 21.5 12 21.5C15 21.5 16.5 20.1 16.5 19V10.5C16.5 9 16 7.5 15 7H9Z" />
      <path d="M9.5 14.5H14.5M9.5 16.5H13" />
    </svg>
  ),

  Bakery: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15C5 10.5 7.5 7 12 7C16.5 7 19 10.5 19 15V21H5V15Z" />
      <path d="M8.5 11.5C8.5 11.5 10 9 12 9C14 9 15.5 11.5 15.5 11.5" />
      <path d="M9 15V21M14 15V21" />
    </svg>
  ),

  Deli: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 9C4.5 9 5.5 6 12 6C18.5 6 19.5 9 19.5 9V11H4.5V9Z" />
      <path d="M4.5 11C4.5 11 6 13.5 12 13.5C18 13.5 19.5 11 19.5 11" />
      <path d="M4.5 15C4.5 15 6 13.5 12 13.5C18 13.5 19.5 15 19.5 15" />
      <path d="M4.5 15V17C4.5 17 5.5 19 12 19C18.5 19 19.5 17 19.5 17V15H4.5Z" />
    </svg>
  ),

  Other: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="12" rx="0.8" />
      <path d="M4 10L12 5.5L20 10" />
      <path d="M12 5.5V22" />
      <path d="M9.5 13.5H14.5" />
    </svg>
  ),
};

export function FoodCategoryIcon({ category, size = 22, color = 'var(--stone)' }: Props) {
  const icon = ICONS[category];
  if (!icon) return null;
  // Scale stroke width up for small icons so they stay visible
  const sw = size <= 16 ? 2.2 : 1.4;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flexShrink: 0,
    }}>
      {icon(color, sw)}
    </span>
  );
}
