import { useState } from 'react';
import { Card } from './Card';

interface PantryMergeModalProps {
  itemCount: number;
  onMerge: () => Promise<void>;
  onDiscard: () => Promise<void>;
}

export function PantryMergeModal({ itemCount, onMerge, onDiscard }: PantryMergeModalProps) {
  const [submitting, setSubmitting] = useState<'merge' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mode: 'merge' | 'discard', fn: () => Promise<void>) => {
    setSubmitting(mode);
    setError(null);
    try {
      await fn();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
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
          Welcome back!
        </h2>

        <Card>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            margin: 0,
          }}>
            You have {itemCount} {itemCount === 1 ? 'item' : 'items'} on this device that {itemCount === 1 ? "isn't" : "aren't"} in your account yet.
            Add {itemCount === 1 ? 'it' : 'them'} to your account, or start fresh with what's already saved in the cloud?
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
            onClick={() => { void run('merge', onMerge); }}
            disabled={submitting !== null}
            style={{
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting && submitting !== 'merge' ? 0.5 : 1,
            }}
          >
            {submitting === 'merge' ? 'Adding…' : `Add to my account`}
          </button>
          <button
            onClick={() => { void run('discard', onDiscard); }}
            disabled={submitting !== null}
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
              opacity: submitting && submitting !== 'discard' ? 0.5 : 1,
            }}
          >
            {submitting === 'discard' ? 'Loading…' : 'Discard and use my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
