import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { useStore } from '../store/useStore';

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
  if (type === 'water') return (
    <span style={s}><svg viewBox="0 0 24 24" {...p}>
      <path d="M12 3C12 3 5.5 11.5 5.5 15.5C5.5 19 8.4 21.5 12 21.5C15.6 21.5 18.5 19 18.5 15.5C18.5 11.5 12 3 12 3Z" />
      <path d="M9 17C9.5 18.5 11 19.5 12.5 19.5" />
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
  const { wasteLogs, user } = useStore();

  const stats = useMemo(() => {
    const eaten = wasteLogs.filter(w => w.action === 'eaten');
    const tossed = wasteLogs.filter(w => w.action === 'tossed');
    const composted = wasteLogs.filter(w => w.action === 'composted');

    const totalItems = wasteLogs.length;
    const wasteRate = totalItems > 0 ? (tossed.length / totalItems) * 100 : 0;
    const saveRate = totalItems > 0 ? ((totalItems - tossed.length) / totalItems) * 100 : 0;

    // Pie chart data (no donated)
    const pieData = [
      { name: 'Eaten', value: eaten.length, color: 'var(--fresh)' },
      { name: 'Tossed', value: tossed.length, color: 'var(--expired)' },
      { name: 'Composted', value: composted.length, color: 'var(--good)' },
    ].filter(d => d.value > 0);

    // CO2 saved estimate
    const itemsSaved = totalItems - tossed.length;
    const co2Saved = (itemsSaved * 0.5).toFixed(1);

    return {
      totalItems,
      eaten: eaten.length, tossed: tossed.length, composted: composted.length,
      wasteRate, saveRate, pieData, co2Saved, itemsSaved,
    };
  }, [wasteLogs]);

  const streakDays = user?.streakDays || 7;

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

      {/* Save rate hero */}
      <Card className="card-enter stagger-2" style={{
        textAlign: 'center',
        padding: '24px 20px',
        background: 'rgba(74, 124, 89, 0.04)',
        border: '1px solid rgba(74, 124, 89, 0.15)',
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
            <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><ImpactIcon type="water" size={32} color="var(--accent)" /></div>
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
              {i < streakDays % 7 ? <ImpactIcon type="streak" size={14} color="#fff" /> : ''}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Keep it up! No food tossed in {streakDays} days.
        </div>
      </Card>

      {/* Weekly Challenge */}
      <Card className="card-enter stagger-6" style={{
        background: 'rgba(74, 124, 89, 0.04)',
        border: '1px solid rgba(74, 124, 89, 0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <ImpactIcon type="trophy" size={26} color="var(--accent)" />
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
