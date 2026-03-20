import type { StorageLocation } from '../types';

interface Props {
  location: StorageLocation;
  size?: number;
  color?: string;
}

const ICONS: Record<StorageLocation, (c: string) => JSX.Element> = {

  fridge: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* body */}
      <rect x="5.5" y="2" width="13" height="20" rx="2" />
      {/* door split */}
      <line x1="5.5" y1="9.5" x2="18.5" y2="9.5" />
      {/* freezer handle */}
      <line x1="16" y1="5" x2="16" y2="7.5" />
      {/* fridge handle */}
      <line x1="16" y1="12.5" x2="16" y2="17" />
    </svg>
  ),

  freezer: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* cross axes */}
      <path d="M12 3V21M3 12H21" />
      {/* diagonal axes */}
      <path d="M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4" />
      {/* branch tips */}
      <path d="M12 3L10 5M12 3L14 5M12 21L10 19M12 21L14 19" />
      <path d="M3 12L5 10M3 12L5 14M21 12L19 10M21 12L19 14" />
    </svg>
  ),

  pantry: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* cabinet body */}
      <rect x="3.5" y="3" width="17" height="18" rx="1.5" />
      {/* center divider */}
      <line x1="12" y1="3" x2="12" y2="21" />
      {/* left knob */}
      <circle cx="9.5" cy="12" r="1" />
      {/* right knob */}
      <circle cx="14.5" cy="12" r="1" />
    </svg>
  ),

  counter: (c) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* counter top */}
      <rect x="2" y="10" width="20" height="3" rx="1" />
      {/* left leg */}
      <line x1="6" y1="13" x2="5.5" y2="21" />
      {/* right leg */}
      <line x1="18" y1="13" x2="18.5" y2="21" />
      {/* something sitting on counter — small bowl */}
      <path d="M9 10C9 10 9 7 12 7C15 7 15 10 15 10" />
    </svg>
  ),
};

export function StorageLocationIcon({ location, size = 20, color = 'var(--stone)' }: Props) {
  const icon = ICONS[location];
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
