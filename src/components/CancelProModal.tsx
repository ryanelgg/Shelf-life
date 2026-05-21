import { useState } from 'react';
import { Card } from './Card';

interface CancelProModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

const KEEP_FEATURES = [
  'Your pantry and waste logs',
  'Your dietary preferences',
  'Your streak and activity history',
];

const LOSE_FEATURES = [
  'Unlimited pantry items (back to 20)',
  '20 Avo chats per day (back to 5)',
  'Receipt scanning',
  'Personalized meal plans',
];

export function CancelProModal({ onClose, onConfirm }: CancelProModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        animation: 'upgradeFadeIn 0.35s ease-out',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            {/* Broken crown — left half tilted back, right half tilted forward, with a jagged gap where the center peak used to be */}
            <g transform="rotate(-6 14 30)">
              <path d="M6 28 L10 14 L16 22 L18.5 17 L17.5 23 L18 28 Z" fill="#D4A44A" stroke="#A07830" strokeWidth="1.8" strokeLinejoin="round"/>
              <rect x="6" y="28" width="12" height="4" rx="1.5" fill="#D4A44A" stroke="#A07830" strokeWidth="1.5"/>
              <circle cx="10" cy="14" r="2" fill="#E8C860"/>
            </g>
            <g transform="rotate(6 26 30)">
              <path d="M22 28 L22.5 23 L21.5 17 L24 22 L30 14 L34 28 Z" fill="#D4A44A" stroke="#A07830" strokeWidth="1.8" strokeLinejoin="round"/>
              <rect x="22" y="28" width="12" height="4" rx="1.5" fill="#D4A44A" stroke="#A07830" strokeWidth="1.5"/>
              <circle cx="30" cy="14" r="2" fill="#E8C860"/>
            </g>
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Cancel Pro?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            You'll keep your data, but lose access to Pro features immediately.
          </p>
        </div>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
            You'll keep
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {KEEP_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="var(--accent)" opacity="0.15"/>
                  <path d="M5 8 L7 10 L11 6" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {f}
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
            You'll lose
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {LOSE_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="var(--expired)" opacity="0.15"/>
                  <path d="M5 5 L11 11 M11 5 L5 11" stroke="var(--expired)" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                {f}
              </div>
            ))}
          </div>
        </Card>

        <button
          onClick={handleConfirm}
          disabled={submitting}
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: `1.5px solid var(--expired)`,
            background: 'transparent',
            color: 'var(--expired)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '16px',
            fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            marginTop: '4px',
          }}
        >
          {submitting ? 'Cancelling…' : 'Cancel Pro'}
        </button>

        <button
          onClick={submitting ? undefined : onClose}
          style={{
            padding: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          Keep Pro
        </button>
      </div>

      <style>{`
        @keyframes upgradeFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
