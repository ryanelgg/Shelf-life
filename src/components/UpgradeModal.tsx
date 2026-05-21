import { useState, useEffect } from 'react';
import { Card } from './Card';
import { hapticSuccess } from '../lib/haptics';

interface UpgradeModalProps {
  feature: 'pantry' | 'chat' | 'receipt' | 'mealplan' | 'onboarding';
  onClose: () => void;
  onUpgrade: () => void;
  /** Delay in ms before the close button appears. 0 = immediate. */
  closeDelay?: number;
}

const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  pantry: {
    title: 'Pantry limit reached',
    description: 'Free accounts can track up to 20 items. Upgrade to Pro for unlimited pantry tracking.',
  },
  chat: {
    title: "You've used all your free chats",
    description: 'Free accounts get 5 Avo chats. Upgrade to Pro for 20 chats per day.',
  },
  receipt: {
    title: 'Receipt scanning is a Pro feature',
    description: 'Snap a photo of your grocery receipt and auto-add items to your pantry.',
  },
  mealplan: {
    title: 'Advanced meal planning is Pro',
    description: 'Get personalized weekly meal plans and budget-optimized shopping lists.',
  },
  onboarding: {
    title: 'Get more from Pantre',
    description: 'Unlock unlimited pantry tracking, AI-powered nutrition advice, receipt scanning, and more.',
  },
};

const PRO_FEATURES = [
  'Unlimited pantry items',
  '20 Avo chats per day',
  'Receipt scanning',
  'Personalized meal plans',
  'Budget-optimized shopping lists',
];

export function UpgradeModal({ feature, onClose, onUpgrade, closeDelay = 3000 }: UpgradeModalProps) {
  const copy = FEATURE_COPY[feature];
  const [canClose, setCanClose] = useState(closeDelay === 0);

  useEffect(() => {
    if (closeDelay > 0) {
      const t = setTimeout(() => setCanClose(true), closeDelay);
      return () => clearTimeout(t);
    }
  }, [closeDelay]);

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
        {/* Crown icon */}
        <div style={{ textAlign: 'center' }}>
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            <path d="M6 28 L10 14 L16 22 L20 10 L24 22 L30 14 L34 28 Z" fill="#D4A44A" stroke="#A07830" strokeWidth="1.8" strokeLinejoin="round"/>
            <rect x="6" y="28" width="28" height="4" rx="2" fill="#D4A44A" stroke="#A07830" strokeWidth="1.5"/>
            <circle cx="10" cy="14" r="2" fill="#E8C860"/>
            <circle cx="20" cy="10" r="2" fill="#E8C860"/>
            <circle cx="30" cy="14" r="2" fill="#E8C860"/>
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{copy.title}</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{copy.description}</p>
        </div>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Everything in Pro
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {PRO_FEATURES.map(f => (
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

        <button
          onClick={() => { hapticSuccess(); onUpgrade(); }}
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #D4A44A, #B8862D)',
            color: '#fff',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(212,164,74,0.4)',
            marginTop: '4px',
          }}
        >
          Upgrade to Pro — $5.99/mo
        </button>

        <button
          onClick={canClose ? onClose : undefined}
          style={{
            padding: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            cursor: canClose ? 'pointer' : 'default',
            opacity: canClose ? 1 : 0,
            pointerEvents: canClose ? 'auto' : 'none',
            transition: 'opacity 0.5s ease-out',
          }}
        >
          Maybe later
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', opacity: canClose ? 1 : 0, transition: 'opacity 0.5s ease-out' }}>
          {[['Privacy Policy', 'https://pantre.app/privacy'], ['Terms of Use', 'https://pantre.app/terms']].map(([label, url]) => (
            <button
              key={label}
              onClick={() => window.open(url, '_blank')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '11px',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '4px',
              }}
            >
              {label}
            </button>
          ))}
        </div>
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
