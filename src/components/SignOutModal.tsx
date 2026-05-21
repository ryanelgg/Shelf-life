import { useState } from 'react';
import { Card } from './Card';

interface SignOutModalProps {
  isPro: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function SignOutModal({ isPro, onClose, onConfirm }: SignOutModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Could not sign out right now. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div style={{
        width: '100%',
        background: 'var(--bg-primary)',
        borderRadius: '24px 24px 0 0',
        padding: '24px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Handle bar */}
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'var(--tab-border)',
          alignSelf: 'center',
          marginTop: '-12px',
          marginBottom: '4px',
        }} />

        <h2 style={{ fontSize: '20px', fontWeight: 800, textAlign: 'center' }}>
          Sign Out
        </h2>

        <Card>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            margin: 0,
          }}>
            {isPro
              ? 'Your data is saved in the cloud. Everything will be here when you sign back in.'
              : 'Your pantry, logs, and preferences will be cleared on this device. Upgrade to Pro to keep your data in the cloud.'}
          </p>
        </Card>

        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(220,53,69,0.08)',
            border: '1px solid var(--expired)',
            color: 'var(--expired)',
            fontSize: '12px',
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => { void handleSignOut(); }}
            disabled={submitting}
            style={{
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: 'var(--expired)',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing out…' : 'Sign Out'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '13px',
              borderRadius: '14px',
              border: '1px solid var(--tab-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
