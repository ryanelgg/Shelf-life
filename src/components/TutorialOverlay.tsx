import { useState } from 'react';
import { AvocadoMascot } from './AvocadoMascot';
import { useStore } from '../store/useStore';
import { hapticLight } from '../lib/haptics';

// A slight first-run tutorial: a few Avo-guided tips shown once, right after
// onboarding. Skippable, and never shown again once seen (persisted flag).
const STEPS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: '🥑',
    title: "Hey, I'm Avo!",
    body: "Welcome to Pantre. I'll help you keep track of your food and use it up before it goes bad.",
  },
  {
    emoji: '➕',
    title: 'Add your food',
    body: 'Tap the + button to log items — scan a barcode, snap a receipt or your fridge, or just add it manually.',
  },
  {
    emoji: '🥫',
    title: 'Your Pantre',
    body: 'The Pantre tab shows everything you have and flags what to use first. Swipe an item to eat, freeze, or extend its date.',
  },
  {
    emoji: '💬',
    title: 'Ask me anything',
    body: "In Chat, tap “Today's briefing” for your daily rundown, or ask me for recipes. Watch your savings and streak grow in Impact!",
  },
];

export function TutorialOverlay() {
  const hasSeenTutorial = useStore(s => s.hasSeenTutorial);
  const setHasSeenTutorial = useStore(s => s.setHasSeenTutorial);
  const [step, setStep] = useState(0);

  if (hasSeenTutorial) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => { hapticLight(); setHasSeenTutorial(true); };
  const next = () => { hapticLight(); if (isLast) finish(); else setStep(s => s + 1); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      animation: 'tutorialFadeIn 0.2s ease-out',
    }}>
      <div style={{
        width: '100%', maxWidth: '340px',
        background: 'var(--bg-primary)',
        borderRadius: '22px',
        padding: '28px 24px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}>
        <div className="use-tonight-pulse" style={{ marginBottom: '6px' }}>
          <AvocadoMascot size={64} isStatic />
        </div>
        <div style={{ fontSize: '30px', marginBottom: '2px' }}>{current.emoji}</div>
        <div style={{
          fontSize: '20px', fontWeight: 800,
          fontFamily: "'Cormorant Garamond', serif",
          color: 'var(--text-primary)', marginBottom: '8px',
        }}>
          {current.title}
        </div>
        <div style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--text-muted)', marginBottom: '20px' }}>
          {current.body}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--accent)' : 'var(--tab-border)',
              transition: 'width 0.2s ease',
            }} />
          ))}
        </div>

        <button
          onClick={next}
          style={{
            width: '100%', padding: '13px',
            borderRadius: '14px', border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontFamily: "'Cormorant Garamond', serif", fontSize: '16px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isLast ? "Let's go 🥑" : 'Next'}
        </button>
        {!isLast && (
          <button
            onClick={finish}
            style={{
              marginTop: '10px', padding: '4px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif", fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        )}
      </div>

      <style>{`@keyframes tutorialFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
