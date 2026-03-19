import { useMemo } from 'react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, PieChart, Pie } from 'recharts';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { useStore } from '../store/useStore';

export function ImpactScreen() {
  const { wasteLogs, user, theme } = useStore();

  const stats = useMemo(() => {
    const eaten = wasteLogs.filter(w => w.action === 'eaten');
    const tossed = wasteLogs.filter(w => w.action === 'tossed');
    const composted = wasteLogs.filter(w => w.action === 'composted');
    const donated = wasteLogs.filter(w => w.action === 'donated');
    const shared = wasteLogs.filter(w => w.action === 'shared');

    const totalSaved = eaten.reduce((s, w) => s + w.estimatedValue, 0) +
      composted.reduce((s, w) => s + w.estimatedValue, 0) +
      donated.reduce((s, w) => s + w.estimatedValue, 0) +
      shared.reduce((s, w) => s + w.estimatedValue, 0);
    const totalWasted = tossed.reduce((s, w) => s + w.estimatedValue, 0);
    const totalItems = wasteLogs.length;

    const wasteRate = totalItems > 0 ? (tossed.length / totalItems) * 100 : 0;
    const saveRate = totalItems > 0 ? ((totalItems - tossed.length) / totalItems) * 100 : 0;

    // Category breakdown
    const categories: Record<string, { eaten: number; tossed: number; composted: number }> = {};
    wasteLogs.forEach(w => {
      if (!categories[w.category]) categories[w.category] = { eaten: 0, tossed: 0, composted: 0 };
      if (w.action === 'eaten') categories[w.category].eaten++;
      else if (w.action === 'tossed') categories[w.category].tossed++;
      else categories[w.category].composted++;
    });

    // Weekly data
    const now = new Date();
    const weekData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekLogs = wasteLogs.filter(w => {
        const d = new Date(w.date);
        return d >= weekStart && d < weekEnd;
      });
      const saved = weekLogs.filter(w => w.action !== 'tossed').reduce((s, w) => s + w.estimatedValue, 0);
      const wasted = weekLogs.filter(w => w.action === 'tossed').reduce((s, w) => s + w.estimatedValue, 0);
      weekData.push({
        week: `Wk ${4 - i}`,
        saved: Math.round(saved * 100) / 100,
        wasted: Math.round(wasted * 100) / 100,
      });
    }

    // Pie chart data
    const pieData = [
      { name: 'Eaten', value: eaten.length, color: 'var(--fresh)' },
      { name: 'Tossed', value: tossed.length, color: 'var(--expired)' },
      { name: 'Composted', value: composted.length, color: 'var(--good)' },
      { name: 'Donated', value: donated.length + shared.length, color: 'var(--accent)' },
    ].filter(d => d.value > 0);

    // CO2 saved estimate (roughly 2.5 kg CO2 per kg food not wasted)
    const itemsSaved = totalItems - tossed.length;
    const co2Saved = (itemsSaved * 0.5).toFixed(1); // rough estimate

    return {
      totalSaved, totalWasted, totalItems,
      eaten: eaten.length, tossed: tossed.length, composted: composted.length,
      donated: donated.length + shared.length,
      wasteRate, saveRate, weekData, pieData, categories, co2Saved, itemsSaved,
    };
  }, [wasteLogs]);

  const streakDays = user?.streakDays || 7;

  // Determine Avo's mood message
  const avoMessage = useMemo(() => {
    if (stats.wasteRate === 0) return "Zero waste! You're my hero! 🌟";
    if (stats.wasteRate < 15) return "Amazing work! You're barely wasting anything!";
    if (stats.wasteRate < 30) return "Good progress! Let's keep reducing that waste!";
    if (stats.wasteRate < 50) return "Not bad! Check the Cook tab for ways to use up expiring items.";
    return "We can do better together! Try planning meals before shopping.";
  }, [stats.wasteRate]);

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
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Your waste footprint</p>
        </div>
      </div>

      {/* Avo message */}
      <Card className="card-enter stagger-1" style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        border: '1px solid rgba(139, 195, 74, 0.2)',
        background: 'rgba(139, 195, 74, 0.04)',
      }}>
        <span style={{ fontSize: '24px' }}>🥑</span>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
          {avoMessage}
        </div>
      </Card>

      {/* Save rate hero */}
      <Card className="card-enter stagger-2" style={{
        textAlign: 'center',
        padding: '24px 20px',
        background: 'linear-gradient(135deg, var(--safe-gradient-1), var(--safe-gradient-2))',
        border: '1px solid rgba(139, 195, 74, 0.2)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Food Save Rate
        </div>
        <div className="mono" style={{ fontSize: '52px', fontWeight: 500, color: 'var(--accent)', lineHeight: 1.1 }}>
          {stats.saveRate.toFixed(0)}%
        </div>
        <ProgressBar value={stats.saveRate} color="var(--accent)" height={8} />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
          {stats.itemsSaved} out of {stats.totalItems} items saved from waste
        </div>
      </Card>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Card className="card-enter stagger-3" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--accent)' }}>
            ${stats.totalSaved.toFixed(0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
            Money Saved
          </div>
        </Card>
        <Card className="card-enter stagger-3" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--expired)' }}>
            ${stats.totalWasted.toFixed(0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
            Wasted
          </div>
        </Card>
      </div>

      {/* Action breakdown */}
      <Card className="card-enter stagger-4">
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Item Actions</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[
            { label: 'Eaten', value: stats.eaten, emoji: '✅', color: 'var(--fresh)' },
            { label: 'Tossed', value: stats.tossed, emoji: '🗑️', color: 'var(--expired)' },
            { label: 'Composted', value: stats.composted, emoji: '🌱', color: 'var(--good)' },
            { label: 'Donated', value: stats.donated, emoji: '🤝', color: 'var(--accent)' },
          ].map(a => (
            <div key={a.label}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{a.emoji}</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 500, color: a.color }}>{a.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Distribution pie */}
      {stats.pieData.length > 0 && (
        <Card className="card-enter stagger-4">
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Distribution</div>
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

      {/* Weekly chart */}
      <Card className="card-enter stagger-5">
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Weekly Savings</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Saved vs. wasted value per week</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={stats.weekData} barGap={2}>
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: 'var(--card-border)', borderRadius: 10, fontFamily: 'DM Mono', color: 'var(--text-primary)' }}
              cursor={false}
            />
            <Bar dataKey="saved" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={20} name="Saved" />
            <Bar dataKey="wasted" fill="var(--expired)" radius={[4, 4, 0, 0]} barSize={20} name="Wasted" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Environmental impact */}
      <Card className="card-enter stagger-5" style={{ border: '1px solid rgba(139, 195, 74, 0.2)' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Environmental Impact</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>🌍</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--accent)' }}>{stats.co2Saved} kg</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>CO2 Prevented</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>💧</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--accent)' }}>{(stats.itemsSaved * 50).toLocaleString()} L</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Water Saved</div>
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
              background: i < streakDays % 7 ? 'var(--accent)' : 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px',
              transition: 'background 0.3s',
            }}>
              {i < streakDays % 7 ? '🌱' : ''}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Keep it up! No food tossed in {streakDays} days.
        </div>
      </Card>

      {/* Community challenge */}
      <Card className="card-enter stagger-6" style={{
        background: 'linear-gradient(135deg, var(--safe-gradient-1), var(--safe-gradient-2))',
        border: '1px solid rgba(139, 195, 74, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontSize: '22px' }}>🏆</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Weekly Challenge</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cook 3 meals from expiring ingredients</div>
          </div>
        </div>
        <ProgressBar value={66} color="var(--accent)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>2 / 3 meals cooked</span>
          <span style={{ color: 'var(--accent)' }}>4 days left</span>
        </div>
      </Card>
    </div>
  );
}
