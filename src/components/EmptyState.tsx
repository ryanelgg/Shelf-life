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
      {/* A little scene instead of a floating mascot: Avo sitting on a shelf
          next to a jar with a sprout — same hand-drawn stroke as the icon set. */}
      <div style={{ position: 'relative', width: 168, height: 116 }}>
        <svg
          viewBox="0 0 168 116"
          width="168"
          height="116"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: 'absolute', inset: 0, opacity: 0.55 }}
          aria-hidden="true"
        >
          {/* shelf plank + support brackets */}
          <line x1="10" y1="103" x2="158" y2="103" />
          <path d="M26 103v7M142 103v7" />
          {/* jar with a sprout growing out of it */}
          <path d="M28 78h24v20a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4V78Z" />
          <line x1="26" y1="78" x2="54" y2="78" />
          <path d="M40 78v-8" />
          <path d="M40 72c-4-.8-7-3.4-7.6-7 4.2-.5 7 1.7 7.6 4.6Z" />
          <path d="M40 70c4-.8 7-3.4 7.6-7-4.2-.5-7 1.7-7.6 4.6Z" />
        </svg>
        <div style={{ position: 'absolute', right: 22, bottom: 12 }}>
          <AvocadoMascot size={84} />
        </div>
      </div>
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
