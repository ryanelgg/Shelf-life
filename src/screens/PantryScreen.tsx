import { useState, useMemo, useEffect } from 'react';
import { checkPantryForRecalls } from '../lib/recallApi';
import type { RecallMatch } from '../lib/recallApi';
import posthog from 'posthog-js';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { getFreshnessStatus, getFreshnessColor, getDaysUntilExpiration, formatLocalDate, parseLocalDate, resolveDateType, dateTypeShortLabel } from '../types';
import { lookupShelfLife } from '../data/shelfLife';
import { hapticLight } from '../lib/haptics';
import { FoodCategoryIcon } from '../components/FoodCategoryIcon';
import { StorageLocationIcon } from '../components/StorageLocationIcon';
import type { FoodCategory, StorageLocation, PantryItem, WasteAction, DateLabelType } from '../types';

const LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];
const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  counter: 'Counter',
};

const FREEZER_FALLBACK_DAYS: Record<FoodCategory, number> = {
  Produce: 365, Dairy: 90, Meat: 120, Seafood: 90,
  Grains: 365, Frozen: 365, Canned: 730, Snacks: 180,
  Beverages: 90, Condiments: 365, Bakery: 90, Deli: 60, Other: 90,
};

function EmptyPantryIllustration() {
  const wood   = '#C4956A';
  const woodDk = '#8B6035';
  const wall   = '#FAF2E4';
  const web    = '#BFB09A';
  const dust   = '#D4B88A';
  return (
    <svg width="82" height="78" viewBox="0 0 82 78" fill="none">
      {/* ── back wall ── */}
      <path
        d="M13 11 C13 10, 69 10, 69 11 L69 66 C69 67, 13 67, 13 66 Z"
        fill={wall} stroke={woodDk} strokeWidth="1.8" strokeLinejoin="round"
      />

      {/* ── top cornice ── */}
      <path
        d="M9 7 C12 6.5, 70 6.5, 73 7 L73 13 C70 13.5, 12 13.5, 9 13 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.8" strokeLinejoin="round"
      />

      {/* ── left side panel ── */}
      <path
        d="M9 7 L15 7 L15 70 L9 70 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.8" strokeLinejoin="round"
      />

      {/* ── right side panel ── */}
      <path
        d="M67 7 L73 7 L73 70 L67 70 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.8" strokeLinejoin="round"
      />

      {/* ── base ── */}
      <path
        d="M9 65 C12 64.5, 70 64.5, 73 65 L73 71 C70 71.5, 12 71.5, 9 71 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.8" strokeLinejoin="round"
      />

      {/* ── shelf 1 (upper) ── */}
      <path
        d="M15 33 C25 32.4, 55 33.6, 67 33 L67 36.5 C55 37, 25 36, 15 36.5 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.6" strokeLinejoin="round"
      />

      {/* ── shelf 2 (lower) ── */}
      <path
        d="M15 52 C28 51.3, 52 52.7, 67 52 L67 55.5 C52 56, 28 55, 15 55.5 Z"
        fill={wood} stroke={woodDk} strokeWidth="1.6" strokeLinejoin="round"
      />

      {/* ── cobweb, top-right corner ── */}
      <path d="M67 14 L55 26" stroke={web} strokeWidth="0.85" strokeLinecap="round"/>
      <path d="M67 20 L57 28" stroke={web} strokeWidth="0.85" strokeLinecap="round"/>
      <path d="M67 26 L59 30" stroke={web} strokeWidth="0.85" strokeLinecap="round"/>
      <path d="M59.5 17 C61 19, 65 20, 67 20"  stroke={web} strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      <path d="M56.5 22 C59 24, 63 25, 67 26"  stroke={web} strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      {/* tiny spider */}
      <circle cx="56" cy="25" r="1.3" fill={web} />
      <line x1="54" y1="25"   x2="52.5" y2="23.5" stroke={web} strokeWidth="0.7"/>
      <line x1="54" y1="25.5" x2="52.5" y2="26.5" stroke={web} strokeWidth="0.7"/>
      <line x1="58" y1="25"   x2="59.5" y2="23.5" stroke={web} strokeWidth="0.7"/>
      <line x1="58" y1="25.5" x2="59.5" y2="26.5" stroke={web} strokeWidth="0.7"/>

      {/* ── dust specks on shelves ── */}
      <circle cx="28" cy="31.5" r="1"   fill={dust} opacity="0.6"/>
      <circle cx="38" cy="32"   r="0.7" fill={dust} opacity="0.45"/>
      <circle cx="48" cy="31"   r="1.2" fill={dust} opacity="0.5"/>
      <circle cx="30" cy="50.5" r="0.9" fill={dust} opacity="0.5"/>
      <circle cx="44" cy="51"   r="0.7" fill={dust} opacity="0.4"/>
    </svg>
  );
}

function createWasteLogId() {
  return `w-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

function dateDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function PantryScreen() {
  const { user, pantryItems, setShowSettings, removePantryItem, addWasteLog, updatePantryItem, setActiveTab, setRecipeSearchSeed } = useStore();
  const [activeLocation, setActiveLocation] = useState<StorageLocation | 'all'>('all');
  const [swipingItem, setSwipingItem] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'expiration' | 'name' | 'category'>('expiration');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertDismissing, setAlertDismissing] = useState(false);
  const [listAnimKey, setListAnimKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterBubbleKey, setFilterBubbleKey] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBubbleKey, setSortBubbleKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [recallMatches, setRecallMatches] = useState<RecallMatch[]>([]);
  const [recallDismissed, setRecallDismissed] = useState(false);

  useEffect(() => {
    if (pantryItems.length === 0) return;
    let cancelled = false;
    const names = pantryItems.map(i => i.name);
    checkPantryForRecalls(names).then(matches => {
      if (cancelled) return; // a newer check superseded this one
      setRecallMatches(prev => {
        // Re-surface the banner only when the set of matched items actually
        // changed, so a genuinely new recall isn't hidden by an earlier dismiss.
        const key = (m: RecallMatch[]) => m.map(x => x.id).sort().join('|');
        if (key(prev) !== key(matches)) setRecallDismissed(false);
        return matches;
      });
    }).catch(() => {/* silently ignore - recall check is best-effort */});
    return () => { cancelled = true; };
  }, [pantryItems]);

  const filteredItems = useMemo(() => {
    let items = activeLocation === 'all' ? pantryItems : pantryItems.filter(i => i.location === activeLocation);
    if (expiringOnly) items = items.filter(i => { const s = getFreshnessStatus(i.expirationDate); return s === 'expiring' || s === 'expiring-soon'; });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => {
      if (sortBy === 'expiration') return parseLocalDate(a.expirationDate).getTime() - parseLocalDate(b.expirationDate).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });
  }, [pantryItems, activeLocation, sortBy, searchQuery, expiringOnly]);

  const expiringCount = pantryItems.filter(i => {
    const status = getFreshnessStatus(i.expirationDate);
    return status === 'expiring' || status === 'expiring-soon';
  }).length;

  const totalValue = pantryItems.reduce((s, i) => s + i.estimatedValue, 0);
  const urgentItems = useMemo(() => (
    pantryItems
      .filter(i => ['expired', 'expiring', 'expiring-soon'].includes(getFreshnessStatus(i.expirationDate)))
      .sort((a, b) => parseLocalDate(a.expirationDate).getTime() - parseLocalDate(b.expirationDate).getTime())
      .slice(0, 3)
  ), [pantryItems]);


  const handleAction = (item: PantryItem, action: WasteAction) => {
    const daysLeft = getDaysUntilExpiration(item.expirationDate);
    if (action === 'eaten') {
      posthog.capture('pantry_item_eaten', { days_until_expiry: daysLeft, category: item.category });
    } else if (action === 'tossed') {
      posthog.capture('pantry_item_wasted', { days_past_expiry: -daysLeft, category: item.category, estimated_value: item.estimatedValue });
    }
    addWasteLog({
      id: createWasteLogId(),
      itemName: item.name,
      category: item.category,
      action,
      date: formatLocalDate(new Date()),
      estimatedValue: item.estimatedValue,
      quantity: item.quantity,
    });
    removePantryItem(item.id);
    setSwipingItem(null);
  };

  const handleFreezeItem = (item: PantryItem) => {
    const freezerDays = lookupShelfLife(item.name, 'freezer') ?? FREEZER_FALLBACK_DAYS[item.category];
    updatePantryItem(item.id, {
      location: 'freezer',
      expirationDate: dateDaysFromToday(freezerDays),
      frozen: true,
    });
    setSwipingItem(null);
    setListAnimKey(k => k + 1);
  };

  // "Extend" — the item's still good (e.g. opened and fine, or you just don't
  // trust the printed date), so push its expiry out. Bumps from the later of
  // today or the current date so an already-expired item moves genuinely
  // forward. updatePantryItem reschedules this item's reminders automatically.
  const EXTEND_DAYS = 3;
  const handleExtendItem = (item: PantryItem) => {
    const current = parseLocalDate(item.expirationDate);
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const base = current.getTime() > todayMidnight.getTime() ? current : todayMidnight;
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + EXTEND_DAYS);
    updatePantryItem(item.id, { expirationDate: formatLocalDate(next) });
    posthog.capture('pantry_item_extended', { days: EXTEND_DAYS, category: item.category });
    hapticLight();
    setSwipingItem(null);
    setListAnimKey(k => k + 1);
  };

  const openRecipesFor = (item: PantryItem) => {
    setRecipeSearchSeed(item.name);
    setActiveTab('plan');
  };

  const handleDismissAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAlertDismissing(true);
    setTimeout(() => setAlertDismissed(true), 290);
  };

  const handleLocationChange = (loc: StorageLocation | 'all') => {
    setActiveLocation(loc);
    setListAnimKey(k => k + 1);
  };

  const handleSortChange = (sort: 'expiration' | 'name' | 'category') => {
    setSortBy(sort);
    setListAnimKey(k => k + 1);
  };

  const toggleFilters = () => {
    if (!filtersOpen) setFilterBubbleKey(k => k + 1);
    setFiltersOpen(f => !f);
  };

  const toggleSort = () => {
    if (!sortOpen) setSortBubbleKey(k => k + 1);
    setSortOpen(s => !s);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const raw = (user?.name || 'there').split(' ')[0];
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  const activeLocationLabel =
    activeLocation === 'all'
      ? `All (${pantryItems.length})`
      : LOCATION_LABELS[activeLocation];

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
          aria-label="Settings"
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

      {/* FDA Recall Alert Banner */}
      {recallMatches.length > 0 && !recallDismissed && (
        <div style={{
          background: 'rgba(205,92,92,0.08)',
          border: '1.5px solid rgba(205,92,92,0.3)',
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          animation: 'card-enter 0.3s ease-out',
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>🚨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--expired)', marginBottom: '4px' }}>
              FDA Recall Alert
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {recallMatches.length === 1
                ? <><strong>{recallMatches[0]!.matchedItem}</strong>{` may be affected by an active recall: ${recallMatches[0]!.reason.slice(0, 80)}…`}</>
                : `${recallMatches.length} items in your pantry may be affected by active FDA recalls.`
              }
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {recallMatches.slice(0, 3).map(m => (
                <span key={m.id} style={{
                  fontSize: '10px', fontWeight: 600,
                  padding: '2px 8px', borderRadius: '8px',
                  background: 'rgba(205,92,92,0.12)',
                  color: 'var(--expired)',
                }}>{m.matchedItem}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setRecallDismissed(true)}
            aria-label="Dismiss recall alert"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '16px', flexShrink: 0,
              padding: '2px', lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}

      {/* Stats row — tappable as filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <Card className="card-enter stagger-1" onClick={() => { setExpiringOnly(false); setSearchQuery(''); setListAnimKey(k => k + 1); }} style={{ padding: '14px', textAlign: 'center', cursor: 'pointer', outline: (!expiringOnly && !searchQuery) ? '2px solid var(--accent)' : 'none', outlineOffset: '-2px' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--accent)' }}>{pantryItems.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Items</div>
        </Card>
        <Card className="card-enter stagger-1" onClick={() => { setExpiringOnly(e => !e); setListAnimKey(k => k + 1); }} style={{ padding: '14px', textAlign: 'center', cursor: 'pointer', outline: expiringOnly ? '2px solid var(--expiring)' : 'none', outlineOffset: '-2px' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: expiringCount > 0 ? 'var(--expiring)' : 'var(--accent)' }}>{expiringCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Expiring</div>
        </Card>
        <Card className="card-enter stagger-1" style={{ padding: '14px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>${totalValue.toFixed(0)}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Value</div>
        </Card>
      </div>

      {/* Use it tonight */}
      {urgentItems.length > 0 && (
        <Card className="card-enter stagger-2" style={{
          padding: '16px',
          border: '1px solid rgba(212, 134, 11, 0.25)',
          background: 'rgba(212, 134, 11, 0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>Use It Tonight</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Avo picked the food most worth rescuing now.
              </div>
            </div>
            <button
              onClick={() => { setExpiringOnly(true); setListAnimKey(k => k + 1); }}
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(212,134,11,0.28)',
                background: 'var(--bg-card)',
                color: 'var(--expiring-soon)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Cormorant Garamond', serif",
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Show all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {urgentItems.map((item, index) => {
              const days = getDaysUntilExpiration(item.expirationDate);
              const color = getFreshnessColor(getFreshnessStatus(item.expirationDate));
              return (
                <div
                  key={item.id}
                  className={`use-tonight-row use-tonight-row-${index + 1}`}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '13px',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(74,124,89,0.10)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FoodCategoryIcon category={item.category} size={18} />
                      <span style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    <div style={{ fontSize: '11px', color, marginTop: '4px', fontWeight: 700 }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openRecipesFor(item)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: "'Cormorant Garamond', serif",
                        cursor: 'pointer',
                      }}
                    >
                      Cook
                    </button>
                    {item.location !== 'freezer' && (
                      <button
                        onClick={() => handleFreezeItem(item)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '10px',
                          border: '1px solid var(--accent)',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: "'Cormorant Garamond', serif",
                          cursor: 'pointer',
                        }}
                      >
                        Freeze
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Search bar */}
      <div className="card-enter stagger-2" style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <circle cx="10" cy="10" r="7" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search pantry..."
          style={{
            width: '100%', padding: '10px 14px 10px 36px',
            borderRadius: '12px', border: '1px solid var(--input-border)',
            background: 'var(--input-bg)', color: 'var(--text-primary)',
            fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <button aria-label="Clear search" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Filter + Sort row — pills fly out as bubbles when tapped */}
      <div className="card-enter stagger-2" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Location filter trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={toggleFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              borderRadius: '20px',
              border: '1.5px solid var(--accent)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              fontSize: '12px', fontWeight: 700,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeLocation !== 'all' && (
              <StorageLocationIcon location={activeLocation} size={14} color="var(--accent)" />
            )}
            {activeLocationLabel}
            <span style={{
              fontSize: '9px',
              transition: 'transform 0.2s ease',
              transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>▼</span>
          </button>

          {/* Bubble pills */}
          {filtersOpen && (
            <div key={filterBubbleKey} style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              {(['all', ...LOCATIONS] as (StorageLocation | 'all')[]).map((loc, idx) => {
                const count = loc === 'all' ? pantryItems.length : pantryItems.filter(i => i.location === loc).length;
                const isActive = activeLocation === loc;
                return (
                  <button
                    key={loc}
                    className={`slip-out-pill slip-out-pill-${idx + 1}`}
                    onClick={() => handleLocationChange(loc)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '20px',
                      border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                      background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      fontSize: '12px', fontWeight: 600,
                      fontFamily: "'Cormorant Garamond', serif",
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(74,124,89,0.12)',
                    }}
                  >
                    {loc === 'all' ? (
                      `All (${count})`
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <StorageLocationIcon location={loc} size={13} color={isActive ? '#fff' : 'var(--text-muted)'} />
                        {LOCATION_LABELS[loc]} ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sort trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={toggleSort}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '8px 14px',
              borderRadius: '20px',
              border: '1px solid var(--tab-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '12px', fontWeight: 600,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '12px' }}>↕</span>
            Sort: <span style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{sortBy}</span>
            <span style={{
              fontSize: '9px',
              transition: 'transform 0.2s ease',
              transform: sortOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>▼</span>
          </button>

          {/* Sort bubble pills */}
          {sortOpen && (
            <div key={sortBubbleKey} style={{ display: 'flex', gap: '7px' }}>
              {(['expiration', 'name', 'category'] as const).map((s, idx) => (
                <button
                  key={s}
                  className={`slip-out-pill slip-out-pill-${idx + 1}`}
                  onClick={() => handleSortChange(s)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '20px',
                    border: sortBy === s ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                    background: sortBy === s ? 'var(--accent)' : 'var(--bg-card)',
                    color: sortBy === s ? '#fff' : 'var(--text-muted)',
                    fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'Cormorant Garamond', serif",
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(74,124,89,0.1)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expiring soon alert — slides up cleanly when dismissed */}
      {expiringCount > 0 && !alertDismissed && (
        <Card
          className={alertDismissing ? 'slide-up-fade' : 'card-enter stagger-3'}
          style={{
            padding: '12px 16px',
            border: '1px solid rgba(212, 134, 11, 0.25)',
            background: 'rgba(212, 134, 11, 0.04)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '24px' }}>
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
          <button
            onClick={handleDismissAlert}
            style={{
              position: 'absolute', top: 8, right: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '16px', padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </Card>
      )}

      {/* Item grid — re-mounts when sort/filter changes so items animate upward */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div key={listAnimKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredItems.map((item, i) => {
          const status = getFreshnessStatus(item.expirationDate);
          const color = getFreshnessColor(status);
          const days = getDaysUntilExpiration(item.expirationDate);
          const isSwipe = swipingItem === item.id;

          return (
            <div
              key={item.id}
              className={`card-enter stagger-${Math.min(i + 1, 6)}`}
              style={{ position: 'relative', overflow: 'hidden', borderRadius: '14px' }}
            >
              {isSwipe && (
                <div className="card-enter" style={{
                  position: 'absolute', inset: 0, display: 'flex', gap: '6px',
                  padding: '8px', zIndex: 2, background: 'var(--bg-card)',
                  borderRadius: '14px', border: 'var(--card-border)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
	                  {([
	                    { action: 'eaten' as WasteAction, label: 'Eaten', color: 'var(--fresh)', svgPath: <><circle cx="12" cy="12" r="8"/><path d="M8.5 12L11 14.5L15.5 9.5"/></> },
	                    { action: 'tossed' as WasteAction, label: 'Tossed', color: 'var(--expired)', svgPath: <><path d="M3 6H21M8 6L9 3H15L16 6"/><path d="M5 6L6 21H18L19 6"/><line x1="10" y1="10" x2="10" y2="17"/><line x1="14" y1="10" x2="14" y2="17"/></> },
	                    { action: 'composted' as WasteAction, label: 'Compost', color: 'var(--good)', svgPath: <><path d="M12 20V12"/><path d="M12 16C10 13.5 6.5 13 5.5 10.5C7.5 8 11 9.5 12 12"/><path d="M12 13C14 10.5 17.5 10 18.5 8C16.5 5 13 7 12 11"/><path d="M9 20Q12 18 15 20"/></> },
	                    { action: 'shared' as WasteAction, label: 'Shared', color: 'var(--accent)', svgPath: <><circle cx="9" cy="7" r="3"/><circle cx="15" cy="7" r="3"/><path d="M3 19C3 16.2 5.7 14 9 14"/><path d="M21 19C21 16.2 18.3 14 15 14"/><path d="M9 14C9 14 12 16 15 14"/></> },
	                    { action: 'donated' as WasteAction, label: 'Donate', color: '#9B7FD4', svgPath: <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></> },
	                  ] as { action: WasteAction; label: string; color: string; svgPath: React.ReactNode }[]).map(a => (
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{a.svgPath}</svg>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: a.color, fontFamily: "'Cormorant Garamond', serif" }}>{a.label}</span>
	                    </button>
	                  ))}
                  {item.location !== 'freezer' && (
                    <button
                      onClick={() => handleFreezeItem(item)}
                      style={{
                        flex: 1, padding: '10px 4px', background: 'transparent',
                        border: '1px solid var(--accent)',
                        borderRadius: '10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2V22M4.5 5.5L19.5 18.5M19.5 5.5L4.5 18.5" />
                        <path d="M8 2L12 6L16 2M8 22L12 18L16 22M2 8L6 12L2 16M22 8L18 12L22 16" />
                      </svg>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', fontFamily: "'Cormorant Garamond', serif" }}>Freeze</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleExtendItem(item)}
                    aria-label={`Extend ${item.name} by ${EXTEND_DAYS} days`}
                    style={{
                      flex: 1, padding: '10px 4px', background: 'transparent',
                      border: '1px solid var(--fresh)',
                      borderRadius: '10px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--fresh)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="8" />
                      <path d="M12 9v4l2.5 2.5" />
                      <path d="M12 2v3M9 2h6" />
                    </svg>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--fresh)', fontFamily: "'Cormorant Garamond', serif" }}>+{EXTEND_DAYS}d</span>
                  </button>
	                  <button
                    onClick={() => { setEditingItem(item); setSwipingItem(null); }}
                    style={{
                      flex: 1, padding: '10px 4px', background: 'transparent',
                      border: '1px solid var(--text-muted)',
                      borderRadius: '10px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Cormorant Garamond', serif" }}>Edit</span>
                  </button>
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
                  flexShrink: 0,
                }}>
                  <FoodCategoryIcon category={item.category} size={22} />
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
                    <StorageLocationIcon location={item.location} size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      · {dateTypeShortLabel(resolveDateType(item))}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: '13px', fontWeight: 600, color, lineHeight: 1.2 }}>
                    {days < 0 ? `${Math.abs(days)}d ago` :
                     days === 0 ? 'Today!' :
                     days === 1 ? '1 day' :
                     `${days} days`}
                  </div>
                  <div style={{
                    fontSize: '9px', textTransform: 'uppercase',
                    fontWeight: 700, letterSpacing: '0.05em', color, marginTop: '2px',
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
        <Card className="card-enter stagger-3" style={{
          textAlign: 'center',
          padding: '36px 20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <EmptyPantryIllustration />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Your {activeLocation === 'all' ? 'pantry' : activeLocation} is empty</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tap the + tab to add items!</div>
        </Card>
      )}

      </div>
      <div style={{ height: '20px' }} />

      {/* Edit modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={(updates) => { updatePantryItem(editingItem.id, updates); setEditingItem(null); }}
          onClose={() => setEditingItem(null)}
        />
      )}
      <style>{`
        @keyframes useTonightPulse {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.04); }
        }
        @keyframes useTonightSlide {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .use-tonight-pulse {
          animation: useTonightPulse 2.8s ease-in-out infinite;
        }
        .use-tonight-row {
          animation: useTonightSlide 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .use-tonight-row-1 { animation-delay: 40ms; }
        .use-tonight-row-2 { animation-delay: 110ms; }
        .use-tonight-row-3 { animation-delay: 180ms; }
      `}</style>
    </div>
  );
}

function EditItemModal({ item, onSave, onClose }: {
  item: PantryItem;
  onSave: (updates: Partial<PantryItem>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [expDate, setExpDate] = useState(item.expirationDate);
  const [value, setValue] = useState(String(item.estimatedValue));
  const [location, setLocation] = useState<StorageLocation>(item.location);
  const [dateType, setDateType] = useState<DateLabelType>(resolveDateType(item));

  const LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];
  const LOCATION_LABELS: Record<StorageLocation, string> = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry', counter: 'Counter' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>Edit Item</div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px' }}>✕</button>
        </div>

        {[
          { label: 'Name', el: <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /> },
          { label: 'Quantity', el: (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setQuantity(q => String(Math.max(1, (parseFloat(q) || 0) - 1)))} style={qBtnStyle}>−</button>
              <input value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inputStyle, textAlign: 'center', width: '60px' }} />
              <button onClick={() => setQuantity(q => String((parseFloat(q) || 0) + 1))} style={qBtnStyle}>+</button>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="unit" style={{ ...inputStyle, width: '70px' }} />
            </div>
          )},
          { label: 'Expires', el: <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={inputStyle} /> },
          { label: 'Price ($)', el: <input value={value} onChange={e => setValue(e.target.value)} style={inputStyle} /> },
        ].map(({ label, el }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</div>
            {el}
          </div>
        ))}

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Date Label</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { type: 'best-by' as DateLabelType, label: 'Best if used by' },
              { type: 'use-by' as DateLabelType, label: 'Use by' },
            ]).map(opt => (
              <button key={opt.type} onClick={() => setDateType(opt.type)} aria-pressed={dateType === opt.type} style={{
                flex: 1, padding: '8px 6px', borderRadius: '10px',
                border: dateType === opt.type ? '1.5px solid var(--accent)' : '1px solid var(--input-border)',
                background: dateType === opt.type ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px', fontWeight: 700,
                color: dateType === opt.type ? 'var(--accent)' : 'var(--text-primary)',
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Location</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {LOCATIONS.map(loc => (
              <button key={loc} onClick={() => setLocation(loc)} style={{
                flex: 1, padding: '8px 4px', borderRadius: '10px',
                border: location === loc ? '1.5px solid var(--accent)' : '1px solid var(--input-border)',
                background: location === loc ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              }}>
                <StorageLocationIcon location={loc} size={16} color={location === loc ? 'var(--accent)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: location === loc ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Cormorant Garamond', serif" }}>{LOCATION_LABELS[loc]}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onSave({ name: name.trim(), quantity: parseFloat(quantity) || 1, unit, expirationDate: expDate, estimatedValue: parseFloat(value) || item.estimatedValue, location, dateType })}
          style={{
            width: '100%', padding: '14px', background: 'var(--accent)', border: 'none',
            borderRadius: '12px', color: '#fff', fontFamily: "'Cormorant Garamond', serif",
            fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '4px',
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  borderRadius: '10px', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)',
  fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

const qBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '10px', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)', cursor: 'pointer',
  fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
