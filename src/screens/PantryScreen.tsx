import { useState, useMemo } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { AvocadoBuddy } from '../components/AvocadoBuddy';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { getFreshnessStatus, getFreshnessColor, getDaysUntilExpiration, FOOD_EMOJI, LOCATION_EMOJI } from '../types';
import type { StorageLocation, PantryItem, WasteAction } from '../types';

const LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];
const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  counter: 'Counter',
};

export function PantryScreen() {
  const { user, pantryItems, setShowSettings, removePantryItem, addWasteLog } = useStore();
  const [activeLocation, setActiveLocation] = useState<StorageLocation | 'all'>('all');
  const [swipingItem, setSwipingItem] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'expiration' | 'name' | 'category'>('expiration');

  const filteredItems = useMemo(() => {
    let items = activeLocation === 'all' ? pantryItems : pantryItems.filter(i => i.location === activeLocation);

    return [...items].sort((a, b) => {
      if (sortBy === 'expiration') return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });
  }, [pantryItems, activeLocation, sortBy]);

  const expiringCount = pantryItems.filter(i => {
    const status = getFreshnessStatus(i.expirationDate);
    return status === 'expiring' || status === 'expiring-soon';
  }).length;

  const totalValue = pantryItems.reduce((s, i) => s + i.estimatedValue, 0);

  const handleAction = (item: PantryItem, action: WasteAction) => {
    addWasteLog({
      id: `w-${Date.now()}`,
      itemName: item.name,
      category: item.category,
      action,
      date: new Date().toISOString().split('T')[0],
      estimatedValue: item.estimatedValue,
      quantity: item.quantity,
    });
    removePantryItem(item.id);
    setSwipingItem(null);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.name || 'there';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  return (
    <div className="screen-enter" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 16px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '-12px' }}>
          <AvocadoMascot size={34} />
          <h1 style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 800 }}>
            {getGreeting()}
          </h1>
        </div>
        <button
          className="btn-icon"
          onClick={() => setShowSettings(true)}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--accent-dim)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <Card className="card-enter stagger-1" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--accent)' }}>
            {pantryItems.length}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Items</div>
        </Card>
        <Card className="card-enter stagger-1" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: expiringCount > 0 ? 'var(--expiring)' : 'var(--accent)' }}>
            {expiringCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Expiring</div>
        </Card>
        <Card className="card-enter stagger-1" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
            ${totalValue.toFixed(0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Value</div>
        </Card>
      </div>

      {/* Location filter */}
      <div className="card-enter stagger-2" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          className="btn-pill"
          onClick={() => setActiveLocation('all')}
          style={{
            padding: '8px 14px',
            borderRadius: '20px',
            border: activeLocation === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
            background: activeLocation === 'all' ? 'var(--accent-dim)' : 'transparent',
            color: activeLocation === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'Syne, sans-serif',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          All ({pantryItems.length})
        </button>
        {LOCATIONS.map(loc => {
          const count = pantryItems.filter(i => i.location === loc).length;
          const isActive = activeLocation === loc;
          return (
            <button
              key={loc}
              className="btn-pill"
              onClick={() => setActiveLocation(loc)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Syne, sans-serif',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {LOCATION_EMOJI[loc]} {LOCATION_LABELS[loc]} ({count})
            </button>
          );
        })}
      </div>

      {/* Sort toggle */}
      <div className="card-enter stagger-2" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort:</span>
        {(['expiration', 'name', 'category'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: 'none',
              background: sortBy === s ? 'var(--accent-dim)' : 'transparent',
              color: sortBy === s ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Syne, sans-serif',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Expiring soon alert */}
      {expiringCount > 0 && (
        <Card className="card-enter stagger-3" style={{
          padding: '12px 16px',
          border: '1px solid rgba(255, 152, 0, 0.3)',
          background: 'rgba(255, 152, 0, 0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--expiring-soon)' }}>
                {expiringCount} item{expiringCount > 1 ? 's' : ''} expiring soon!
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Use them up or check the Cook tab for recipe ideas
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Item grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredItems.map((item, i) => {
          const status = getFreshnessStatus(item.expirationDate);
          const color = getFreshnessColor(status);
          const days = getDaysUntilExpiration(item.expirationDate);
          const isSwipe = swipingItem === item.id;

          return (
            <div
              key={item.id}
              className={`card-enter stagger-${Math.min(i + 3, 6)}`}
              style={{ position: 'relative', overflow: 'hidden', borderRadius: '14px' }}
            >
              {/* Swipe actions */}
              {isSwipe && (
                <div className="card-enter" style={{
                  position: 'absolute', inset: 0, display: 'flex', gap: '6px',
                  padding: '8px', zIndex: 2, background: 'var(--bg-card)',
                  borderRadius: '14px', border: 'var(--card-border)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {([
                    { action: 'eaten' as WasteAction, label: 'Eaten', emoji: '✅', color: 'var(--fresh)' },
                    { action: 'tossed' as WasteAction, label: 'Tossed', emoji: '🗑️', color: 'var(--expired)' },
                    { action: 'composted' as WasteAction, label: 'Compost', emoji: '🌱', color: 'var(--good)' },
                    { action: 'shared' as WasteAction, label: 'Shared', emoji: '🤝', color: 'var(--accent)' },
                  ]).map(a => (
                    <button
                      key={a.action}
                      className="btn-solid"
                      onClick={() => handleAction(item, a.action)}
                      style={{
                        flex: 1, padding: '10px 4px', background: 'transparent',
                        border: `1px solid ${a.color}`,
                        borderRadius: '10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{a.emoji}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: a.color, fontFamily: 'Syne, sans-serif' }}>{a.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setSwipingItem(null)}
                    style={{
                      position: 'absolute', top: 6, right: 8,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '16px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Item card */}
              <Card
                onClick={() => setSwipingItem(isSwipe ? null : item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderLeft: `3px solid ${color}`,
                  opacity: isSwipe ? 0.3 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '12px',
                  background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0,
                }}>
                  {FOOD_EMOJI[item.category]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{item.name}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                      ${item.estimatedValue.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.quantity} {item.unit}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {LOCATION_EMOJI[item.location]} {item.location}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color,
                    lineHeight: 1.2,
                  }}>
                    {days < 0 ? `${Math.abs(days)}d ago` :
                     days === 0 ? 'Today!' :
                     days === 1 ? '1 day' :
                     `${days} days`}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color,
                    marginTop: '2px',
                  }}>
                    {status.replace('-', ' ')}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🥑</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Your {activeLocation === 'all' ? 'pantry' : activeLocation} is empty</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tap the + tab to add items!</div>
        </Card>
      )}

      {/* Avocado buddy wandering at bottom */}
      <AvocadoBuddy />
    </div>
  );
}
