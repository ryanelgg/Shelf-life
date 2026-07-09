import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { computeImpactStats, logsThisWeek, weekRangeLabel } from '../lib/impact';
import { badgeStandings, firstNewBadge, allEarnedTierIds } from '../lib/badges';
import { CARD_THEMES, getCardTheme, renderImpactCardPng, shareImpactCard } from '../lib/impactCard';
import { DEFAULT_AVATAR } from '../lib/avatars';
import { hapticMedium } from '../lib/haptics';
import * as debug from '../lib/debug';

// The little weekly recap that pops up once a week. Shows this week's wins, any
// new badge, and a one-tap share to a branded image card. Free users get the
// Classic theme; Pro unlocks the others.
export function WeeklyImpactCard({ onClose }: { onClose: () => void }) {
  const { wasteLogs, user, isPro, cardTheme, setCardTheme, seenBadgeTierIds, markBadgesSeen } = useStore();
  const [sharing, setSharing] = useState(false);
  const pro = isPro();

  const { week, newBadge, allEarned } = useMemo(() => {
    const weekStats = computeImpactStats(logsThisWeek(wasteLogs));
    const lifetime = computeImpactStats(wasteLogs);
    const standings = badgeStandings(lifetime, user?.bestStreak ?? user?.streakDays ?? 0);
    return {
      week: weekStats,
      newBadge: firstNewBadge(standings, seenBadgeTierIds),
      allEarned: allEarnedTierIds(standings),
    };
  }, [wasteLogs, user, seenBadgeTierIds]);

  const theme = getCardTheme(pro ? cardTheme : 'classic');
  const avatar = user?.avatar || DEFAULT_AVATAR;
  const weekRange = weekRangeLabel(new Date());

  const close = () => {
    // Don't celebrate the same badge again next week.
    if (allEarned.length) markBadgesSeen(allEarned);
    onClose();
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      hapticMedium();
      const png = renderImpactCardPng(
        {
          weekRange,
          moneySaved: week.moneySaved,
          itemsRescued: week.itemsSaved,
          saveRate: week.saveRate,
          streak: user?.streakDays ?? 0,
          co2Kg: week.co2Kg,
          avatar,
          newBadge: newBadge ? { emoji: newBadge.emoji, name: newBadge.name } : null,
        },
        theme.id,
      );
      await shareImpactCard(png);
    } catch (e) {
      debug.error('Impact card share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '24px',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '380px', borderRadius: '24px', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        {/* Card preview (mirrors the shared image) */}
        <div style={{
          background: `linear-gradient(135deg, ${theme.bg[0]}, ${theme.bg[1]})`,
          color: theme.fg, padding: '28px 24px 32px', textAlign: 'center',
        }}>
          <div style={{ color: theme.sub, fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px' }}>
            MY PANTRE WEEK
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{weekRange}</div>
          <div style={{ fontSize: '64px', lineHeight: 1.1, margin: '10px 0' }}>{avatar}</div>
          <div style={{ color: theme.accent, fontSize: '64px', fontWeight: 800, lineHeight: 1 }}>
            ${week.moneySaved.toFixed(0)}
          </div>
          <div style={{ color: theme.sub, fontSize: '14px', marginTop: '4px' }}>
            saved from the bin this week
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '22px' }}>
            <Stat value={`${week.itemsSaved}`} label="rescued" theme={theme} />
            <Stat value={`${Math.round(week.saveRate)}%`} label="kept" theme={theme} />
            <Stat value={`${user?.streakDays ?? 0}`} label="day streak" theme={theme} />
          </div>
          <div style={{ fontSize: '14px', marginTop: '20px' }}>
            🌳 {week.co2Kg.toFixed(1)} kg CO₂ kept out of the air
          </div>
          {newBadge && (
            <div style={{
              marginTop: '14px', display: 'inline-block', padding: '6px 14px', borderRadius: '999px',
              background: 'rgba(255,255,255,0.18)', color: theme.fg, fontSize: '13px', fontWeight: 600,
            }}>
              New badge: {newBadge.emoji} {newBadge.name}
            </div>
          )}
          <div style={{ color: theme.sub, fontSize: '13px', fontWeight: 600, marginTop: '18px' }}>
            🥑 usepantre.me
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: 'var(--bg-card)', padding: '16px 18px 20px' }}>
          {/* Theme picker */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '14px' }}>
            {CARD_THEMES.map((t) => {
              const locked = t.pro && !pro;
              const selected = theme.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { if (!locked) setCardTheme(t.id); }}
                  aria-label={`${t.name} theme${locked ? ' (Pro)' : ''}`}
                  style={{
                    width: '34px', height: '34px', borderRadius: '50%', cursor: locked ? 'not-allowed' : 'pointer',
                    border: selected ? '3px solid var(--accent)' : '2px solid rgba(0,0,0,0.12)',
                    background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`,
                    opacity: locked ? 0.5 : 1, position: 'relative', fontSize: '12px',
                  }}
                >
                  {locked ? '🔒' : ''}
                </button>
              );
            })}
          </div>
          {!pro && (
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              More card themes with Pro
            </div>
          )}

          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', opacity: sharing ? 0.6 : 1,
            }}
          >
            {sharing ? 'Preparing…' : 'Share my week 🥑'}
          </button>
          <button
            onClick={close}
            style={{
              width: '100%', padding: '12px', marginTop: '8px', borderRadius: '14px',
              border: 'none', background: 'transparent', color: 'var(--text-muted)',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, theme }: { value: string; label: string; theme: { fg: string; sub: string } }) {
  return (
    <div>
      <div style={{ color: theme.fg, fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ color: theme.sub, fontSize: '12px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}
