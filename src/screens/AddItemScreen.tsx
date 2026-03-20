import { useState } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { DEFAULT_SHELF_LIFE } from '../types';
import { FoodCategoryIcon } from '../components/FoodCategoryIcon';
import { StorageLocationIcon } from '../components/StorageLocationIcon';
import type { FoodCategory, StorageLocation } from '../types';

type AddMode = 'manual' | 'scan' | 'receipt';

const CATEGORIES: FoodCategory[] = [
  'Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen',
  'Canned', 'Snacks', 'Beverages', 'Condiments', 'Bakery', 'Deli', 'Other',
];

const LOCATIONS: { id: StorageLocation; label: string }[] = [
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'counter', label: 'Counter' },
];

const QUICK_ITEMS = [
  { name: 'Milk', category: 'Dairy' as FoodCategory, location: 'fridge' as StorageLocation, value: 4.29, unit: 'gal' },
  { name: 'Eggs', category: 'Dairy' as FoodCategory, location: 'fridge' as StorageLocation, value: 3.99, unit: 'dozen' },
  { name: 'Bread', category: 'Bakery' as FoodCategory, location: 'counter' as StorageLocation, value: 4.49, unit: 'loaf' },
  { name: 'Bananas', category: 'Produce' as FoodCategory, location: 'counter' as StorageLocation, value: 1.50, unit: 'bunch' },
  { name: 'Chicken', category: 'Meat' as FoodCategory, location: 'fridge' as StorageLocation, value: 8.99, unit: 'lbs' },
  { name: 'Rice', category: 'Grains' as FoodCategory, location: 'pantry' as StorageLocation, value: 3.49, unit: 'bag' },
  { name: 'Yogurt', category: 'Dairy' as FoodCategory, location: 'fridge' as StorageLocation, value: 5.49, unit: 'tub' },
  { name: 'Apples', category: 'Produce' as FoodCategory, location: 'fridge' as StorageLocation, value: 4.99, unit: 'bag' },
  { name: 'Pasta', category: 'Grains' as FoodCategory, location: 'pantry' as StorageLocation, value: 1.49, unit: 'box' },
  { name: 'Cheese', category: 'Dairy' as FoodCategory, location: 'fridge' as StorageLocation, value: 4.99, unit: 'block' },
  { name: 'Salmon', category: 'Seafood' as FoodCategory, location: 'fridge' as StorageLocation, value: 12.99, unit: 'lb' },
  { name: 'Lettuce', category: 'Produce' as FoodCategory, location: 'fridge' as StorageLocation, value: 2.99, unit: 'head' },
];

export function AddItemScreen() {
  const { addPantryItem, setActiveTab } = useStore();
  const [mode, setMode] = useState<AddMode>('manual');

  // Manual form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [value, setValue] = useState('');
  const [customDays, setCustomDays] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');

  const handleAddItem = (itemName?: string, itemCat?: FoodCategory, itemLoc?: StorageLocation, itemVal?: number, itemUnit?: string) => {
    const n = itemName || name.trim();
    if (!n) return;

    const cat = itemCat || category;
    const loc = itemLoc || location;
    const days = customDays ? parseInt(customDays) : DEFAULT_SHELF_LIFE[cat];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);

    addPantryItem({
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: n,
      category: cat,
      location: loc,
      quantity: parseFloat(quantity) || 1,
      unit: itemUnit || unit,
      addedDate: new Date().toISOString().split('T')[0],
      expirationDate: expDate.toISOString().split('T')[0],
      estimatedValue: itemVal || parseFloat(value) || 2.99,
    });

    // Reset form
    setName('');
    setQuantity('1');
    setValue('');
    setCustomDays('');
    setSuccessName(n);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

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
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Add Items</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Stock your pantry</p>
        </div>
      </div>

      {/* Success toast */}
      {showSuccess && (
        <div className="card-enter" style={{
          padding: '12px 16px',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent)',
        }}>
          <span>✅</span> Added {successName} to your pantry!
        </div>
      )}

      {/* Mode selector */}
      <div className="card-enter stagger-1" style={{ display: 'flex', gap: '8px' }}>
        {([
          {
            id: 'manual' as AddMode, label: 'Manual',
            icon: (c: string) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3L21 7L7 21H3V17L17 3Z" /><line x1="15" y1="5" x2="19" y2="9" />
              </svg>
            ),
          },
          {
            id: 'scan' as AddMode, label: 'Scan',
            icon: (c: string) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5V2h3M20 2h3v3M1 19v3h3M20 22h3v-3" />
                <line x1="7" y1="7" x2="7" y2="17" /><line x1="10" y1="7" x2="10" y2="17" />
                <line x1="13" y1="7" x2="14.5" y2="17" /><line x1="17" y1="7" x2="17" y2="17" />
              </svg>
            ),
          },
          {
            id: 'receipt' as AddMode, label: 'Receipt',
            icon: (c: string) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2V22L7 20L10 22L12 20L14 22L17 20L20 22V2H4Z" />
                <line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="14" x2="13" y2="14" />
              </svg>
            ),
          },
        ]).map(m => (
          <button
            key={m.id}
            className="btn-toggle"
            onClick={() => setMode(m.id)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: mode === m.id ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
              background: mode === m.id ? 'var(--accent-dim)' : 'transparent',
              color: mode === m.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {m.icon(mode === m.id ? 'var(--accent)' : 'var(--text-muted)')}
            {m.label}
          </button>
        ))}
      </div>

      {/* Quick Add */}
      <Card className="card-enter stagger-2">
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Quick Add</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {QUICK_ITEMS.map(item => (
            <button
              key={item.name}
              className="btn-pill"
              onClick={() => handleAddItem(item.name, item.category, item.location, item.value, item.unit)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: '1px solid var(--tab-border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: "'Cormorant Garamond', serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FoodCategoryIcon category={item.category} size={14} /> {item.name}
            </button>
          ))}
        </div>
      </Card>

      {mode === 'manual' && (
        <>
          {/* Name input */}
          <Card className="card-enter stagger-3">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Item Name
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Avocados, Chicken Breast..."
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </Card>

          {/* Category */}
          <Card className="card-enter stagger-4">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className="btn-toggle"
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: category === cat ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                    background: category === cat ? 'var(--accent-dim)' : 'transparent',
                    color: category === cat ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: "'Cormorant Garamond', serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <FoodCategoryIcon category={cat} size={14} /> {cat}
                </button>
              ))}
            </div>
          </Card>

          {/* Location */}
          <Card className="card-enter stagger-5">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Storage Location
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {LOCATIONS.map(loc => (
                <button
                  key={loc.id}
                  className="btn-toggle"
                  onClick={() => setLocation(loc.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: location === loc.id ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                    background: location === loc.id ? 'var(--accent-dim)' : 'transparent',
                    color: location === loc.id ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: "'Cormorant Garamond', serif",
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
                    <StorageLocationIcon location={loc.id} size={22} color={location === loc.id ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>
                  {loc.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Quantity, Unit, Value, Days */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Card className="card-enter stagger-5">
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Quantity
              </div>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
                  fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </Card>
            <Card className="card-enter stagger-5">
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Unit
              </div>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
                  fontFamily: "'Cormorant Garamond', serif", fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                {['pcs', 'lbs', 'oz', 'kg', 'g', 'gal', 'L', 'cup', 'bag', 'box', 'can', 'bottle', 'bunch', 'head', 'loaf', 'dozen', 'tub', 'block', 'pack'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Card className="card-enter stagger-6">
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Est. Value ($)
              </div>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={`~$${(2.99).toFixed(2)}`}
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
                  fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </Card>
            <Card className="card-enter stagger-6">
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Days Until Exp.
              </div>
              <input
                type="number"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                placeholder={`${DEFAULT_SHELF_LIFE[category]}`}
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
                  fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </Card>
          </div>

          {/* Add button */}
          <button
            className="btn-solid card-enter stagger-6"
            onClick={() => handleAddItem()}
            disabled={!name.trim()}
            style={{
              width: '100%',
              padding: '16px',
              background: name.trim() ? 'var(--accent)' : 'var(--accent-dim)',
              border: 'none',
              borderRadius: '14px',
              color: name.trim() ? '#fff' : 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Add to Pantry
          </button>
        </>
      )}

      {mode === 'scan' && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 5V2h3M20 2h3v3M1 19v3h3M20 22h3v-3" />
              <line x1="7" y1="7" x2="7" y2="17" /><line x1="10" y1="7" x2="10" y2="17" />
              <line x1="13" y1="7" x2="14.5" y2="17" /><line x1="17" y1="7" x2="17" y2="17" />
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Barcode Scanner</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
            Point your camera at any barcode for instant product recognition and auto-populated shelf life data.
          </div>
          <div style={{
            width: '200px',
            height: '200px',
            margin: '0 auto 20px',
            borderRadius: '16px',
            border: '2px dashed var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-dim)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <path d="M1 4V1h3M20 1h3v3M1 20v3h3M20 23h3v-3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="5" y="5" width="14" height="14" rx="2" opacity="0.3" />
              </svg>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Ready to scan</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Camera access required. Works with most grocery barcodes.
          </div>
        </Card>
      )}

      {mode === 'receipt' && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2V22L7 20L10 22L12 20L14 22L17 20L20 22V2H4Z" />
              <line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="14" x2="13" y2="14" />
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Receipt Scanner</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
            Take a photo of your grocery receipt and we'll automatically add all items to your pantry with prices.
          </div>
          <button
            className="btn-solid"
            style={{
              padding: '14px 32px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Scan Receipt
          </button>
        </Card>
      )}
    </div>
  );
}
