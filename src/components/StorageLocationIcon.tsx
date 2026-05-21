import type { JSX } from 'react';
import type { StorageLocation } from '../types';

interface Props {
  location: StorageLocation;
  size?: number;
  color?: string;
}

const ICONS: Record<StorageLocation, (c: string, sw: number) => JSX.Element> = {

  fridge: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="2" width="13" height="20" rx="2" />
      <line x1="5.5" y1="9.5" x2="18.5" y2="9.5" />
      <line x1="16" y1="5" x2="16" y2="7.5" />
      <line x1="16" y1="12.5" x2="16" y2="17" />
    </svg>
  ),

  freezer: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3V21M3 12H21" />
      <path d="M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4" />
      <path d="M12 3L10 5M12 3L14 5M12 21L10 19M12 21L14 19" />
      <path d="M3 12L5 10M3 12L5 14M21 12L19 10M21 12L19 14" />
    </svg>
  ),

  pantry: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3" width="17" height="18" rx="1.5" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <circle cx="9.5" cy="12" r="1" />
      <circle cx="14.5" cy="12" r="1" />
    </svg>
  ),

  counter: (c, sw) => (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="20" height="3" rx="1" />
      <line x1="6" y1="13" x2="5.5" y2="21" />
      <line x1="18" y1="13" x2="18.5" y2="21" />
      <path d="M9 10C9 10 9 7 12 7C15 7 15 10 15 10" />
    </svg>
  ),
};

export function StorageLocationIcon({ location, size = 20, color = 'var(--stone)' }: Props) {
  const icon = ICONS[location];
  if (!icon) return null;
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
