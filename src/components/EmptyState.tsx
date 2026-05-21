import { AvocadoMascot } from './AvocadoMascot';
import { useStore } from '../store/useStore';
import type { Tab } from '../types';

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTab?: Tab;
  /** Optional secondary action — renders a smaller button below the primary CTA */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaTab,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  const { setActiveTab } = useStore();

  return (
    <div
      className="screen-enter"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px',
        gap: '14px',
        textAlign: 'center',
      }}
    >
      <AvocadoMascot size={84} />
      <h2 style={{
        fontSize: '22px',
        fontWeight: 800,
        fontFamily: "'Cormorant Garamond', serif",
        color: 'var(--text-primary)',
        marginTop: '6px',
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: '14px',
        color: 'var(--text-muted)',
        lineHeight: 1.55,
        maxWidth: '300px',
        margin: 0,
      }}>
        {description}
      </p>
      {ctaLabel && ctaTab && (
        <button
          onClick={() => setActiveTab(ctaTab)}
          style={{
            marginTop: '12px',
            padding: '12px 28px',
            borderRadius: '24px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(74, 124, 89, 0.25)',
          }}
        >
          {ctaLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <button
          onClick={onSecondary}
          style={{
            marginTop: '4px',
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
