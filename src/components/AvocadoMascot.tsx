import { useState, useRef, useCallback } from 'react';
import { AVOCADO_TIPS } from '../types';
import { useStore } from '../store/useStore';

type Expression = 'happy' | 'excited' | 'sleepy' | 'surprised' | 'wink' | 'love' | 'thinking' | 'normal';

interface AvocadoMascotProps {
  size?: number;
  isStatic?: boolean;
  className?: string;
  onTipShow?: (tip: string) => void;
}

// Earthy hand-drawn palette
const SKIN      = '#4d6d3b';
const SKIN_LINE = '#2b3f1a';
const FLESH     = '#cdd98f';
const FLESH_SHD = '#b5c47a';
const PIT       = '#7c5130';
const PIT_LINE  = '#4d3118';
const LEAF      = '#3e6a2e';
const LEAF_LINE = '#264a1c';
const FACE      = '#3a2010';

export function AvocadoMascot({ size = 56, isStatic = false, className = '', onTipShow }: AvocadoMascotProps) {
  const { avocadoTipIndex, nextAvocadoTip } = useStore();
  const [expression, setExpression] = useState<Expression>('happy');
  const [animClass, setAnimClass] = useState('');
  const [showTip, setShowTip] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const s = size;

  const triggerReaction = useCallback((expr: Expression, css: string, duration: number) => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    setExpression(expr);
    setAnimClass(css);
    animTimeoutRef.current = setTimeout(() => {
      setExpression('happy');
      setAnimClass('');
    }, duration);
  }, []);

  const handleTap = useCallback(() => {
    if (isStatic) return;
    const now = Date.now();
    tapTimesRef.current.push(now);
    tapTimesRef.current = tapTimesRef.current.filter(t => now - t < 500);

    const tip = AVOCADO_TIPS[avocadoTipIndex % AVOCADO_TIPS.length];
    setShowTip(true);
    onTipShow?.(tip);
    nextAvocadoTip();

    if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    tipTimeoutRef.current = setTimeout(() => setShowTip(false), 4000);

    if (tapTimesRef.current.length >= 3) {
      tapTimesRef.current = [];
      const exprs: Expression[] = ['excited', 'love', 'surprised'];
      triggerReaction(exprs[Math.floor(Math.random() * exprs.length)], 'avo-spin-react', 1200);
    } else if (tapTimesRef.current.length === 2) {
      const exprs: Expression[] = ['wink', 'excited', 'thinking'];
      triggerReaction(exprs[Math.floor(Math.random() * exprs.length)], 'avo-wiggle-react', 800);
    } else {
      const exprs: Expression[] = ['happy', 'wink', 'excited'];
      triggerReaction(exprs[Math.floor(Math.random() * exprs.length)], 'avo-bounce-react', 600);
    }
  }, [isStatic, avocadoTipIndex, nextAvocadoTip, triggerReaction, onTipShow]);

  const renderEyes = () => {
    const eye: React.CSSProperties = {
      width: s * 0.1,
      height: s * 0.12,
      borderRadius: '50%',
      background: FACE,
      transition: 'all 0.15s ease',
      position: 'relative',
    };
    // small white glint — keeps life in the eyes without going 3D
    const glint = (
      <div style={{ position: 'absolute', width: s * 0.03, height: s * 0.03, background: '#fff', borderRadius: '50%', top: s * 0.018, left: s * 0.012 }} />
    );

    switch (expression) {
      case 'excited':
        return (
          <div style={{ display: 'flex', gap: s * 0.15 }}>
            <div style={{ ...eye, width: s * 0.11, height: s * 0.13 }}>{glint}</div>
            <div style={{ ...eye, width: s * 0.11, height: s * 0.13 }}>{glint}</div>
          </div>
        );
      case 'wink':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={eye}>{glint}</div>
            <div style={{ width: s * 0.12, height: s * 0.025, borderRadius: s * 0.02, background: FACE, marginTop: s * 0.02 }} />
          </div>
        );
      case 'sleepy':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={{ width: s * 0.1, height: s * 0.025, borderRadius: s * 0.02, background: FACE }} />
            <div style={{ width: s * 0.1, height: s * 0.025, borderRadius: s * 0.02, background: FACE }} />
          </div>
        );
      case 'surprised':
        return (
          <div style={{ display: 'flex', gap: s * 0.14 }}>
            <div style={{ ...eye, width: s * 0.13, height: s * 0.15 }}>{glint}</div>
            <div style={{ ...eye, width: s * 0.13, height: s * 0.15 }}>{glint}</div>
          </div>
        );
      case 'love':
        return (
          <div style={{ display: 'flex', gap: s * 0.1, fontSize: s * 0.18 }}>
            <span>❤️</span><span>❤️</span>
          </div>
        );
      case 'thinking':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={{ ...eye, transform: 'translateY(-2px)' }}>{glint}</div>
            <div style={{ ...eye, width: s * 0.11, height: s * 0.08, borderRadius: '50%' }}>
              <div style={{ position: 'absolute', width: s * 0.03, height: s * 0.03, background: '#fff', borderRadius: '50%', top: s * 0.008, left: s * 0.04 }} />
            </div>
          </div>
        );
      default:
        return (
          <div style={{ display: 'flex', gap: s * 0.15 }}>
            <div style={eye}>{glint}</div>
            <div style={eye}>{glint}</div>
          </div>
        );
    }
  };

  const renderMouth = () => {
    const stroke = FACE;
    switch (expression) {
      case 'excited':
      case 'love':
        return (
          <svg width={s * 0.28} height={s * 0.16} viewBox="0 0 20 12" fill="none">
            <path d="M3 2 C6 12, 14 12, 17 2" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );
      case 'surprised':
        return (
          <div style={{ width: s * 0.1, height: s * 0.1, borderRadius: '50%', border: `${Math.max(2, s * 0.03)}px solid ${stroke}` }} />
        );
      case 'sleepy':
        return (
          <svg width={s * 0.2} height={s * 0.1} viewBox="0 0 16 8" fill="none">
            <path d="M4 4 C6 2, 10 2, 12 4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'thinking':
        return (
          <svg width={s * 0.18} height={s * 0.1} viewBox="0 0 14 8" fill="none">
            <path d="M3 5 C5 3, 9 3, 11 5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case 'wink':
        return (
          <svg width={s * 0.24} height={s * 0.14} viewBox="0 0 18 10" fill="none">
            <path d="M4 3 C7 10, 11 10, 14 3" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg width={s * 0.24} height={s * 0.14} viewBox="0 0 18 10" fill="none">
            <path d="M4 3 C7 9, 11 9, 14 3" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
    }
  };

  const blushSize = s * 0.07;
  const showBlush = ['happy', 'excited', 'love', 'wink'].includes(expression);

  return (
    <div
      className={`${isStatic ? '' : 'avo-drift'} ${animClass} ${className}`.trim()}
      onClick={handleTap}
      style={{
        position: 'relative',
        width: s * 1.3,
        height: s * 1.3,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isStatic ? undefined : 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Tip bubble */}
      {showTip && !isStatic && (
        <div className="avo-tip-bubble" style={{
          position: 'absolute',
          bottom: '105%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card)',
          border: 'var(--card-border)',
          borderRadius: '12px',
          padding: '8px 12px',
          fontSize: '11px',
          color: 'var(--text-primary)',
          width: 'max(200px, 60vw)',
          maxWidth: '280px',
          boxShadow: '0 4px 20px var(--overlay-bg)',
          zIndex: 100,
          lineHeight: 1.4,
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '14px', marginBottom: '2px' }}>🥑</div>
          {AVOCADO_TIPS[(avocadoTipIndex - 1 + AVOCADO_TIPS.length) % AVOCADO_TIPS.length]}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '12px',
            height: '12px',
            background: 'var(--bg-card)',
            borderRight: 'var(--card-border)',
            borderBottom: 'var(--card-border)',
          }} />
        </div>
      )}

      {/* Leaf — botanical, hand-drawn */}
      <svg
        style={{ position: 'absolute', top: s * -0.06, left: '50%', transform: 'translateX(-25%)' }}
        width={s * 0.34}
        height={s * 0.32}
        viewBox="0 0 28 26"
        fill="none"
      >
        {/* Stem */}
        <path d="M14 24 L14 18" stroke={SKIN_LINE} strokeWidth="1.4" strokeLinecap="round" />
        {/* Leaf blade — slightly asymmetric for hand-drawn feel */}
        <path
          d="M14 18 C14 18, 4 12, 6 4 C7 0, 13 -1, 16 2 C20 6, 20 14, 14 18 Z"
          fill={LEAF}
          stroke={LEAF_LINE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Midrib */}
        <path d="M14 17 L13 5" stroke={LEAF_LINE} strokeWidth="0.7" opacity="0.55" />
        {/* Side veins */}
        <path d="M13 8 L9 6"  stroke={LEAF_LINE} strokeWidth="0.5" opacity="0.45" />
        <path d="M13 11 L8 10" stroke={LEAF_LINE} strokeWidth="0.5" opacity="0.4" />
        <path d="M14 14 L17 12" stroke={LEAF_LINE} strokeWidth="0.5" opacity="0.4" />
      </svg>

      {/* Avocado body — flat illustrated, no gradients */}
      <svg width={s} height={s} viewBox="0 0 80 80" style={{ position: 'relative', zIndex: 1 }}>
        {/* Outer skin — slightly organic path */}
        <path
          d="M40 7 C31 7, 14 21, 14 38 C14 56, 23 72, 35 75 C37 76, 43 76, 45 75 C57 72, 66 56, 66 38 C66 21, 49 7, 40 7 Z"
          fill={SKIN}
          stroke={SKIN_LINE}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Inner flesh */}
        <path
          d="M40 16 C33 16, 22 27, 21 40 C20 54, 28 68, 39 70 C40 70, 41 70, 42 70 C52 68, 60 54, 59 40 C58 27, 47 16, 40 16 Z"
          fill={FLESH}
        />
        {/* Hand-drawn texture strokes in flesh */}
        <path d="M28 37 C27 44, 28 53, 30 59" stroke={FLESH_SHD} strokeWidth="1.1" opacity="0.45" fill="none" strokeLinecap="round" />
        <path d="M52 36 C53 43, 52 52, 50 58" stroke={FLESH_SHD} strokeWidth="1.1" opacity="0.35" fill="none" strokeLinecap="round" />
        {/* Pit — organic circle */}
        <path
          d="M40 43 C34 43, 28 47.5, 28 53.5 C28 60, 33.5 64, 40 64 C46.5 64, 52 60, 52 53.5 C52 47.5, 46 43, 40 43 Z"
          fill={PIT}
          stroke={PIT_LINE}
          strokeWidth="1.4"
        />
        {/* Pit subtle highlight line — gives warmth without 3D */}
        <path d="M35 50 C37 48, 41 48, 43 50" stroke="#9a6840" strokeWidth="1" opacity="0.5" fill="none" strokeLinecap="round" />
      </svg>

      {/* Face overlay */}
      <div style={{
        position: 'absolute',
        top: s * 0.28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s * 0.04,
        zIndex: 2,
      }}>
        {renderEyes()}
        {renderMouth()}
      </div>

      {/* Blush — earthy terracotta, softer than before */}
      {showBlush && (
        <>
          <div style={{
            position: 'absolute', top: s * 0.48, left: s * 0.22,
            width: blushSize, height: blushSize * 0.55, borderRadius: '50%',
            background: 'rgba(195, 110, 80, 0.28)',
            filter: `blur(${s * 0.025}px)`,
            zIndex: 2, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: s * 0.48, right: s * 0.22,
            width: blushSize, height: blushSize * 0.55, borderRadius: '50%',
            background: 'rgba(195, 110, 80, 0.28)',
            filter: `blur(${s * 0.025}px)`,
            zIndex: 2, pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Tiny illustrated sparkles — asterisk style, not digital dots */}
      {!isStatic && (
        <>
          <svg className="avo-sparkle avo-sparkle-1" style={{ position: 'absolute', top: '6%', right: '12%' }}
            width={s * 0.09} height={s * 0.09} viewBox="0 0 10 10" fill="none">
            <line x1="5" y1="1" x2="5" y2="9" stroke={SKIN} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="1" y1="5" x2="9" y2="5" stroke={SKIN} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <svg className="avo-sparkle avo-sparkle-2" style={{ position: 'absolute', bottom: '18%', left: '10%' }}
            width={s * 0.07} height={s * 0.07} viewBox="0 0 10 10" fill="none">
            <line x1="5" y1="2" x2="5" y2="8" stroke={LEAF} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="2" y1="5" x2="8" y2="5" stroke={LEAF} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <svg className="avo-sparkle avo-sparkle-3" style={{ position: 'absolute', top: '24%', left: '7%' }}
            width={s * 0.07} height={s * 0.07} viewBox="0 0 10 10" fill="none">
            <line x1="5" y1="2" x2="5" y2="8" stroke={PIT} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="2" y1="5" x2="8" y2="5" stroke={PIT} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </>
      )}
    </div>
  );
}
