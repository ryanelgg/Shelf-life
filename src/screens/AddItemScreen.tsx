import { useState, useRef, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
import posthog from 'posthog-js';
import { searchFoods, preloadCoreDatabase, preloadFullDatabase } from '../data/foodDatabase';
import { lookupShelfLife } from '../data/shelfLife';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { DEFAULT_SHELF_LIFE, formatLocalDate, FREE_LIMITS, getDefaultDateType } from '../types';
import { FoodCategoryIcon } from '../components/FoodCategoryIcon';
import { StorageLocationIcon } from '../components/StorageLocationIcon';
import { UpgradeModal } from '../components/UpgradeModal';
import { AvoConsentModal } from '../components/AvoConsentModal';
import * as debug from '../lib/debug';
import { hapticMedium, hapticLight } from '../lib/haptics';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { scanReceipt } from '../lib/receiptApi';
import { scanFridge } from '../lib/fridgeApi';
import type { FoodCategory, StorageLocation } from '../types';

type AddMode = 'manual' | 'scan' | 'receipt' | 'fridge';
type ReceiptListItem = {
  id: string;
  name: string;
  price: number;
  category: FoodCategory;
  location: StorageLocation;
  quantity: string;
  unit: string;
  days: string;
};

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

function generateItemId(): string {
  // A launch-scoped counter reset to 0 on every app start, so two phones in a
  // shared household adding in the same millisecond could collide and overwrite
  // each other over live sync. Use a globally-unique id instead.
  return `p-${crypto.randomUUID()}`;
}

let nextReceiptRowId = 0;
function generateReceiptRowId(): string {
  return `receipt-${++nextReceiptRowId}-${Date.now().toString(36)}`;
}

function createReceiptListItem(item: { name: string; price: number }): ReceiptListItem {
  const resolved = resolveReceiptItem(item.name);
  const shelfDays = lookupShelfLife(item.name, resolved.location) ?? DEFAULT_SHELF_LIFE[resolved.category];
  return {
    id: generateReceiptRowId(),
    name: item.name,
    price: item.price,
    category: resolved.category,
    location: resolved.location,
    quantity: '1',
    unit: 'pcs',
    days: String(shelfDays),
  };
}

// Fridge-scan rows have a count instead of a price; default the value to the
// same estimate the manual form uses so the Impact stats aren't zeroed out.
function createFridgeListItem(item: { name: string; quantity?: number }): ReceiptListItem {
  const resolved = resolveReceiptItem(item.name);
  const shelfDays = lookupShelfLife(item.name, resolved.location) ?? DEFAULT_SHELF_LIFE[resolved.category];
  const qty = Number.isFinite(item.quantity) && (item.quantity as number) > 0 ? Math.round(item.quantity as number) : 1;
  return {
    id: generateReceiptRowId(),
    name: item.name,
    price: 2.99,
    category: resolved.category,
    location: resolved.location,
    quantity: String(qty),
    unit: 'pcs',
    days: String(shelfDays),
  };
}

function isCancelledError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('cancel') || message.includes('dismiss');
  }
  return false;
}

export function AddItemScreen() {
  const { addPantryItem, pantryItems, updatePantryItem, canAddPantryItem, isPro, household, setSubscriptionTier, addItemMode, setAddItemMode, avoAiConsent, setAvoAiConsent } = useStore();
  const [mode, setMode] = useState<AddMode>(addItemMode ?? 'manual');
  // When a scan needs AI consent that hasn't been granted, we stash the action
  // here and pop the consent modal first (matching how chat gates Avo).
  const [aiConsentPending, setAiConsentPending] = useState<(() => void) | null>(null);
  const requireAiConsent = (action: () => void) => {
    if (avoAiConsent === 'granted') { action(); return; }
    setAiConsentPending(() => action);
  };

  useEffect(() => {
    if (addItemMode) setAddItemMode(null);
  }, [addItemMode, setAddItemMode]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptListItem[]>([]);
  // Within the Scan tab: show the barcode/receipt chooser ('menu') or the live
  // barcode scanner ('barcode').
  const [scanChoice, setScanChoice] = useState<'menu' | 'barcode'>('menu');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fridgeInputRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [value, setValue] = useState('');
  const [customDays, setCustomDays] = useState('');
  // null = follow the category's safety-first default; set = user override.
  useEffect(() => {
    void preloadCoreDatabase();
  }, []);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addSourceRef = useRef<'manual' | 'barcode'>('manual');

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

  const handleReceiptTap = () => {
    if (!isPro()) { setShowUpgrade(true); return; }
    requireAiConsent(captureReceipt);
  };

  const captureReceipt = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          // Camera only — no "take photo or choose from library" prompt. A
          // receipt should be snapped in the moment, not uploaded from the roll.
          source: CameraSource.Camera,
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

  const processReceiptImage = async (base64: string) => {
    if (!base64) return;
    setReceiptProcessing(true);
    posthog.capture('receipt_ocr_started');
    try {
      const items = await scanReceipt(base64);
      if (items.length === 0) {
        setReceiptProcessing(false);
        return;
      }
      posthog.capture('receipt_ocr_succeeded', { item_count: items.length });
      // Drop malformed rows (missing/blank/non-string name) so one bad entry
      // from the model can't throw and abort the entire scan.
      const validItems = items.filter(it => it && typeof it.name === 'string' && it.name.trim());
      setReceiptItems(validItems.map(createReceiptListItem));
      setMode('receipt');
    } catch (err) {
      debug.error('Receipt OCR error:', err);
      posthog.capture('receipt_ocr_failed', { reason: err instanceof Error ? err.message : 'unknown' });
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

  // ── "Snap your fridge" (Pro): one photo → AI lists everything to add ─────────
  const handleFridgeTap = () => {
    if (!isPro()) { setShowUpgrade(true); return; }
    requireAiConsent(captureFridge);
  };

  const captureFridge = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          source: CameraSource.Prompt,
          resultType: CameraResultType.Base64,
          quality: 80,
        });
        if (!photo.base64String) return;
        processFridgeImage(photo.base64String);
      } catch (error: unknown) {
        if (!isCancelledError(error)) {
          debug.error('Camera error:', error);
        }
      }
    } else {
      fridgeInputRef.current?.click();
    }
  };

  const processFridgeImage = async (base64: string) => {
    if (!base64) return;
    setReceiptProcessing(true);
    posthog.capture('fridge_scan_started');
    try {
      const items = await scanFridge(base64);
      if (items.length === 0) {
        setReceiptProcessing(false);
        return;
      }
      posthog.capture('fridge_scan_succeeded', { item_count: items.length });
      // Drop malformed rows (missing/blank/non-string name) so one bad entry
      // from the model can't throw and abort the entire scan.
      const validItems = items.filter(it => it && typeof it.name === 'string' && it.name.trim());
      setReceiptItems(validItems.map(createFridgeListItem));
      setMode('fridge');
    } catch (err) {
      debug.error('Fridge scan error:', err);
      posthog.capture('fridge_scan_failed', { reason: err instanceof Error ? err.message : 'unknown' });
    } finally {
      setReceiptProcessing(false);
    }
  };

  const handleFridgeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      processFridgeImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateReceiptItem = (id: string, updates: Partial<ReceiptListItem>) => {
    setReceiptItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addReceiptItemToPantry = (item: ReceiptListItem) => {
    const parsedDays = parseInt(item.days, 10);
    // A negative value is intentional: it marks an item that already expired N
    // days ago (the pantry shows it as "Nd ago"). Only fall back to the category
    // default when the input isn't a valid number.
    const shelfDays = Number.isFinite(parsedDays)
      ? parsedDays
      : DEFAULT_SHELF_LIFE[item.category];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + shelfDays);
    hapticMedium();
    addPantryItem({
      id: generateItemId(),
      name: item.name,
      category: item.category,
      location: item.location,
      quantity: parseFloat(item.quantity) || 1,
      unit: item.unit || 'pcs',
      addedDate: formatLocalDate(new Date()),
      expirationDate: formatLocalDate(expDate),
      estimatedValue: Number.isFinite(item.price) ? item.price : 0,
      dateType: getDefaultDateType(item.category),
    }, 'receipt');
  };

  const addReceiptItem = (item: ReceiptListItem) => {
    if (!canAddPantryItem()) { setShowUpgrade(true); return; }
    addReceiptItemToPantry(item);
    // Filter by row id, not name or object identity — avoids dropping every
    // row when two lines share a product name, and still removes the correct
    // row after edits have replaced the original object reference.
    setReceiptItems(prev => prev.filter(r => r.id !== item.id));
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
    // Guard against malformed input (e.g. '.', '-') which parseInt turns into
    // NaN, producing an Invalid Date and a "NaN-NaN-NaN" expiration string.
    // A negative value is intentional, though: it records an item that already
    // expired N days ago (the pantry shows it as "Nd ago").
    const parsedDays = resolvedDays !== '' ? parseInt(resolvedDays, 10) : NaN;
    const days = Number.isFinite(parsedDays) ? parsedDays : DEFAULT_SHELF_LIFE[cat];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);

    hapticMedium();
    const method = addSourceRef.current;
    addSourceRef.current = 'manual';
    addPantryItem({
      id: generateItemId(),
      name: n,
      category: cat,
      location: loc,
      quantity: parseFloat(quantity) || 1,
      unit: itemUnit || unit,
      addedDate: formatLocalDate(new Date()),
      expirationDate: formatLocalDate(expDate),
      // Respect an explicit $0 (free/giveaway item) instead of forcing $2.99,
      // which would inflate the Impact "money saved" stat. A finite itemVal
      // (incl. 0) from a picked food wins; else a non-empty typed value (incl.
      // 0) wins; else fall back to the default estimate.
      estimatedValue: Number.isFinite(itemVal)
        ? (itemVal as number)
        : (value.trim() !== '' && Number.isFinite(parseFloat(value)) ? parseFloat(value) : 2.99),
      dateType: getDefaultDateType(cat),
    }, method);

    // Reset form
    setName('');
    setQuantity('1');
    setValue('');
    setCustomDays('');
    setSuccessName(n);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  // Add one or more items parsed from a spoken/typed phrase. Each item's
  // category + location come from the food database; expiry uses the spoken
  // date when given, otherwise the smart shelf-life default.
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
            id: 'fridge' as AddMode, label: 'Fridge',
            icon: (c: string) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="5" y1="10" x2="19" y2="10" />
                <line x1="8" y1="5" x2="8" y2="7" /><line x1="8" y1="13" x2="8" y2="16" />
              </svg>
            ),
          },
        ]).map(m => (
          <button
            key={m.id}
            className="btn-toggle"
            onClick={() => { setMode(m.id); if (m.id === 'scan') setScanChoice('menu'); }}
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

      {mode === 'scan' && scanChoice === 'menu' && !receiptProcessing && (
        <Card className="card-enter stagger-3" style={{ padding: '10px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReceiptFile}
            style={{ display: 'none' }}
          />
          {([
            {
              key: 'barcode',
              title: 'Scan a barcode',
              subtitle: 'Point your camera at a product barcode',
              pro: false,
              onClick: () => setScanChoice('barcode'),
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 5V2h3M20 2h3v3M1 19v3h3M20 22h3v-3" />
                  <line x1="7" y1="7" x2="7" y2="17" /><line x1="10" y1="7" x2="10" y2="17" />
                  <line x1="13" y1="7" x2="14.5" y2="17" /><line x1="17" y1="7" x2="17" y2="17" />
                </svg>
              ),
            },
            {
              key: 'receipt',
              title: 'Scan a receipt',
              subtitle: 'Snap a grocery receipt to add everything at once',
              pro: !isPro(),
              onClick: handleReceiptTap,
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 2V22L7 20L10 22L12 20L14 22L17 20L20 22V2H4Z" />
                  <line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="14" x2="13" y2="14" />
                </svg>
              ),
            },
          ]).map((opt, i) => (
            <button
              key={opt.key}
              onClick={opt.onClick}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 12px',
                background: 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--tab-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: '44px', height: '44px', flexShrink: 0,
                borderRadius: '12px', background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {opt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{opt.title}</span>
                  {opt.pro && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #D4A44A, #B8862D)', color: '#fff',
                      fontSize: '9px', fontWeight: 700,
                    }}>PRO</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>{opt.subtitle}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </Card>
      )}

      {mode === 'scan' && scanChoice === 'barcode' && (
        <BarcodeScanner
          onClose={() => setScanChoice('menu')}
          onScan={(product) => {
            addSourceRef.current = 'barcode';
            setName(product.brand ? `${product.brand} ${product.name}` : product.name);
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

      {mode === 'fridge' && !receiptProcessing && receiptItems.length === 0 && (
        <Card className="card-enter stagger-3" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="5" y1="10" x2="19" y2="10" />
              <line x1="8" y1="5" x2="8" y2="7" /><line x1="8" y1="13" x2="8" y2="16" />
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
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Snap Your Fridge</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
            Take one photo of your open fridge, freezer, or shelf and Avo will list everything to add — review and tap to fill your pantry.
          </div>
          <input
            ref={fridgeInputRef}
            type="file"
            accept="image/*"
            onChange={handleFridgeFile}
            style={{ display: 'none' }}
          />
          <button
            className="btn-solid"
            onClick={handleFridgeTap}
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
            {isPro() ? 'Snap Fridge' : 'Unlock with Pro'}
          </button>
        </Card>
      )}

      {/* Receipt / fridge processing spinner */}
      {receiptProcessing && (
        <Card className="card-enter" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="avo-drift" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <AvocadoMascot size={50} isStatic />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
            {mode === 'fridge' ? 'Scanning your fridge...' : 'Scanning your receipt...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {mode === 'fridge' ? 'Spotting everything Avo can see' : 'Identifying items and prices'}
          </div>
        </Card>
      )}

      {/* Receipt / fridge results — shared review list */}
      {(mode === 'receipt' || mode === 'fridge') && receiptItems.length > 0 && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              {receiptItems.length} items found
            </div>
            <button
              onClick={() => {
                // Pro users AND free members riding a Pro owner's household get
                // an unlimited pantry (same rule as single-add's canAddPantryItem);
                // only a free solo/owner user is capped. Households max out at 4.
                const hasUnlimited = isPro() || household?.role === 'member';
                const slotsLeft = hasUnlimited
                  ? receiptItems.length
                  : Math.max(0, FREE_LIMITS.pantryItems - pantryItems.length);
                const toAdd = receiptItems.slice(0, slotsLeft);
                if (toAdd.length === 0) {
                  setShowUpgrade(true);
                  return;
                }
                toAdd.forEach(addReceiptItemToPantry);
                const remaining = receiptItems.slice(toAdd.length);
                setReceiptItems(remaining);
                if (toAdd.length > 0) {
                  setSuccessName(`${toAdd.length} receipt item${toAdd.length === 1 ? '' : 's'}`);
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 2000);
                }
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
              Add all reviewed
            </button>
          </div>
          {receiptItems.map(item => (
            <Card key={item.id} className="receipt-review-card" style={{ padding: '13px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                      {mode === 'fridge' ? 'Fridge item' : 'Receipt item'}
                    </div>
                    <input
                      value={item.name}
                      onChange={e => updateReceiptItem(item.id, { name: e.target.value })}
                      onBlur={() => {
                        if (!item.name.trim()) return;
                        const resolved = resolveReceiptItem(item.name);
                        const shelfDays = lookupShelfLife(item.name, resolved.location) ?? DEFAULT_SHELF_LIFE[resolved.category];
                        updateReceiptItem(item.id, { category: resolved.category, location: resolved.location, days: String(shelfDays) });
                      }}
                      style={{
                        width: '100%',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        borderRadius: '10px',
                        padding: '9px 11px',
                        color: 'var(--text-primary)',
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '13px',
                        fontWeight: 700,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setReceiptItems(prev => prev.filter(row => row.id !== item.id))}
                    style={{
                      marginTop: '21px',
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      border: '1px solid var(--tab-border)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '15px',
                    }}
                  >
                    x
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={item.category}
                    onChange={e => {
                      const nextCategory = e.target.value as FoodCategory;
                      const shelfDays = lookupShelfLife(item.name, item.location) ?? DEFAULT_SHELF_LIFE[nextCategory];
                      updateReceiptItem(item.id, { category: nextCategory, days: String(shelfDays) });
                    }}
                    style={receiptInputStyle}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <select
                    value={item.location}
                    onChange={e => {
                      const nextLocation = e.target.value as StorageLocation;
                      const shelfDays = lookupShelfLife(item.name, nextLocation) ?? DEFAULT_SHELF_LIFE[item.category];
                      updateReceiptItem(item.id, { location: nextLocation, days: String(shelfDays) });
                    }}
                    style={receiptInputStyle}
                  >
                    {LOCATIONS.map(loc => <option key={loc.id} value={loc.id}>{loc.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.9fr 0.8fr 0.9fr', gap: '7px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateReceiptItem(item.id, { quantity: e.target.value })}
                    aria-label={`${item.name} quantity`}
                    style={{ ...receiptInputStyle, fontFamily: 'DM Mono, monospace' }}
                  />
                  <select
                    value={item.unit}
                    onChange={e => updateReceiptItem(item.id, { unit: e.target.value })}
                    aria-label={`${item.name} unit`}
                    style={receiptInputStyle}
                  >
                    {['pcs', 'lbs', 'oz', 'kg', 'g', 'gal', 'L', 'cup', 'bag', 'box', 'can', 'bottle', 'bunch', 'head', 'loaf', 'dozen', 'tub', 'block', 'pack'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.days}
                    onChange={e => updateReceiptItem(item.id, { days: e.target.value })}
                    aria-label={`${item.name} expiration days`}
                    style={{ ...receiptInputStyle, fontFamily: 'DM Mono, monospace' }}
                  />
                  <input
                    type="number"
                    value={Number.isFinite(item.price) ? item.price : 0}
                    onChange={e => updateReceiptItem(item.id, { price: Number(e.target.value) })}
                    aria-label={`${item.name} price`}
                    style={{ ...receiptInputStyle, fontFamily: 'DM Mono, monospace' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.9fr 0.8fr 0.9fr', gap: '7px', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Days</span>
                  <span>Price</span>
                </div>
                <button
                  onClick={() => addReceiptItem(item)}
                  disabled={!item.name.trim()}
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--accent)',
                    background: item.name.trim() ? 'var(--accent-dim)' : 'transparent',
                    color: item.name.trim() ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '12px', fontWeight: 800, cursor: item.name.trim() ? 'pointer' : 'not-allowed',
                    width: '100%',
                  }}
                >
                  Add reviewed item
                </button>
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
          feature={mode === 'receipt' ? 'receipt' : mode === 'fridge' ? 'fridge' : 'pantry'}
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => { setSubscriptionTier('pro'); setShowUpgrade(false); }}
        />
      )}

      {aiConsentPending && (
        <AvoConsentModal
          onAccept={() => {
            setAvoAiConsent('granted');
            const run = aiConsentPending;
            setAiConsentPending(null);
            run?.();
          }}
          onDecline={() => {
            setAvoAiConsent('declined');
            setAiConsentPending(null);
          }}
        />
      )}

    </div>
  );
}

const receiptInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: '9px',
  padding: '8px 9px',
  color: 'var(--text-primary)',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box',
};
