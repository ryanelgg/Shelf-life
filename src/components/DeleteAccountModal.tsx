import { useState } from 'react';
import { Card } from './Card';

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const PERMANENTLY_LOST = [
  'Your account and sign-in',
  'All pantry items, expiration dates, and notes',
  'Your cook log, waste log, and impact stats',
  'Dietary preferences and onboarding progress',
  'Pro subscription access (cancel separately in Apple Settings to stop billing)',
];

export function DeleteAccountModal({ onClose, onConfirm }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE' && !submitting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete account. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--expired)' }}>
          Delete Account
        </h2>
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600,
            fontFamily: "'Cormorant Garamond', serif",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Warning icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="var(--expired)" opacity="0.12" />
            <path
              d="M20 11 L20 22 M20 27 L20 28.5"
              stroke="var(--expired)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: '15px',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          padding: '0 8px',
        }}>
          This permanently deletes your Pantre account and all of its data.
          <br />
          <strong style={{ color: 'var(--expired)' }}>This cannot be undone.</strong>
        </p>

        {/* What gets deleted */}
        <Card>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '10px',
          }}>
            What will be deleted
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PERMANENTLY_LOST.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--expired)', fontSize: '14px', lineHeight: 1.5 }}>✕</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Confirmation input */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '6px',
            fontFamily: "'Cormorant Garamond', serif",
          }}>
            Type <strong style={{ color: 'var(--expired)' }}>DELETE</strong> to confirm
          </label>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={submitting}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: `1.5px solid ${canDelete ? 'var(--expired)' : 'var(--input-border)'}`,
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontFamily: "'DM Mono', monospace",
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '0.1em',
              textAlign: 'center',
            }}
          />
        </div>

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

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <button
            onClick={() => { void handleDelete(); }}
            disabled={!canDelete}
            style={{
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: canDelete ? 'var(--expired)' : 'var(--accent-dim)',
              color: canDelete ? '#fff' : 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Deleting…' : 'Permanently delete my account'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '12px',
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
            Keep my account
          </button>
        </div>
      </div>
    </div>
  );
}
