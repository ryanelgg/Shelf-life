import { useState, useEffect, useCallback, useRef } from 'react';
import { AVOCADO_TIPS } from '../types';
import { useStore } from '../store/useStore';

type BuddyState = 'walking-right' | 'walking-left' | 'idle' | 'sitting' | 'falling' | 'getting-up' | 'dancing' | 'waving' | 'sleeping';

interface GrassPatch {
  id: string;
  x: number;
  blades: number;
  height: number;
  spawning: boolean;
}

export function AvocadoBuddy() {
  const { avocadoTipIndex, nextAvocadoTip } = useStore();
  const [x, setX] = useState(20);
  const [state, setState] = useState<BuddyState>('idle');
  const [grassPatches, setGrassPatches] = useState<GrassPatch[]>([]);
  const [showTip, setShowTip] = useState(false);
  const [currentTip, setCurrentTip] = useState('');
  const [facingRight, setFacingRight] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const animFrameRef = useRef<number>();
  const targetXRef = useRef(20);
  const stateRef = useRef(state);

  stateRef.current = state;

  const size = 44;

  // Spawn grass patches randomly
  useEffect(() => {
    const spawnGrass = () => {
      if (Math.random() < 0.4) {
        const patch: GrassPatch = {
          id: `g-${Date.now()}`,
          x: 10 + Math.random() * 75,
          blades: 3 + Math.floor(Math.random() * 4),
          height: 8 + Math.random() * 10,
          spawning: true,
        };
        setGrassPatches(prev => [...prev.slice(-3), patch]);
        setTimeout(() => {
          setGrassPatches(prev => prev.map(g => g.id === patch.id ? { ...g, spawning: false } : g));
        }, 500);
      }
    };

    const grassInterval = setInterval(spawnGrass, 8000);
    // Initial grass
    setTimeout(spawnGrass, 2000);

    return () => clearInterval(grassInterval);
  }, []);

  // Remove old grass
  useEffect(() => {
    const cleanup = setInterval(() => {
      setGrassPatches(prev => prev.length > 4 ? prev.slice(1) : prev);
    }, 25000);
    return () => clearInterval(cleanup);
  }, []);

  // Main behavior loop
  const pickNextAction = useCallback(() => {
    if (stateRef.current === 'sitting' || stateRef.current === 'sleeping') return;

    const actions: BuddyState[] = ['walking-right', 'walking-left', 'idle', 'dancing', 'waving'];

    // Occasionally fall
    if (Math.random() < 0.08) {
      actions.push('falling');
    }
    // Occasionally sleep
    if (Math.random() < 0.06) {
      actions.push('sleeping');
    }

    const action = actions[Math.floor(Math.random() * actions.length)];

    if (action === 'walking-right' || action === 'walking-left') {
      const dir = action === 'walking-right' ? 1 : -1;
      setFacingRight(dir > 0);

      const distance = 15 + Math.random() * 30;
      const newX = Math.max(5, Math.min(85, x + distance * dir));
      targetXRef.current = newX;
      setState(action);

      // Check if walking towards grass
      const nearbyGrass = grassPatches.find(g => Math.abs(g.x - newX) < 8);

      const walkDuration = Math.abs(newX - x) * 60;

      // Animate walking
      const startX = x;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / walkDuration);
        const currentX = startX + (newX - startX) * progress;
        setX(currentX);
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Arrived
          if (nearbyGrass) {
            setState('sitting');
            timeoutRef.current = setTimeout(() => {
              setState('idle');
              timeoutRef.current = setTimeout(pickNextAction, 1000 + Math.random() * 2000);
            }, 4000 + Math.random() * 3000);
          } else {
            setState('idle');
            timeoutRef.current = setTimeout(pickNextAction, 2000 + Math.random() * 4000);
          }
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } else if (action === 'falling') {
      setState('falling');
      timeoutRef.current = setTimeout(() => {
        setState('getting-up');
        timeoutRef.current = setTimeout(() => {
          setState('idle');
          timeoutRef.current = setTimeout(pickNextAction, 1500 + Math.random() * 2000);
        }, 1200);
      }, 800);
    } else if (action === 'sleeping') {
      setState('sleeping');
      timeoutRef.current = setTimeout(() => {
        setState('idle');
        timeoutRef.current = setTimeout(pickNextAction, 1000 + Math.random() * 1500);
      }, 5000 + Math.random() * 3000);
    } else if (action === 'dancing') {
      setState('dancing');
      timeoutRef.current = setTimeout(() => {
        setState('idle');
        timeoutRef.current = setTimeout(pickNextAction, 1500 + Math.random() * 3000);
      }, 2500);
    } else if (action === 'waving') {
      setState('waving');
      timeoutRef.current = setTimeout(() => {
        setState('idle');
        timeoutRef.current = setTimeout(pickNextAction, 1500 + Math.random() * 3000);
      }, 1800);
    } else {
      setState('idle');
      timeoutRef.current = setTimeout(pickNextAction, 3000 + Math.random() * 5000);
    }
  }, [x, grassPatches]);

  // Start behavior
  useEffect(() => {
    const startDelay = setTimeout(() => {
      pickNextAction();
    }, 3000);

    return () => {
      clearTimeout(startDelay);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTap = () => {
    // Stop current action
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const tip = AVOCADO_TIPS[avocadoTipIndex % AVOCADO_TIPS.length];
    setCurrentTip(tip);
    setShowTip(true);
    nextAvocadoTip();

    setState('waving');

    setTimeout(() => {
      setShowTip(false);
      setState('idle');
      timeoutRef.current = setTimeout(pickNextAction, 2000);
    }, 4000);
  };

  const getBodyTransform = () => {
    switch (state) {
      case 'walking-right':
      case 'walking-left':
        return `scaleX(${facingRight ? 1 : -1})`;
      case 'falling':
        return 'rotate(90deg) translateY(10px)';
      case 'getting-up':
        return 'rotate(0deg)';
      case 'sitting':
        return `scaleX(${facingRight ? 1 : -1}) translateY(4px) scaleY(0.9)`;
      case 'sleeping':
        return 'translateY(6px) scaleY(0.85) rotate(-5deg)';
      default:
        return `scaleX(${facingRight ? 1 : -1})`;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '70px',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 5,
    }}>
      {/* Grass patches */}
      {grassPatches.map(patch => (
        <div
          key={patch.id}
          className={patch.spawning ? 'grass-spawn' : ''}
          style={{
            position: 'absolute',
            bottom: '2px',
            left: `${patch.x}%`,
            display: 'flex',
            gap: '2px',
            transform: patch.spawning ? 'scaleY(0)' : 'scaleY(1)',
            transformOrigin: 'bottom',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {Array.from({ length: patch.blades }).map((_, i) => (
            <div
              key={i}
              className="grass-blade"
              style={{
                width: '3px',
                height: `${patch.height + (i % 2) * 4}px`,
                background: `linear-gradient(to top, #33691E, #8BC34A)`,
                borderRadius: '2px 2px 1px 1px',
                transformOrigin: 'bottom',
                animation: `grassSway ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      ))}

      {/* Avocado buddy */}
      <div
        onClick={handleTap}
        style={{
          position: 'absolute',
          bottom: '4px',
          left: `${x}%`,
          transform: `translateX(-50%)`,
          pointerEvents: 'auto',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          zIndex: 10,
        }}
      >
        {/* Tip bubble */}
        {showTip && (
          <div className="avo-tip-bubble" style={{
            position: 'absolute',
            bottom: size + 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: 'var(--card-border)',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '10px',
            color: 'var(--text-primary)',
            width: '200px',
            boxShadow: '0 4px 16px var(--overlay-bg)',
            zIndex: 100,
            lineHeight: 1.3,
            textAlign: 'center',
          }}>
            {currentTip}
            <div style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '10px',
              height: '10px',
              background: 'var(--bg-card)',
              borderRight: 'var(--card-border)',
              borderBottom: 'var(--card-border)',
            }} />
          </div>
        )}

        {/* Sleep Zzz */}
        {state === 'sleeping' && (
          <div className="sleep-zzz" style={{
            position: 'absolute',
            top: -8,
            right: -5,
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}>
            💤
          </div>
        )}

        {/* Body */}
        <div
          className={
            state === 'walking-right' || state === 'walking-left' ? 'avo-buddy-walk' :
            state === 'dancing' ? 'avo-buddy-dance' :
            state === 'waving' ? 'avo-buddy-wave' :
            state === 'falling' ? 'avo-buddy-fall' :
            state === 'getting-up' ? 'avo-buddy-getup' :
            state === 'idle' ? 'avo-buddy-idle' : ''
          }
          style={{
            width: size,
            height: size,
            position: 'relative',
            transform: getBodyTransform(),
            transition: state === 'falling' ? 'transform 0.4s ease-in' :
              state === 'getting-up' ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' :
              'transform 0.3s ease',
          }}
        >
          {/* Mini avocado SVG */}
          <svg width={size} height={size} viewBox="0 0 44 44">
            {/* Leaf */}
            <path d="M22 4 C22 4, 18 1, 19 -1 C20 -2, 24 -2, 25 -1 C26 1, 22 4, 22 4Z" fill="#558B2F" />
            {/* Body */}
            <ellipse cx="22" cy="24" rx="17" ry="18" fill="#558B2F" />
            <ellipse cx="22" cy="24" rx="17" ry="18" fill="url(#miniAvoGrad)" />
            {/* Flesh */}
            <ellipse cx="22" cy="25" rx="13" ry="14" fill="#C5E1A5" />
            <ellipse cx="22" cy="25" rx="13" ry="14" fill="url(#miniFleshGrad)" />
            {/* Pit */}
            <ellipse cx="22" cy="29" rx="5" ry="5.5" fill="#795548" />
            <ellipse cx="21" cy="28" rx="2" ry="2.2" fill="#8D6E63" opacity="0.5" />

            {/* Eyes */}
            {state === 'sleeping' ? (
              <>
                <path d="M16 21 L20 21" stroke="#3D2914" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M24 21 L28 21" stroke="#3D2914" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="18" cy="20" rx="2" ry="2.3" fill="#3D2914" />
                <circle cx="17.3" cy="19.3" r="0.7" fill="#FFF" />
                <ellipse cx="26" cy="20" rx="2" ry="2.3" fill="#3D2914" />
                <circle cx="25.3" cy="19.3" r="0.7" fill="#FFF" />
              </>
            )}

            {/* Mouth */}
            {state === 'sleeping' ? (
              <path d="M19 24 C20 23, 24 23, 25 24" stroke="#3D2914" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            ) : state === 'falling' ? (
              <circle cx="22" cy="24" r="1.5" fill="none" stroke="#3D2914" strokeWidth="1.2" />
            ) : (
              <path d="M18 23 C20 27, 24 27, 26 23" stroke="#3D2914" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            )}

            {/* Blush */}
            <ellipse cx="15" cy="23" rx="2.5" ry="1.5" fill="rgba(255,138,128,0.35)" />
            <ellipse cx="29" cy="23" rx="2.5" ry="1.5" fill="rgba(255,138,128,0.35)" />

            {/* Legs */}
            <ellipse cx="17" cy="41" rx="3.5" ry="2" fill="#33691E" />
            <ellipse cx="27" cy="41" rx="3.5" ry="2" fill="#33691E" />

            <defs>
              <radialGradient id="miniAvoGrad" cx="40%" cy="30%">
                <stop offset="0%" stopColor="#689F38" />
                <stop offset="100%" stopColor="#33691E" />
              </radialGradient>
              <radialGradient id="miniFleshGrad" cx="45%" cy="35%">
                <stop offset="0%" stopColor="#F0F4C3" />
                <stop offset="60%" stopColor="#C5E1A5" />
                <stop offset="100%" stopColor="#AED581" />
              </radialGradient>
            </defs>
          </svg>

          {/* Wave hand */}
          {state === 'waving' && (
            <div className="avo-hand-wave" style={{
              position: 'absolute',
              top: size * 0.3,
              right: -6,
              fontSize: '14px',
              transformOrigin: 'bottom center',
            }}>
              👋
            </div>
          )}
        </div>

        {/* Shadow */}
        <div style={{
          width: size * 0.7,
          height: 4,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.15)',
          margin: '-2px auto 0',
          transform: state === 'falling' ? 'scaleX(0.3)' : state === 'sitting' ? 'scaleX(1.2)' : 'scaleX(1)',
          transition: 'transform 0.3s ease',
        }} />
      </div>
    </div>
  );
}
