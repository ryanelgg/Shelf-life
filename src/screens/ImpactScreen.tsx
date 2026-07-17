import { useMemo, useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { useStore } from '../store/useStore';
import { EmptyState } from '../components/EmptyState';
import { getHouseholdMembers } from '../lib/households';
import { formatLocalDate } from '../types';
import type { WasteLog, HouseholdMember } from '../types';

/** Consecutive days (ending today or yesterday) with at least one "save"
 * (any non-toss action) anywhere in the household. Computed from the shared
 * waste logs so it stays in sync without extra server state. */
function computeSharedStreak(logs: WasteLog[]): number {
  const saveDays = new Set(logs.filter(l => l.action !== 'tossed').map(l => l.date));
  if (saveDays.size === 0) return 0;
  const cursor = new Date();
  // Allow today OR yesterday as the anchor so the streak doesn't read 0 before
  // anyone logs today.
  if (!saveDays.has(formatLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!saveDays.has(formatLocalDate(cursor))) return 0;
  }
  let streak = 0;
  while (saveDays.has(formatLocalDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function ImpactIcon({ type, size = 28, color = 'currentColor' }: { type: string; size?: number; color?: string }) {
  const s = { width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 as const };
  const p = { fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'eaten') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12L11 15L16 9" />
    </svg></span>
  );
  if (type === 'tossed') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M3 6H21M8 6L9 3H15L16 6" />
      <path d="M5 6L6 21H18L19 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg></span>
  );
  if (type === 'composted') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M12 21V12" />
      <path d="M12 17C10 14.5 6 14 5 11C7.5 8 11.5 9.5 12 12" />
      <path d="M12 14C14 11 18 10 19 8C17 5 13 7 12 11" />
      <path d="M8.5 21Q12 18.5 15.5 21" />
    </svg></span>
  );
  if (type === 'co2') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M12 20V11" />
      <path d="M12 11C12 6 18.5 3.5 21 3.5C21 3.5 21 10 16 12C14 12.8 12 11 12 11Z" />
      <path d="M12 15C12 15 7.5 16 5.5 13C5.5 10 9.5 9 12 11" />
    </svg></span>
  );
  if (type === 'money') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="5.5" x2="12" y2="18.5" />
      <path d="M12 7.5 C15 7.5 15 11.5 12 11.5 C9 11.5 9 15.5 12 15.5" />
    </svg></span>
  );
  if (type === 'trophy') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M8 21H16M12 17V21M7 4H17L16 12C16 14.2 14.2 16 12 16C9.8 16 8 14.2 8 12L7 4Z" />
      <path d="M7 6H4C4 6 4 11 7 11M17 6H20C20 6 20 11 17 11" />
    </svg></span>
  );
  if (type === 'streak') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M12 2C12 2 9 7 9 10C9 11.7 10.3 13 12 13C13.7 13 15 11.7 15 10C15 8 14 5 14 5" />
      <path d="M12 13C12 13 7 15 7 19C7 21.2 9.2 22 12 22C14.8 22 17 21.2 17 19C17 15 12 13 12 13Z" />
    </svg></span>
  );
  return null;
}

export function ImpactScreen() {
  const { wasteLogs, user, household, supabaseUserId } = useStore();

  // Household members for the "Saved Together" card + leaderboard. Only fetched
  // when in a household; the cards that use this are gated on `household` too.
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  useEffect(() => {
    if (!household) return;
    let cancelled = false;
    getHouseholdMembers().then(m => { if (!cancelled) setMembers(m); });
    return () => { cancelled = true; };
  }, [household]);

  const sharedStreak = useMemo(() => computeSharedStreak(wasteLogs), [wasteLogs]);

  // Per-member tally: items saved (non-toss actions) + dollars saved, keyed by
  // userId, joined to member names. Sorted by items saved, desc.
  const leaderboard = useMemo(() => {
    if (!household) return [];
    const byUser = new Map<string, { saved: number; money: number }>();
    for (const log of wasteLogs) {
      if (log.action === 'tossed' || !log.userId) continue;
      const cur = byUser.get(log.userId) ?? { saved: 0, money: 0 };
      cur.saved += 1;
      // estimatedValue is the whole-entry value (same rule the "Saved Together"
      // total below relies on), so do NOT multiply by quantity — otherwise the
      // per-member dollars inflate and stop summing to the household total.
      cur.money += log.estimatedValue;
      byUser.set(log.userId, cur);
    }
    return members
      .map(m => ({
        userId: m.userId,
        name: m.userId === supabaseUserId ? 'You' : (m.name ?? 'Member'),
        isYou: m.userId === supabaseUserId,
        saved: byUser.get(m.userId)?.saved ?? 0,
        money: byUser.get(m.userId)?.money ?? 0,
      }))
      .sort((a, b) => b.saved - a.saved);
  }, [household, members, wasteLogs, supabaseUserId]);

  const stats = useMemo(() => {
    const eaten = wasteLogs.filter(w => w.action === 'eaten');
    const tossed = wasteLogs.filter(w => w.action === 'tossed');
    const composted = wasteLogs.filter(w => w.action === 'composted');
    const shared = wasteLogs.filter(w => w.action === 'shared');
    const donated = wasteLogs.filter(w => w.action === 'donated');

    const totalItems = wasteLogs.length;
    const wasteRate = totalItems > 0 ? (tossed.length / totalItems) * 100 : 0;
    const saveRate = totalItems > 0 ? ((totalItems - tossed.length) / totalItems) * 100 : 0;

    const pieData = [
      { name: 'Eaten', value: eaten.length, color: 'var(--fresh)' },
      { name: 'Tossed', value: tossed.length, color: 'var(--expired)' },
      { name: 'Composted', value: composted.length, color: 'var(--good)' },
      { name: 'Shared', value: shared.length, color: 'var(--expiring-soon)' },
      { name: 'Donated', value: donated.length, color: 'var(--accent)' },
    ].filter(d => d.value > 0);

    // CO2 saved estimate
    const itemsSaved = totalItems - tossed.length;
    const co2Saved = (itemsSaved * 0.5).toFixed(1);

    // Money saved — sum estimatedValue of everything that wasn't tossed.
    // estimatedValue is the whole-entry value (matches the Pantry total and the
    // per-item display), so do NOT multiply by quantity here.
    const moneySaved = wasteLogs
      .filter(w => w.action !== 'tossed')
      .reduce((sum, w) => sum + w.estimatedValue, 0);

    return {
      totalItems,
      eaten: eaten.length, tossed: tossed.length, composted: composted.length,
      shared: shared.length, donated: donated.length,
      wasteRate, saveRate, pieData, co2Saved, itemsSaved, moneySaved,
    };
  }, [wasteLogs]);

  const streakDays = user?.streakDays ?? 0;

  // Weekly Challenge — real progress toward saving 3 items this calendar week
  // (Mon–Sun), counting anything logged as not-tossed. No more hardcoded 66%.
  const WEEK_GOAL = 3;
  const weekly = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayIndex = (now.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
    startOfWeek.setDate(startOfWeek.getDate() - mondayIndex);
    const startStr = formatLocalDate(startOfWeek);
    const saves = wasteLogs.filter(w => w.action !== 'tossed' && w.date >= startStr).length;
    return { saves, daysLeft: 7 - mondayIndex };
  }, [wasteLogs]);
  const weekProgress = Math.min(100, Math.round((weekly.saves / WEEK_GOAL) * 100));

  if (wasteLogs.length === 0) {
    return (
      <EmptyState
        title="Your impact starts here"
        description="Log what you eat, toss, or compost and Avo will show you how much money you've saved and waste you've avoided."
        ctaLabel="Go to my pantry"
        ctaTab="pantry"
      />
    );
  }

  return (
    <div className="screen-enter" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '-12px' }}>
        <AvocadoMascot size={34} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Your Impact</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>How you're doing</p>
        </div>
      </div>

      {/* Money saved hero */}
      <Card className="card-enter stagger-2" style={{
        textAlign: 'center',
        padding: '24px 20px',
        background: 'rgba(74, 124, 89, 0.04)',
        border: '1px solid rgba(74, 124, 89, 0.15)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Money Saved
        </div>
        <div className="mono" style={{ fontSize: '52px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
          ${stats.moneySaved.toFixed(2)}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
          by not throwing out {stats.itemsSaved} item{stats.itemsSaved !== 1 ? 's' : ''}
        </div>
        <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Save Rate
          </div>
          <ProgressBar value={stats.saveRate} color="var(--accent)" height={6} />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {stats.saveRate.toFixed(0)}% of tracked food used before expiring
          </div>
        </div>
      </Card>

      {/* Action breakdown */}
      <Card className="card-enter stagger-3">
        <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", marginBottom: '12px' }}>What Happened to Your Food</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[
            { label: 'Eaten', value: stats.eaten, icon: 'eaten', color: 'var(--fresh)' },
            { label: 'Tossed', value: stats.tossed, icon: 'tossed', color: 'var(--expired)' },
            { label: 'Composted', value: stats.composted, icon: 'composted', color: 'var(--good)' },
          ].map(a => (
            <div key={a.label}>
              <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}><ImpactIcon type={a.icon} size={28} color={a.color} /></div>
              <div className="mono" style={{ fontSize: '22px', fontWeight: 500, color: a.color }}>{a.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Distribution pie */}
      {stats.pieData.length > 0 && (
        <Card className="card-enter stagger-4">
          <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", marginBottom: '4px' }}>Distribution</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>How your food items were used</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.name}</span>
                  <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Environmental impact */}
      <Card className="card-enter stagger-5" style={{ border: '1px solid rgba(74, 124, 89, 0.15)' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", marginBottom: '12px' }}>Environmental Impact</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><ImpactIcon type="co2" size={32} color="var(--accent)" /></div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--accent)' }}>{stats.co2Saved} kg</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>CO2 Prevented</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><ImpactIcon type="money" size={32} color="var(--accent)" /></div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--accent)' }}>${stats.moneySaved.toFixed(0)}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Money Saved</div>
          </div>
        </div>
      </Card>

      {/* Streak */}
      <Card className="card-enter stagger-6" style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Zero-Waste Streak
        </div>
        <div className="mono" style={{ fontSize: '40px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
          {streakDays} days
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '12px' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: '8px',
              background: i < (streakDays % 7 || (streakDays > 0 ? 7 : 0)) ? 'var(--accent)' : 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px',
              transition: 'background 0.3s',
            }}>
              {i < (streakDays % 7 || (streakDays > 0 ? 7 : 0)) ? <ImpactIcon type="streak" size={14} color="#fff" /> : ''}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Keep it up! No food tossed in {streakDays} days.
        </div>
      </Card>

      {/* Saved Together — household shared tally + joint streak (FREE).
          wasteLogs is already household-wide when in a household (loaded by
          household_id + realtime), so these totals reflect the whole crew. */}
      {household && (
        <Card className="card-enter stagger-6" style={{
          background: 'rgba(74, 124, 89, 0.06)',
          border: '1px solid rgba(74, 124, 89, 0.16)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <ImpactIcon type="streak" size={24} color="var(--accent)" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Saved Together</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {members.length > 0 ? `Your household of ${members.length}` : 'Your household'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: '26px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
                {stats.itemsSaved}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                Items saved
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: '26px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
                ${stats.moneySaved.toFixed(0)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                Saved
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: '26px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
                {sharedStreak}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                Day streak
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
            {sharedStreak > 0
              ? `${sharedStreak} day${sharedStreak === 1 ? '' : 's'} running — keep the household streak alive!`
              : 'Log a save today to start your household streak.'}
          </div>

          {leaderboard.length > 1 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--accent-dim)', paddingTop: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Who's saving the most
              </div>
              {leaderboard.map((m, i) => (
                <div key={m.userId} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '6px 8px', borderRadius: '8px',
                  background: m.isYou ? 'rgba(74, 124, 89, 0.10)' : 'transparent',
                }}>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', width: '20px', textAlign: 'center' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: m.isYou ? 700 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
                  </span>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                    {m.saved} saved
                  </span>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', width: '48px', textAlign: 'right' }}>
                    ${m.money.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Weekly Challenge */}
      <Card className="card-enter stagger-6" style={{
        background: 'rgba(74, 124, 89, 0.04)',
        border: '1px solid rgba(74, 124, 89, 0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <ImpactIcon type="trophy" size={26} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Weekly Challenge</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Save {WEEK_GOAL} items from the bin this week</div>
          </div>
        </div>
        <ProgressBar value={weekProgress} color="var(--accent)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>{Math.min(weekly.saves, WEEK_GOAL)} / {WEEK_GOAL} saved{weekly.saves >= WEEK_GOAL ? ' 🎉' : ''}</span>
          <span style={{ color: 'var(--accent)' }}>{weekly.daysLeft} day{weekly.daysLeft === 1 ? '' : 's'} left</span>
        </div>
      </Card>

    </div>
  );
}
