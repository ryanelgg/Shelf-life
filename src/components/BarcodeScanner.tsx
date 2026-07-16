import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import type { FoodCategory } from '../types';
import { lookupCommunityProduct, submitCommunityProduct } from '../lib/communityProducts';
import { AvocadoMascot } from './AvocadoMascot';

export interface ScannedProduct {
  name: string;
  brand?: string;
  category: FoodCategory;
  estimatedValue?: number;
}

interface Props {
  onScan: (product: ScannedProduct) => void;
  onClose: () => void;
}

const CATEGORIES: FoodCategory[] = [
  'Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen',
  'Canned', 'Snacks', 'Beverages', 'Condiments', 'Bakery', 'Deli', 'Other',
];

// ── Local USDA DB ─────────────────────────────────────────────────────────────
let localDB: Record<string, { n: string; c: FoodCategory }> | null = null;
let localDBPromise: Promise<void> | null = null;

function loadLocalDB() {
  if (localDB !== null) return Promise.resolve();
  if (localDBPromise) return localDBPromise;
  localDBPromise = fetch('/barcodeDB.json')
    .then(r => r.json())
    .then(data => { localDB = data; })
    .catch(() => { localDB = {}; });
  return localDBPromise;
}
loadLocalDB();

function lookupLocalDB(barcode: string): ScannedProduct | null {
  if (!localDB) return null;
  const entry = localDB[barcode] ?? localDB[barcode.replace(/^0+/, '')] ?? null;
  if (!entry) return null;
  return { name: entry.n, category: entry.c };
}

function mapOFFCategory(categories: string): FoodCategory {
  const c = categories.toLowerCase();
  if (c.includes('meat') || c.includes('chicken') || c.includes('beef') || c.includes('pork') || c.includes('turkey')) return 'Meat';
  if (c.includes('seafood') || c.includes('fish') || c.includes('salmon') || c.includes('tuna') || c.includes('shrimp')) return 'Seafood';
  if (c.includes('dairy') || c.includes('milk') || c.includes('cheese') || c.includes('yogurt') || c.includes('cream')) return 'Dairy';
  if (c.includes('produce') || c.includes('fruit') || c.includes('vegetable') || c.includes('fresh')) return 'Produce';
  if (c.includes('bread') || c.includes('bakery') || c.includes('baked') || c.includes('pastry') || c.includes('cake')) return 'Bakery';
  if (c.includes('frozen')) return 'Frozen';
  if (c.includes('canned') || c.includes('tinned')) return 'Canned';
  if (c.includes('beverage') || c.includes('drink') || c.includes('juice') || c.includes('soda') || c.includes('water')) return 'Beverages';
  if (c.includes('snack') || c.includes('chip') || c.includes('cracker') || c.includes('cookie') || c.includes('candy')) return 'Snacks';
  if (c.includes('grain') || c.includes('pasta') || c.includes('rice') || c.includes('cereal') || c.includes('flour')) return 'Grains';
  if (c.includes('sauce') || c.includes('condiment') || c.includes('dressing') || c.includes('spice') || c.includes('oil')) return 'Condiments';
  if (c.includes('deli') || c.includes('lunch') || c.includes('sausage') || c.includes('cold cut')) return 'Deli';
  return 'Other';
}

/**
 * Lookup order:
 * 1. Local USDA DB (instant, no network)
 * 2. Community Supabase DB (user-contributed)
 * 3. Open Food Facts (global fallback, with brand extraction)
 */
async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  await loadLocalDB();

  const local = lookupLocalDB(barcode);
  if (local) return local;

  try {
    const community = await lookupCommunityProduct(barcode);
    if (community) return { name: community.name, brand: community.brand ?? undefined, category: community.category };
  } catch { /* non-fatal */ }

  try {
    // Guard the network lookup with a timeout. Without it a stalled request
    // (common on mobile) never settles, leaving the scanner wedged on the
    // "Avo's having a look…" loading state with no recovery path.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = p.product_name_en || p.product_name || p.generic_name || null;
    if (!name) return null;
    const brand = p.brands ? p.brands.split(',')[0].trim() : undefined;
    const categories = p.categories || p.categories_tags?.join(', ') || '';
    return { name, brand, category: mapOFFCategory(categories) };
  } catch {
    return null;
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

// ── Main component ─────────────────────────────────────────────────────────────

export function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const cameraAvailable = !!(navigator.mediaDevices?.getUserMedia);

  const [status, setStatus] = useState<'scanning' | 'loading' | 'notfound' | 'error' | 'nocamera'>(
    cameraAvailable ? 'scanning' : 'nocamera'
  );
  const [errorMsg, setErrorMsg] = useState('');

  // "Add unknown product" flow
  const [addingProduct, setAddingProduct] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');
  const [addName, setAddName] = useState('');
  const [addBrand, setAddBrand] = useState('');
  const [addCategory, setAddCategory] = useState<FoodCategory>('Other');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const emitScan = (product: ScannedProduct) => { onScanRef.current(product); };

  const handleNotFound = (barcode: string) => {
    posthog.capture('barcode_scan_failed', { reason: 'not_found', source: 'camera' });
    setLastBarcode(barcode);
    setAddName('');
    setAddBrand('');
    setAddCategory('Other');
    setStatus('notfound');
  };

  const handleAddSubmit = async () => {
    if (!addName.trim()) return;
    setAddSubmitting(true);
    try {
      await submitCommunityProduct(lastBarcode, { name: addName, brand: addBrand, category: addCategory });
    } catch { /* non-fatal */ }
    setAddSubmitting(false);
    setAddingProduct(false);
    emitScan({ name: addName, brand: addBrand || undefined, category: addCategory });
  };

  // ZXing live stream — works on both web and native iOS via WKWebView
  useEffect(() => {
    if (!cameraAvailable) return;

    const reader = new BrowserMultiFormatReader();
    if (!videoRef.current) return;

    reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
      if (scannedRef.current) return;
      if (err instanceof NotFoundException) return;
      if (err || !result) return;

      scannedRef.current = true;
      setStatus('loading');
      const product = await lookupBarcode(result.getText());
      if (product) {
        emitScan(product);
      } else {
        handleNotFound(result.getText());
        setTimeout(() => { scannedRef.current = false; }, 1500);
      }
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Camera error';
      posthog.capture('barcode_scan_failed', { reason: msg, source: 'camera' });
      setErrorMsg(msg);
      setStatus('error');
    });

    return () => { BrowserMultiFormatReader.releaseAllStreams(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = {
    scanning: 'Show Avo a barcode',
    loading: 'Avo’s having a look…',
    notfound: 'Avo doesn’t recognize this one',
    error: errorMsg || 'Camera trouble',
    nocamera: 'Avo needs camera access',
  }[status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#1a1612', display: 'flex', flexDirection: 'column' }}>

      {/* Live camera preview */}
      {cameraAvailable && (
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          autoPlay
          muted
          playsInline
        />
      )}

      {/* Soft warm vignette over the video */}
      {cameraAvailable && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(26,22,18,0.55) 100%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Overlay UI */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 24px 48px',
      }}>
        {/* Top: close */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(26,22,18,0.55)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#faf7f2', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >×</button>
        </div>

        {/* Center: soft viewfinder */}
        {cameraAvailable && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', position: 'relative' }}>
            {/* Avo peeking from the side, watching */}
            <div style={{
              position: 'absolute',
              top: -28,
              right: -22,
              zIndex: 2,
              animation: status === 'scanning' ? 'avoPeek 3s ease-in-out infinite' : 'none',
              transformOrigin: 'bottom center',
            }}>
              <AvocadoMascot size={60} isStatic />
            </div>

            {/* Soft rounded viewfinder with breathing pulse */}
            <div style={{ position: 'relative', width: 280, height: 180 }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '28px',
                border: '2px solid rgba(250,247,242,0.85)',
                boxShadow: '0 0 0 9999px rgba(26,22,18,0.42), inset 0 0 24px rgba(250,247,242,0.08)',
                animation: status === 'scanning' ? 'softBreath 2.6s ease-in-out infinite' : 'none',
              }} />

              {/* Subtle inner glow ring */}
              {status === 'scanning' && (
                <div style={{
                  position: 'absolute', inset: '10px',
                  borderRadius: '22px',
                  border: '1px solid rgba(250,247,242,0.18)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Loading: gentle Avo bounce in the middle */}
              {status === 'loading' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ animation: 'gentleBounce 1.1s ease-in-out infinite' }}>
                    <AvocadoMascot size={64} isStatic />
                  </div>
                </div>
              )}
            </div>

            {/* Status text */}
            <div style={{
              color: '#faf7f2',
              padding: '0 20px',
              fontSize: 17,
              fontWeight: 700,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.01em',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              textAlign: 'center',
            }}>
              {statusLabel}
            </div>

            {/* "Help Avo" prompt when not found */}
            {status === 'notfound' && (
              <button
                onClick={() => setAddingProduct(true)}
                style={{
                  padding: '11px 22px', borderRadius: '24px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#faf7f2', fontSize: '14px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif",
                  boxShadow: '0 4px 14px rgba(74,124,89,0.4)',
                }}
              >
                Help Avo learn this one
              </button>
            )}
          </div>
        )}

        {/* Bottom: no-camera fallback (just info, no manual entry) */}
        {!cameraAvailable && (
          <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <AvocadoMascot size={56} isStatic />
            <div style={{
              color: '#faf7f2',
              fontSize: '14px',
              marginTop: '12px',
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              lineHeight: 1.45,
            }}>
              Avo can't see — no camera on this device.
            </div>
          </div>
        )}
        {cameraAvailable && <div />}
      </div>

      {/* "Add unknown product" full overlay */}
      {addingProduct && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'linear-gradient(180deg, #1a1612 0%, #221b16 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px', gap: '14px',
        }}>
          <AvocadoMascot size={64} isStatic />
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#faf7f2', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.2 }}>
              Teach Avo this one
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(250,247,242,0.55)', marginTop: '8px', lineHeight: 1.5, fontFamily: "'Cormorant Garamond', serif" }}>
              Add it once and the whole<br />Pantre community gets it for free.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '320px' }}>
            <input
              type="text" value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="Product name *" autoFocus
              style={overlayInputStyle}
            />
            <input
              type="text" value={addBrand}
              onChange={e => setAddBrand(e.target.value)}
              placeholder="Brand (optional)"
              style={overlayInputStyle}
            />

            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
              Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setAddCategory(cat)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', border: 'none',
                    background: addCategory === cat ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif",
                    transition: 'background 0.15s',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => { void handleAddSubmit(); }}
              disabled={addSubmitting || !addName.trim()}
              style={{
                marginTop: '6px', padding: '14px', borderRadius: '12px', border: 'none',
                background: addName.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: addName.trim() ? 'pointer' : 'not-allowed',
                fontFamily: "'Cormorant Garamond', serif",
                opacity: addSubmitting ? 0.7 : 1,
              }}
            >
              {addSubmitting ? 'Saving...' : 'Add to Pantre'}
            </button>

            <button
              onClick={() => { setAddingProduct(false); setStatus('scanning'); scannedRef.current = false; }}
              style={{
                padding: '10px', background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.4)', fontSize: '13px',
                cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              Skip — scan again
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes softBreath {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(26,22,18,0.42), inset 0 0 24px rgba(250,247,242,0.08), 0 0 0 0 rgba(250,247,242,0); }
          50%      { box-shadow: 0 0 0 9999px rgba(26,22,18,0.42), inset 0 0 36px rgba(250,247,242,0.14), 0 0 0 10px rgba(250,247,242,0.06); }
        }
        @keyframes avoPeek {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%      { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes gentleBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-10px) scale(1.03); }
        }
      `}</style>
    </div>
  );
}

const overlayInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '14px',
  fontFamily: "'Cormorant Garamond', serif",
  outline: 'none',
  boxSizing: 'border-box',
};
