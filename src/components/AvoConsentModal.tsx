import { useState } from 'react';
import { Card } from './Card';
import { AvocadoMascot } from './AvocadoMascot';

interface AvoConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function AvoConsentModal({ onAccept, onDecline }: AvoConsentModalProps) {
  const [showLearnMore, setShowLearnMore] = useState(false);

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
        animation: 'consentFadeIn 0.35s ease-out',
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
          <AvocadoMascot size={84} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Meet Avo, your nutrition guide</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Ask anything about what's in your pantry — calories, meal ideas, what to eat before a workout. Your question and pantry list are processed by{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Groq's Llama AI</span>{' '}
            to give you personalized answers.
          </p>
        </div>

        <Card style={{ padding: '16px 18px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="8" cy="8" r="7" fill="var(--accent)" opacity="0.15"/>
              <path d="M8 4.5 L8 8.5 M8 11 L8 11.5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                Your data is never used to train AI models.
              </div>
              <button
                onClick={() => setShowLearnMore(v => !v)}
                style={{
                  marginTop: '6px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  color: 'var(--accent)',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {showLearnMore ? 'Hide details' : 'Learn more →'}
              </button>
              {showLearnMore && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--tab-border)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                }}>
                  When you chat with Avo, we send your question plus a short summary of your pantry (item names only — no dates, quantities, or personal info) to Groq's Llama API. Photo features (scanning a receipt or your fridge) send that image to Anthropic's Claude API instead. Neither provider retains your data or uses it to train models.
                </div>
              )}
            </div>
          </div>
        </Card>

        <button
          onClick={onAccept}
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(74,124,89,0.35)',
            marginTop: '4px',
          }}
        >
          Turn on Avo AI
        </button>

        <button
          onClick={onDecline}
          style={{
            padding: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Not right now
        </button>
      </div>

      <style>{`
        @keyframes consentFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
