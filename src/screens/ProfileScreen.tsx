import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { computeImpactStats } from '../lib/impact';
import { badgeStandings } from '../lib/badges';
import { AVATAR_PRESETS, DEFAULT_AVATAR } from '../lib/avatars';
import { hapticLight } from '../lib/haptics';

// "Actual profile": identity + lifetime impact + the nature badge collection.
export function ProfileScreen({ onClose }: { onClose: () => void }) {
  const { user, wasteLogs, household, setAvatar } = useStore();
  const [pickingAvatar, setPickingAvatar] = useState(false);

  const bestStreak = user?.bestStreak ?? user?.streakDays ?? 0;
  const { stats, standings } = useMemo(() => {
    const s = computeImpactStats(wasteLogs);
    return { stats: s, standings: badgeStandings(s, bestStreak) };
  }, [wasteLogs, bestStreak]);

  const avatar = user?.avatar || DEFAULT_AVATAR;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const isPro = user?.subscriptionTier === 'pro';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)', zIndex: 55,
      display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Profile</h2>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)',
          fontSize: '14px', fontWeight: 600, fontFamily: "'Cormorant Garamond', serif",
        }}>
          Done
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Identity */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => { hapticLight(); setPickingAvatar((v) => !v); }}
              aria-label="Change avatar"
              style={{
                width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--input-border)',
                background: 'var(--input-bg)', fontSize: '34px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {avatar}
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '20px', fontWeight: 800 }}>{user?.name ?? 'Friend'}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                  background: isPro ? 'var(--accent)' : 'var(--input-bg)',
                  color: isPro ? '#fff' : 'var(--text-muted)',
                }}>
                  {isPro ? 'PRO' : 'FREE'}
                </span>
                {memberSince && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Since {memberSince}</span>
                )}
              </div>
            </div>
          </div>

          {pickingAvatar && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {AVATAR_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => { hapticLight(); setAvatar(a); setPickingAvatar(false); }}
                  aria-label={`Avatar ${a}`}
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer',
                    border: a === avatar ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Lifetime stats */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Lifetime impact
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <StatBox value={`$${stats.moneySaved.toFixed(0)}`} label="saved" />
            <StatBox value={`${stats.itemsSaved}`} label="items rescued" />
            <StatBox value={`${bestStreak}`} label="best streak (days)" />
            <StatBox value={`${stats.co2Kg.toFixed(1)} kg`} label="CO₂ saved" />
          </div>
          {household && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              🏡 Shared with your household
            </div>
          )}
        </Card>

        {/* Badge collection */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Badges
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {standings.map((s) => {
              const earned = s.current !== null;
              const progressLabel = s.next
                ? `${s.value < 1 ? s.value.toFixed(1) : Math.floor(s.value)} / ${s.next.threshold} ${s.track.unit} → ${s.next.name}`
                : 'Maxed out — top tier reached! ✨';
              return (
                <div key={s.track.id} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    fontSize: '34px', width: '48px', textAlign: 'center',
                    filter: earned ? 'none' : 'grayscale(1)', opacity: earned ? 1 : 0.4,
                  }}>
                    {s.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>
                      {s.track.title}
                      {s.current && (
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {s.current.name}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {progressLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--input-bg)', borderRadius: '12px', padding: '14px' }}>
      <div className="mono" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}
