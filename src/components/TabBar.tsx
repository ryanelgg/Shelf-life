import { useStore } from '../store/useStore';
import type { Tab } from '../types';

function PantryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10L12 3l9 7v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function CookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8 2 4 6 4 10c0 3 2 5 4 6v2h8v-2c2-1 4-3 4-6 0-4-4-8-8-8z" />
      <path d="M8 20h8" />
      <path d="M9 22h6" />
    </svg>
  );
}

function ImpactIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

const tabs: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: 'pantry', label: 'Pantry', Icon: PantryIcon },
  { id: 'add', label: 'Add', Icon: AddIcon },
  { id: 'cook', label: 'Cook', Icon: CookIcon },
  { id: 'impact', label: 'Impact', Icon: ImpactIcon },
  { id: 'lists', label: 'Lists', Icon: ListIcon },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useStore();

  return (
    <div style={{
      display: 'flex',
      background: 'var(--tab-bg)',
      borderTop: '1px solid var(--tab-border)',
      padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
      flexShrink: 0,
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            className="btn-tab"
            onClick={() => setActiveTab(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 4px 4px',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <span style={{
              transform: isActive ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex',
            }}>
              <Icon />
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontFamily: 'Syne, sans-serif',
            }}>{label}</span>
            <span
              key={`${id}-${isActive}`}
              className={isActive ? 'tab-dot' : ''}
              style={{
                width: 4, height: 4, borderRadius: '50%',
                background: isActive ? 'var(--accent)' : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
