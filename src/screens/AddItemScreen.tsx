import { useState, useRef, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
import { searchFoods, preloadCoreDatabase, preloadFullDatabase } from '../data/foodDatabase';
import { lookupShelfLife } from '../data/shelfLife';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { DEFAULT_SHELF_LIFE, formatLocalDate, FREE_LIMITS, parseLocalDate } from '../types';
import { FoodCategoryIcon } from '../components/FoodCategoryIcon';
import { StorageLocationIcon } from '../components/StorageLocationIcon';
import { UpgradeModal } from '../components/UpgradeModal';
import * as debug from '../lib/debug';
import { hapticMedium, hapticLight } from '../lib/haptics';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { scanReceipt } from '../lib/receiptApi';
import { scanExpirationDate } from '../lib/dateOcr';
import type { FoodCategory, StorageLocation } from '../types';

type AddMode = 'manual' | 'scan' | 'receipt';
type ReceiptListItem = { id: string; name: string; price: number };

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


function mapCategoryToLocation(category: FoodCategory): string {
  const map: Record<FoodCategory, string> = {
    Produce: 'fridge', Dairy: 'fridge', Meat: 'fridge', Seafood: 'fridge',
    Deli: 'fridge', Condiments: 'fridge',
    Grains: 'pantry', Canned: 'pantry', Snacks: 'pantry', Beverages: 'pantry', Other: 'pantry',
    Frozen: 'freezer',
    Bakery: 'counter',
  };
  return map[category] ?? 'pantry';
}

function resolveReceiptItem(itemName: string): { category: FoodCategory; location: StorageLocation } {
  const results = searchFoods(itemName, 8);
  const normalizedName = itemName.trim().toLowerCase();
  const match = results.find(food => food.name.toLowerCase() === normalizedName) ?? results[0];
  const category = (match?.category as FoodCategory | undefined) ?? 'Other';
  const location = (match?.location as StorageLocation | undefined)
    ?? (mapCategoryToLocation(category) as StorageLocation);

  return { category, location };
}

let nextId = 0;
function generateItemId(): string {
  return `p-${++nextId}-${Date.now().toString(36)}`;
}

let nextReceiptRowId = 0;
function generateReceiptRowId(): string {
  return `receipt-${++nextReceiptRowId}-${Date.now().toString(36)}`;
}

function isCancelledError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('cancel') || message.includes('dismiss');
  }
  return false;
}

export function AddItemScreen() {
  const { addPantryItem, pantryItems, updatePantryItem, canAddPantryItem, isPro, setSubscriptionTier, addItemMode, setAddItemMode } = useStore();
  const [mode, setMode] = useState<AddMode>(addItemMode ?? 'manual');

  useEffect(() => {
    if (addItemMode) setAddItemMode(null);
  }, [addItemMode, setAddItemMode]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptListItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateFileInputRef = useRef<HTMLInputElement>(null);
  const [dateScanning, setDateScanning] = useState(false);
  const [dateScanError, setDateScanError] = useState<string | null>(null);

  // Manual form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [value, setValue] = useState('');
  const [customDays, setCustomDays] = useState('');
  useEffect(() => {
    void preloadCoreDatabase();
  }, []);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Category-based freezer fallback days (used when no specific entry found)
  const CATEGORY_FREEZER_DAYS: Record<FoodCategory, number> = {
    Produce: 365, Dairy: 90, Meat: 120, Seafood: 90,
    Grains: 365, Frozen: 365, Canned: 730, Snacks: 180,
    Beverages: 90, Condiments: 365, Bakery: 90, Deli: 60, Other: 90,
  };

  const foodSuggestions = useMemo(() => {
    if (name.trim().length < 2) return [];
    void preloadFullDatabase();
    return searchFoods(name.trim()).map(f => ({
      name: f.name,
      category: f.category as FoodCategory,
      shelfLifeDays: lookupShelfLife(f.name, f.location) ?? f.shelfLifeDays,
    }));
  }, [name]);

  const getSuggestedShelfLifeDays = (itemName: string, itemLocation: StorageLocation, itemCategory: FoodCategory) => {
    if (!itemName.trim()) return '';
    const normalizedName = itemName.trim();
    const days = lookupShelfLife(normalizedName, itemLocation);
    if (days !== null) {
      return String(days);
    }
    if (itemLocation === 'freezer') {
      return String(CATEGORY_FREEZER_DAYS[itemCategory] ?? 90);
    }
    return '';
  };

  const applySuggestedShelfLifeDays = (itemName: string, itemLocation: StorageLocation, itemCategory: FoodCategory) => {
    setCustomDays(getSuggestedShelfLifeDays(itemName, itemLocation, itemCategory));
  };

  const handleReceiptTap = async () => {
    if (!isPro()) { setShowUpgrade(true); return; }
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          source: CameraSource.Prompt,
          resultType: CameraResultType.Base64,
          quality: 80,
        });
        if (!photo.base64String) return;
        processReceiptImage(photo.base64String);
      } catch (error: unknown) {
        // User cancelled — do nothing
        if (!isCancelledError(error)) {
          debug.error('Camera error:', error);
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleSnapDateTap = async () => {
    if (dateScanning) return;
    setDateScanError(null);
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          source: CameraSource.Prompt,
          resultType: CameraResultType.Base64,
          quality: 80,
        });
        if (!photo.base64String) return;
        void processDateImage(photo.base64String);
      } catch (error: unknown) {
        if (!isCancelledError(error)) {
          debug.error('Date camera error:', error);
          setDateScanError("Couldn't open the camera. Try again?");
        }
      }
    } else {
      dateFileInputRef.current?.click();
    }
  };

  const processDateImage = async (base64: string) => {
    if (!base64) return;
    setDateScanning(true);
    setDateScanError(null);
    try {
      const isoDate = await scanExpirationDate(base64);
      if (!isoDate) {
        setDateScanError("Avo couldn't spot a date. Try a closer shot of the label.");
        return;
      }
      const target = parseLocalDate(isoDate);
      const today = new Date();
      const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const days = Math.round((target.getTime() - now.getTime()) / 86400000);
      // Negative days = already expired. We still fill the field so the user
      // can see what was detected and adjust manually if needed.
      hapticLight();
      setCustomDays(String(days));
    } catch (err) {
      debug.error('Date OCR error:', err);
      setDateScanError(err instanceof Error ? err.message : 'Date scan failed. Try again?');
    } finally {
      setDateScanning(false);
    }
  };

  const handleDateFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1];
        if (base64) void processDateImage(base64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const processReceiptImage = async (base64: string) => {
    if (!base64) return;
    setReceiptProcessing(true);
    try {
      const items = await scanReceipt(base64);
      if (items.length === 0) {
        setReceiptProcessing(false);
        return;
      }
      setReceiptItems(items.map(item => ({ ...item, id: generateReceiptRowId() })));
      setMode('receipt');
    } catch (err) {
      debug.error('Receipt OCR error:', err);
    } finally {
      setReceiptProcessing(false);
    }
  };

  const handleReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      processReceiptImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addReceiptItem = (item: ReceiptListItem) => {
    if (!canAddPantryItem()) { setShowUpgrade(true); return; }
    const resolved = resolveReceiptItem(item.name);
    // Compute shelf life independently — never read customDays/quantity from
    // the manual form (those fields belong to manual-add mode and may hold
    // stale values that would corrupt receipt rows).
    const shelfDays = lookupShelfLife(item.name, resolved.location) ?? DEFAULT_SHELF_LIFE[resolved.category];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + shelfDays);
    hapticMedium();
    addPantryItem({
      id: generateItemId(),
      name: item.name,
      category: resolved.category,
      location: resolved.location,
      quantity: 1,
      unit: 'pcs',
      addedDate: formatLocalDate(new Date()),
      expirationDate: formatLocalDate(expDate),
      estimatedValue: item.price,
    });
    // Filter by object identity, not name — avoids dropping every row when
    // a receipt contains two lines with the same product name.
    setReceiptItems(prev => {
      const idx = prev.indexOf(item);
      return prev.filter((_, i) => i !== idx);
    });
    setSuccessName(item.name);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleAddItem = (itemName?: string, itemCat?: FoodCategory, itemLoc?: StorageLocation, itemVal?: number, itemUnit?: string) => {
    const n = itemName || name.trim();
    if (!n) return;

    if (!canAddPantryItem()) { setShowUpgrade(true); return; }

    const cat = itemCat || category;
    const loc = itemLoc || location;
    // Use !== '' so that '0' (expires today) is respected and not treated as
    // falsy — both the user-entered value and database suggestions can be 0.
    const resolvedDays = customDays !== '' ? customDays : getSuggestedShelfLifeDays(n, loc, cat);
    const days = resolvedDays !== '' ? parseInt(resolvedDays, 10) : DEFAULT_SHELF_LIFE[cat];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);

    hapticMedium();
    addPantryItem({
      id: generateItemId(),
      name: n,
      category: cat,
      location: loc,
      quantity: parseFloat(quantity) || 1,
      unit: itemUnit || unit,
      addedDate: formatLocalDate(new Date()),
      expirationDate: formatLocalDate(expDate),
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
          {QUICK_ITEMS.map(item => {
            const existing = pantryItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
            return (
              <button
                key={item.name}
                className="btn-pill"
                onClick={() => {
                  if (existing) {
                    // Increment existing item quantity
                    updatePantryItem(existing.id, { quantity: existing.quantity + 1 });
                    setSuccessName(`+1 ${item.name}`);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 2000);
                  } else {
                    // Prefill the form so user can review before adding
                    setMode('manual');
                    setName(item.name);
                    setCategory(item.category);
                    setLocation(item.location);
                    setValue(String(item.value));
                    setUnit(item.unit);
                    applySuggestedShelfLifeDays(item.name, item.location, item.category);
                  }
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: existing ? '1px solid var(--accent)' : '1px solid var(--tab-border)',
                  background: existing ? 'var(--accent-dim)' : 'transparent',
                  color: existing ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: "'Cormorant Garamond', serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FoodCategoryIcon category={item.category} size={16} />
                {item.name}
                {existing && <span style={{ fontSize: '10px', opacity: 0.8 }}>×{existing.quantity}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {mode === 'manual' && (
        <>
          {/* Name input */}
          <Card className="card-enter stagger-3" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Item Name
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setCustomDays('');
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  setShowSuggestions(false);
                  if (!customDays) {
                    applySuggestedShelfLifeDays(name, location, category);
                  }
                }}
                onFocus={() => {
                  if (foodSuggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="e.g. Avocados, Chicken Breast..."
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: showSuggestions && foodSuggestions.length > 0 ? '10px 10px 0 0' : '10px',
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {showSuggestions && foodSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--input-border)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  zIndex: 100,
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}>
                  {foodSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => {
                        hapticLight();
                        setName(s.name);
                        setCategory(s.category);
                        const suggestedLocation = location;
                        const days = lookupShelfLife(s.name, suggestedLocation) ?? s.shelfLifeDays;
                        if (days != null) setCustomDays(String(days));
                        setShowSuggestions(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'none',
                        border: 'none',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <FoodCategoryIcon category={s.category} size={14} />
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: "'Cormorant Garamond', serif", flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{s.category}</span>
                    </button>
                  ))}
                  <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    via USDA FoodData Central
                  </div>
                </div>
              )}
            </div>
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
                  onClick={() => {
                    setCategory(cat);
                    if (name.trim() && !showSuggestions) {
                      applySuggestedShelfLifeDays(name, location, cat);
                    }
                  }}
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
                  <FoodCategoryIcon category={cat} size={16} /> {cat}
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
                  onClick={() => {
                    setLocation(loc.id);
                    if (name.trim() && !showSuggestions) {
                      applySuggestedShelfLifeDays(name, loc.id, category);
                    }
                  }}
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                gap: '6px',
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Days Until Exp.
                </span>
                <button
                  onClick={() => { void handleSnapDateTap(); }}
                  disabled={dateScanning}
                  title="Snap the expiration date on the package"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '10px',
                    border: '1px solid var(--accent)',
                    background: dateScanning ? 'var(--accent-dim)' : 'transparent',
                    color: 'var(--accent)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: dateScanning ? 'wait' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  {dateScanning ? 'Reading…' : 'Snap'}
                </button>
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
              {dateScanError && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '10px',
                  color: 'var(--expiring)',
                  lineHeight: 1.4,
                }}>
                  {dateScanError}
                </div>
              )}
              <input
                ref={dateFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDateFileSelected}
                style={{ display: 'none' }}
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
        <BarcodeScanner
          onClose={() => setMode('manual')}
          onScan={(product) => {
            setName(product.name);
            setCategory(product.category);
            const loc = mapCategoryToLocation(product.category) as StorageLocation;
            setLocation(loc);
            const days = lookupShelfLife(product.name, loc);
            if (days !== null) setCustomDays(String(days));
            setMode('manual');
          }}
        />
      )}

      {mode === 'receipt' && !receiptProcessing && receiptItems.length === 0 && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2V22L7 20L10 22L12 20L14 22L17 20L20 22V2H4Z" />
              <line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="14" x2="13" y2="14" />
            </svg>
          </div>
          {!isPro() && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '12px', marginBottom: '10px',
              background: 'linear-gradient(135deg, #D4A44A, #B8862D)', color: '#fff',
              fontSize: '10px', fontWeight: 700,
            }}>
              PRO
            </div>
          )}
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Receipt Scanner</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
            Take a photo of your grocery receipt and we'll automatically add all items to your pantry with prices.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReceiptFile}
            style={{ display: 'none' }}
          />
          <button
            className="btn-solid"
            onClick={handleReceiptTap}
            style={{
              padding: '14px 32px',
              background: isPro() ? 'var(--accent)' : 'linear-gradient(135deg, #D4A44A, #B8862D)',
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
            {isPro() ? 'Scan Receipt' : 'Unlock with Pro'}
          </button>
        </Card>
      )}

      {/* Receipt processing spinner */}
      {receiptProcessing && (
        <Card className="card-enter" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="avo-drift" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <AvocadoMascot size={50} isStatic />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Scanning your receipt...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Identifying items and prices</div>
        </Card>
      )}

      {/* Receipt results */}
      {mode === 'receipt' && receiptItems.length > 0 && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              {receiptItems.length} items found
            </div>
            <button
              onClick={() => {
                const slotsLeft = isPro()
                  ? Infinity
                  : FREE_LIMITS.pantryItems - pantryItems.length;
                const toAdd = receiptItems.slice(0, slotsLeft);
                toAdd.forEach(item => {
                  const resolved = resolveReceiptItem(item.name);
                  handleAddItem(item.name, resolved.category, resolved.location, item.price, 'pcs');
                });
                const remaining = receiptItems.slice(slotsLeft);
                setReceiptItems(remaining);
                if (remaining.length > 0) {
                  setShowUpgrade(true);
                }
              }}
              style={{
                padding: '7px 14px', borderRadius: '10px', border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Add all
            </button>
          </div>
          {receiptItems.map(item => (
            <Card key={item.id} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>${item.price.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => addReceiptItem(item)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--accent)',
                    background: 'var(--accent-dim)', color: 'var(--accent)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pantry limit indicator for free users */}
      {!isPro() && (
        <div style={{
          textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
          padding: '8px 0',
        }}>
          {pantryItems.length}/{FREE_LIMITS.pantryItems} free items used
          {pantryItems.length >= FREE_LIMITS.pantryItems - 3 && pantryItems.length < FREE_LIMITS.pantryItems && (
            <span style={{ color: 'var(--expiring)' }}> — running low!</span>
          )}
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          feature={mode === 'receipt' ? 'receipt' : 'pantry'}
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => { setSubscriptionTier('pro'); setShowUpgrade(false); }}
        />
      )}
    </div>
  );
}
