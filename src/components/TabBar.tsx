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

function AvoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Body — oval/egg */}
      <ellipse cx="12" cy="13" rx="7.5" ry="10" />
      {/* Pit — small */}
      <circle cx="12" cy="17" r="2" />
      {/* Eyes */}
      <circle cx="9.8" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="10" r="1" fill="currentColor" stroke="none" />
      {/* Smile */}
      <path d="M10.5 12.5C11.5 13.5 12.5 13.5 13.5 12.5" />
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

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" />
    </svg>
  );
}

const tabs: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: 'pantry', label: 'Pantry', Icon: PantryIcon },
  { id: 'add', label: 'Add', Icon: AddIcon },
  { id: 'cook', label: 'Chat', Icon: AvoIcon },
  { id: 'impact', label: 'Impact', Icon: ImpactIcon },
  { id: 'plan', label: 'Plan', Icon: PlanIcon },
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
              fontFamily: "'Cormorant Garamond', serif",
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
