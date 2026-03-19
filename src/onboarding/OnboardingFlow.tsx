import { useState } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { useStore } from '../store/useStore';
import type { DietaryPref } from '../types';

type Step = 'welcome' | 'name' | 'household' | 'diet' | 'ready';

const DIETS: { id: DietaryPref; label: string; emoji: string }[] = [
  { id: 'none', label: 'No restrictions', emoji: '🍽️' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { id: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { id: 'nut-free', label: 'Nut-free', emoji: '🥜' },
];

export function OnboardingFlow() {
  const { setUser } = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [household, setHousehold] = useState(1);
  const [diets, setDiets] = useState<DietaryPref[]>(['none']);

  const toggleDiet = (d: DietaryPref) => {
    if (d === 'none') {
      setDiets(['none']);
      return;
    }
    setDiets(prev => {
      const next = prev.filter(p => p !== 'none');
      return next.includes(d) ? next.filter(p => p !== d) : [...next, d];
    });
  };

  const handleComplete = () => {
    setUser({
      id: `u-${Date.now()}`,
      name: name.trim() || 'Friend',
      householdSize: household,
      dietaryPreferences: diets,
      createdAt: new Date().toISOString(),
      onboardingComplete: true,
      streakDays: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="onboarding-scroll" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      gap: '20px',
      textAlign: 'center',
    }}>
      {step === 'welcome' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AvocadoMascot size={90} />
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>
            Meet Avo, your<br />
            <span style={{ color: 'var(--accent)' }}>Shelf Life</span> buddy
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '300px' }}>
            I'll help you track your food, reduce waste, and save money. Together we'll make every ingredient count!
          </p>
          <button
            className="btn-solid"
            onClick={() => setStep('name')}
            style={{
              padding: '16px 48px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: 'var(--accent-dark)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Let's get started!
          </button>
        </div>
      )}

      {step === 'name' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={60} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>What's your name?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>So I know what to call you!</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name..."
            autoFocus
            onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('household')}
            style={{
              width: '100%',
              maxWidth: '300px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              color: 'var(--text-primary)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '16px',
              outline: 'none',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />
          <button
            className="btn-solid"
            onClick={() => setStep('household')}
            disabled={!name.trim()}
            style={{
              padding: '14px 40px',
              background: name.trim() ? 'var(--accent)' : 'var(--accent-dim)',
              border: 'none',
              borderRadius: '14px',
              color: name.trim() ? 'var(--accent-dark)' : 'var(--text-muted)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '15px',
              fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'household' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AvocadoMascot size={60} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Household size?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Helps us estimate portions and waste</p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className="btn-icon"
              onClick={() => setHousehold(Math.max(1, household - 1))}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              -
            </button>
            <div className="mono" style={{ fontSize: '48px', fontWeight: 500, color: 'var(--accent)', minWidth: '60px', textAlign: 'center' }}>
              {household}
            </div>
            <button
              className="btn-icon"
              onClick={() => setHousehold(Math.min(10, household + 1))}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              +
            </button>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {household === 1 ? 'Just me' : `${household} people`}
          </div>
          <button
            className="btn-solid"
            onClick={() => setStep('diet')}
            style={{
              padding: '14px 40px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: 'var(--accent-dark)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'diet' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={60} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Dietary preferences?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>We'll tailor recipe suggestions for you</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '320px' }}>
            {DIETS.map(d => {
              const isSelected = diets.includes(d.id);
              return (
                <button
                  key={d.id}
                  className="btn-toggle"
                  onClick={() => toggleDiet(d.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '14px',
                    border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                    background: isSelected ? 'var(--accent-dim)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'Syne, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{d.emoji}</span> {d.label}
                </button>
              );
            })}
          </div>
          <button
            className="btn-solid"
            onClick={() => setStep('ready')}
            style={{
              padding: '14px 40px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: 'var(--accent-dark)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'ready' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AvocadoMascot size={90} />
          <h2 style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.2 }}>
            You're all set, <span style={{ color: 'var(--accent)' }}>{name || 'Friend'}</span>!
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '300px' }}>
            I've stocked your pantry with some sample items so you can explore. Add your own anytime!
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {[
              { emoji: '📦', label: 'Track', desc: 'Your food' },
              { emoji: '🍳', label: 'Cook', desc: 'Smart recipes' },
              { emoji: '🌍', label: 'Save', desc: 'The planet' },
            ].map(f => (
              <div key={f.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>{f.emoji}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{f.label}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <button
            className="btn-solid"
            onClick={handleComplete}
            style={{
              padding: '16px 48px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: 'var(--accent-dark)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '12px',
            }}
          >
            Open My Pantry
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        {(['welcome', 'name', 'household', 'diet', 'ready'] as Step[]).map((s, i) => (
          <div key={s} style={{
            width: step === s ? 20 : 6,
            height: 6,
            borderRadius: '3px',
            background: step === s ? 'var(--accent)' : 'var(--accent-dim)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        ))}
      </div>
    </div>
  );
}
