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

    // Show a tip
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
    const eyeBaseStyle: React.CSSProperties = {
      width: s * 0.1,
      height: s * 0.12,
      borderRadius: '50%',
      background: '#3D2914',
      transition: 'all 0.15s ease',
    };

    switch (expression) {
      case 'excited':
        return (
          <div style={{ display: 'flex', gap: s * 0.15 }}>
            <div style={{ ...eyeBaseStyle, width: s * 0.11, height: s * 0.13, background: '#3D2914' }}>
              <div style={{ width: s * 0.04, height: s * 0.04, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.02 }} />
            </div>
            <div style={{ ...eyeBaseStyle, width: s * 0.11, height: s * 0.13, background: '#3D2914' }}>
              <div style={{ width: s * 0.04, height: s * 0.04, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.02 }} />
            </div>
          </div>
        );
      case 'wink':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={{ ...eyeBaseStyle }}>
              <div style={{ width: s * 0.035, height: s * 0.035, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.015 }} />
            </div>
            <div style={{ width: s * 0.12, height: s * 0.03, borderRadius: s * 0.02, background: '#3D2914', marginTop: s * 0.02 }} />
          </div>
        );
      case 'sleepy':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={{ width: s * 0.1, height: s * 0.03, borderRadius: s * 0.02, background: '#3D2914' }} />
            <div style={{ width: s * 0.1, height: s * 0.03, borderRadius: s * 0.02, background: '#3D2914' }} />
          </div>
        );
      case 'surprised':
        return (
          <div style={{ display: 'flex', gap: s * 0.14 }}>
            <div style={{ ...eyeBaseStyle, width: s * 0.13, height: s * 0.15 }}>
              <div style={{ width: s * 0.05, height: s * 0.05, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.02 }} />
            </div>
            <div style={{ ...eyeBaseStyle, width: s * 0.13, height: s * 0.15 }}>
              <div style={{ width: s * 0.05, height: s * 0.05, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.02 }} />
            </div>
          </div>
        );
      case 'love':
        return (
          <div style={{ display: 'flex', gap: s * 0.1, fontSize: s * 0.18 }}>
            <span>❤️</span>
            <span>❤️</span>
          </div>
        );
      case 'thinking':
        return (
          <div style={{ display: 'flex', gap: s * 0.15, alignItems: 'center' }}>
            <div style={{ ...eyeBaseStyle, transform: 'translateY(-2px)' }}>
              <div style={{ width: s * 0.035, height: s * 0.035, background: '#FFF', borderRadius: '50%', marginTop: s * 0.015, marginLeft: s * 0.015 }} />
            </div>
            <div style={{ ...eyeBaseStyle, width: s * 0.11, height: s * 0.08, borderRadius: '50%' }}>
              <div style={{ width: s * 0.04, height: s * 0.04, background: '#FFF', borderRadius: '50%', marginTop: s * 0.01, marginLeft: s * 0.04 }} />
            </div>
          </div>
        );
      default: // happy, normal
        return (
          <div style={{ display: 'flex', gap: s * 0.15 }}>
            <div style={eyeBaseStyle}>
              <div style={{ width: s * 0.035, height: s * 0.035, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.015 }} />
            </div>
            <div style={eyeBaseStyle}>
              <div style={{ width: s * 0.035, height: s * 0.035, background: '#FFF', borderRadius: '50%', marginTop: s * 0.02, marginLeft: s * 0.015 }} />
            </div>
          </div>
        );
    }
  };

  const renderMouth = () => {
    switch (expression) {
      case 'excited':
        return (
          <svg width={s * 0.28} height={s * 0.16} viewBox="0 0 20 12" fill="none">
            <path d="M3 2 C6 12, 14 12, 17 2" stroke="#3D2914" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'surprised':
        return (
          <div style={{
            width: s * 0.1,
            height: s * 0.1,
            borderRadius: '50%',
            border: `${Math.max(2, s * 0.03)}px solid #3D2914`,
          }} />
        );
      case 'love':
        return (
          <svg width={s * 0.28} height={s * 0.16} viewBox="0 0 20 12" fill="none">
            <path d="M3 2 C6 12, 14 12, 17 2" stroke="#3D2914" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'sleepy':
        return (
          <svg width={s * 0.2} height={s * 0.1} viewBox="0 0 16 8" fill="none">
            <path d="M4 4 C6 2, 10 2, 12 4" stroke="#3D2914" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'thinking':
        return (
          <svg width={s * 0.18} height={s * 0.1} viewBox="0 0 14 8" fill="none">
            <path d="M3 5 C5 3, 9 3, 11 5" stroke="#3D2914" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'wink':
        return (
          <svg width={s * 0.24} height={s * 0.14} viewBox="0 0 18 10" fill="none">
            <path d="M4 3 C7 10, 11 10, 14 3" stroke="#3D2914" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );
      default:
        return (
          <svg width={s * 0.24} height={s * 0.14} viewBox="0 0 18 10" fill="none">
            <path d="M4 3 C7 9, 11 9, 14 3" stroke="#3D2914" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );
    }
  };

  const blushSize = s * 0.07;

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

      {/* Ambient glow */}
      {!isStatic && (
        <div style={{
          position: 'absolute',
          width: s * 0.9,
          height: s * 0.9,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 195, 74, 0.2) 0%, transparent 70%)',
          filter: `blur(${s * 0.15}px)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Leaf */}
      <svg
        style={{ position: 'absolute', top: s * -0.08, left: '50%', transform: 'translateX(-30%)' }}
        width={s * 0.3}
        height={s * 0.25}
        viewBox="0 0 24 20"
        fill="none"
      >
        <path
          d="M12 18 C12 18, 4 12, 6 4 C8 -1, 16 -1, 18 4 C20 12, 12 18, 12 18Z"
          fill="#558B2F"
          stroke="#33691E"
          strokeWidth="0.8"
        />
        <path d="M12 16 L12 4" stroke="#33691E" strokeWidth="0.6" opacity="0.5" />
        <path d="M12 8 L9 5" stroke="#33691E" strokeWidth="0.4" opacity="0.4" />
        <path d="M12 10 L15 7" stroke="#33691E" strokeWidth="0.4" opacity="0.4" />
      </svg>

      {/* Avocado body */}
      <svg width={s} height={s} viewBox="0 0 80 80" style={{ position: 'relative', zIndex: 1 }}>
        {/* Outer skin (dark green) */}
        <ellipse cx="40" cy="42" rx="34" ry="36" fill="#558B2F" />
        <ellipse cx="40" cy="42" rx="34" ry="36" fill="url(#avoGrad)" />

        {/* Inner flesh (creamy yellow-green) */}
        <ellipse cx="40" cy="44" rx="26" ry="28" fill="#C5E1A5" />
        <ellipse cx="40" cy="44" rx="26" ry="28" fill="url(#fleshGrad)" />

        {/* Pit (brown) */}
        <ellipse cx="40" cy="52" rx="10" ry="11" fill="#795548" />
        <ellipse cx="40" cy="52" rx="10" ry="11" fill="url(#pitGrad)" />

        {/* Pit highlight */}
        <ellipse cx="37" cy="49" rx="4" ry="4.5" fill="#8D6E63" opacity="0.6" />

        <defs>
          <radialGradient id="avoGrad" cx="40%" cy="30%">
            <stop offset="0%" stopColor="#689F38" />
            <stop offset="100%" stopColor="#33691E" />
          </radialGradient>
          <radialGradient id="fleshGrad" cx="45%" cy="35%">
            <stop offset="0%" stopColor="#F0F4C3" />
            <stop offset="60%" stopColor="#C5E1A5" />
            <stop offset="100%" stopColor="#AED581" />
          </radialGradient>
          <radialGradient id="pitGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#8D6E63" />
            <stop offset="100%" stopColor="#4E342E" />
          </radialGradient>
        </defs>
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

      {/* Blush cheeks */}
      {(expression === 'happy' || expression === 'excited' || expression === 'love' || expression === 'wink') && (
        <>
          <div style={{
            position: 'absolute',
            top: s * 0.48,
            left: s * 0.22,
            width: blushSize,
            height: blushSize * 0.6,
            borderRadius: '50%',
            background: 'rgba(255, 138, 128, 0.4)',
            filter: `blur(${s * 0.02}px)`,
            zIndex: 2,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            top: s * 0.48,
            right: s * 0.22,
            width: blushSize,
            height: blushSize * 0.6,
            borderRadius: '50%',
            background: 'rgba(255, 138, 128, 0.4)',
            filter: `blur(${s * 0.02}px)`,
            zIndex: 2,
            pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Sparkle particles */}
      {!isStatic && (
        <>
          <div className="avo-sparkle avo-sparkle-1" style={{
            position: 'absolute',
            width: s * 0.05,
            height: s * 0.05,
            borderRadius: '50%',
            background: '#8BC34A',
            boxShadow: '0 0 4px rgba(139, 195, 74, 0.6)',
            top: '8%',
            right: '15%',
          }} />
          <div className="avo-sparkle avo-sparkle-2" style={{
            position: 'absolute',
            width: s * 0.035,
            height: s * 0.035,
            borderRadius: '50%',
            background: '#AED581',
            boxShadow: '0 0 3px rgba(174, 213, 129, 0.6)',
            bottom: '15%',
            left: '12%',
          }} />
          <div className="avo-sparkle avo-sparkle-3" style={{
            position: 'absolute',
            width: s * 0.04,
            height: s * 0.04,
            borderRadius: '50%',
            background: '#CDDC39',
            boxShadow: '0 0 3px rgba(205, 220, 57, 0.6)',
            top: '25%',
            left: '8%',
          }} />
        </>
      )}
    </div>
  );
}
