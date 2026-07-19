import { useState, useRef, useCallback, useEffect } from 'react';

type Expression = 'happy' | 'excited' | 'sleepy' | 'surprised' | 'wink' | 'love' | 'thinking' | 'normal' | 'sick';

// Exported so screens can drive Avo's resting mood from app state (expiring
// items → surprised, recall → sick, late night → sleepy…).
export type AvoMood = Expression;

interface AvocadoMascotProps {
  size?: number;
  isStatic?: boolean;
  className?: string;
  /** Resting expression when no tap-reaction is playing. Defaults to 'happy'. */
  mood?: Expression;
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

export function AvocadoMascot({ size = 56, isStatic = false, className = '', mood }: AvocadoMascotProps) {
  // Only tap-reactions live in state; the resting face is derived, so a mood
  // change from the parent shows immediately and reactions settle back to it.
  const [reactionExpr, setReactionExpr] = useState<Expression | null>(null);
  const [animClass, setAnimClass] = useState('');
  const expression: Expression = reactionExpr ?? mood ?? 'happy';
  const [splatted, setSplatted] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The smash sequence chains bare setTimeouts; track them so they can be
  // cleared on unmount (otherwise a mid-animation unmount setStates a dead node).
  const smashTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    smashTimeoutsRef.current.forEach(clearTimeout);
  }, []);

  const s = size;

  const triggerReaction = useCallback((expr: Expression, css: string, duration: number) => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    setReactionExpr(expr);
    setAnimClass(css);
    animTimeoutRef.current = setTimeout(() => {
      setReactionExpr(null);
      setAnimClass('');
    }, duration);
  }, []);

  const handleTap = useCallback(() => {
    if (isStatic || splatted) return;
    const now = Date.now();
    tapTimesRef.current.push(now);
    tapTimesRef.current = tapTimesRef.current.filter(t => now - t < 600);

    if (tapTimesRef.current.length >= 4) {
      tapTimesRef.current = [];
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      // Sick face + shake, then SMASH flat into guac
      setReactionExpr('sick');
      setAnimClass('avo-shake');
      smashTimeoutsRef.current.push(setTimeout(() => {
        setAnimClass('avo-smash');
        // Splat appears at the exact moment avo is fully squished
        smashTimeoutsRef.current.push(setTimeout(() => setSplatted(true), 250));
      }, 500));
      animTimeoutRef.current = setTimeout(() => {
        setSplatted(false);
        setReactionExpr(null);
        setAnimClass('');
      }, 3500);
    } else if (tapTimesRef.current.length >= 3) {
      // Getting queasy — warning before the splat
      triggerReaction('sick', 'avo-wiggle-react', 1200);
    } else if (tapTimesRef.current.length === 2) {
      const exprs: Expression[] = ['wink', 'excited', 'thinking'];
      triggerReaction(exprs[Math.floor(Math.random() * exprs.length)], 'avo-wiggle-react', 800);
    } else {
      const exprs: Expression[] = ['happy', 'wink', 'excited'];
      triggerReaction(exprs[Math.floor(Math.random() * exprs.length)], 'avo-bounce-react', 600);
    }
  }, [isStatic, splatted, triggerReaction]);

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
      case 'sick':
        return (
          <div style={{ display: 'flex', gap: s * 0.12, alignItems: 'center' }}>
            {/* Spiral/dizzy eyes */}
            <svg width={s * 0.14} height={s * 0.14} viewBox="0 0 14 14" fill="none">
              <path d="M7 2 C10 2, 12 5, 10 7 C8 9, 5 8, 5 6 C5 4, 7 4, 7 5.5" stroke={FACE} strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
            <svg width={s * 0.14} height={s * 0.14} viewBox="0 0 14 14" fill="none">
              <path d="M7 2 C10 2, 12 5, 10 7 C8 9, 5 8, 5 6 C5 4, 7 4, 7 5.5" stroke={FACE} strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
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
      case 'sick':
        return (
          <svg width={s * 0.28} height={s * 0.14} viewBox="0 0 20 10" fill="none">
            {/* Wavy queasy mouth */}
            <path d="M3 5 C5 2, 7 8, 10 5 C13 2, 15 8, 17 5" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
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

  if (splatted) {
    // Drops that fly away from the squish point
    const drops: { dx: string; dy: string; r: number; fill: string; delay: string; dur: string }[] = [
      { dx: '0px',   dy: '-68px', r: 8,   fill: FLESH,     delay: '0.07s', dur: '0.55s' },
      { dx: '54px',  dy: '-54px', r: 5.5, fill: FLESH,     delay: '0.10s', dur: '0.50s' },
      { dx: '72px',  dy: '-6px',  r: 7,   fill: FLESH,     delay: '0.06s', dur: '0.58s' },
      { dx: '56px',  dy: '44px',  r: 5,   fill: FLESH_SHD, delay: '0.12s', dur: '0.52s' },
      { dx: '0px',   dy: '64px',  r: 7.5, fill: FLESH,     delay: '0.08s', dur: '0.56s' },
      { dx: '-54px', dy: '48px',  r: 5,   fill: SKIN,      delay: '0.11s', dur: '0.50s' },
      { dx: '-72px', dy: '-8px',  r: 6.5, fill: FLESH,     delay: '0.07s', dur: '0.54s' },
      { dx: '-50px', dy: '-56px', r: 5,   fill: FLESH_SHD, delay: '0.13s', dur: '0.48s' },
      { dx: '26px',  dy: '-76px', r: 3.5, fill: FLESH,     delay: '0.15s', dur: '0.45s' },
      { dx: '-22px', dy: '74px',  r: 3,   fill: SKIN,      delay: '0.14s', dur: '0.46s' },
      { dx: '82px',  dy: '28px',  r: 3.5, fill: FLESH,     delay: '0.16s', dur: '0.43s' },
      { dx: '-82px', dy: '22px',  r: 3,   fill: FLESH_SHD, delay: '0.17s', dur: '0.44s' },
    ];

    return (
      <div
        onClick={handleTap}
        style={{
          position: 'relative',
          width: s * 1.3,
          height: s * 1.3,
          flexShrink: 0,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Flat squished body — lands from above with a squish bounce */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          animation: 'avoSquishLand 0.38s cubic-bezier(0.22, 1, 0.36, 1) both',
          pointerEvents: 'none',
        }}>
          <svg
            width={s * 1.4}
            height={s * 0.82}
            viewBox="0 0 112 66"
            fill="none"
          >
            {/* Skin outer */}
            <path d="M7 33 C7 15,22 5,56 5 C90 5,105 15,105 33 C105 51,90 61,56 61 C22 61,7 51,7 33 Z"
              fill={SKIN} stroke={SKIN_LINE} strokeWidth="1.8" strokeLinejoin="round"/>
            {/* Flesh inner */}
            <path d="M17 33 C17 19,28 13,56 13 C84 13,95 19,95 33 C95 47,84 53,56 53 C28 53,17 47,17 33 Z"
              fill={FLESH}/>
            {/* Flesh texture streaks */}
            <path d="M30 17 C28 25,28 41,30 49" stroke={FLESH_SHD} strokeWidth="1" opacity="0.4" fill="none" strokeLinecap="round"/>
            <path d="M82 17 C84 25,84 41,82 49" stroke={FLESH_SHD} strokeWidth="1" opacity="0.3" fill="none" strokeLinecap="round"/>
            {/* Pit — centered, proportional */}
            <ellipse cx="56" cy="38" rx="18" ry="11" fill={PIT} stroke={PIT_LINE} strokeWidth="1.2"/>
            <path d="M50 35 C53 33,59 33,62 35" stroke="#9a6840" strokeWidth="0.9" opacity="0.5" fill="none" strokeLinecap="round"/>
            {/* X eyes — clearly above the pit */}
            <g transform="translate(36,22)">
              <line x1="-4" y1="-4" x2="4" y2="4" stroke={FACE} strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="4" y1="-4" x2="-4" y2="4" stroke={FACE} strokeWidth="2.2" strokeLinecap="round"/>
            </g>
            <g transform="translate(76,22)">
              <line x1="-4" y1="-4" x2="4" y2="4" stroke={FACE} strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="4" y1="-4" x2="-4" y2="4" stroke={FACE} strokeWidth="2.2" strokeLinecap="round"/>
            </g>
            {/* Dazed wavy mouth — below the pit */}
            <path d="M43 51 C47 48,51 53,56 50 C61 47,65 52,69 50"
              stroke={FACE} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Impact wave ring — expands outward on hit */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '52%',
          width: s * 1.8,
          height: s * 0.44,
          marginLeft: -(s * 0.9),
          marginTop: -(s * 0.22),
          borderRadius: '50%',
          border: `1.5px solid ${FLESH}`,
          animation: 'avoImpactRing 0.42s ease-out both',
          pointerEvents: 'none',
        }}/>

        {/* Drops flying outward */}
        {drops.map((d, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '52%',
              width: d.r * 2,
              height: d.r * 2,
              marginLeft: -d.r,
              marginTop: -d.r,
              borderRadius: '50%',
              background: d.fill,
              ...({ '--dx': d.dx, '--dy': d.dy } as React.CSSProperties),
              animation: `avoSquishDrop ${d.dur} ease-out ${d.delay} both`,
              pointerEvents: 'none',
            }}
          />
        ))}

        <style>{`
          @keyframes avoSquishLand {
            0%   { transform: translate(-50%, -120%) scaleX(0.82) scaleY(1.5); opacity: 0.85; }
            42%  { transform: translate(-50%, -50%) scaleX(1.18) scaleY(0.72); }
            62%  { transform: translate(-50%, -50%) scaleX(0.94) scaleY(1.08); }
            80%  { transform: translate(-50%, -50%) scaleX(1.04) scaleY(0.96); }
            100% { transform: translate(-50%, -50%) scaleX(1) scaleY(1); }
          }
          @keyframes avoSquishDrop {
            0%   { transform: translate(0, 0) scale(1.4); opacity: 1; }
            55%  { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0.9; }
            100% { transform: translate(var(--dx), var(--dy)) scale(0.7); opacity: 0; }
          }
          @keyframes avoImpactRing {
            0%   { transform: scaleX(0.3) scaleY(0.3); opacity: 0.9; }
            100% { transform: scaleX(1) scaleY(1); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

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
