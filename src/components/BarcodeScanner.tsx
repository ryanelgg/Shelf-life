import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import type { FoodCategory } from '../types';

// Native barcode scanner plugin (BarcodeScannerPlugin.swift in App target)
const NativeScanner = registerPlugin<{
  scan(): Promise<{ displayValue: string }>;
}>('CapacitorBarcodeScanner');

interface ScannedProduct {
  name: string;
  category: FoodCategory;
  estimatedValue?: number;
}

interface Props {
  onScan: (product: ScannedProduct) => void;
  onClose: () => void;
}

// Local USDA barcode database — loaded once, cached in module scope
let localDB: Record<string, { n: string; c: FoodCategory }> | null = null;
let localDBPromise: Promise<void> | null = null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code ?? '');
  }
  return '';
}

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

async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  await loadLocalDB();
  const local = lookupLocalDB(barcode);
  if (local) return local;

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = p.product_name_en || p.product_name || p.generic_name || null;
    if (!name) return null;
    const categories = p.categories || p.categories_tags?.join(', ') || '';
    return { name, category: mapOFFCategory(categories) };
  } catch {
    return null;
  }
}

const isNative = Capacitor.isNativePlatform();
const webCameraAvailable = !isNative && !!(navigator.mediaDevices?.getUserMedia);

export function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'loading' | 'notfound' | 'error'>(
    () => (!isNative && webCameraAvailable ? 'scanning' : 'idle')
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const scannedRef = useRef(false);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const emitScan = (product: ScannedProduct) => {
    onScanRef.current(product);
  };

  const handleManualLookup = async () => {
    const code = manualBarcode.trim();
    if (!code) return;
    setManualLoading(true);
    setNotFound(false);
    const product = await lookupBarcode(code);
    setManualLoading(false);
    if (product) { emitScan(product); }
    else { setNotFound(true); }
  };

  // Native: AVFoundation live scanner — stays open until barcode is detected
  const handleNativeScan = async () => {
    try {
      setStatus('scanning');
      const { displayValue } = await NativeScanner.scan();
      if (!displayValue) { setStatus('idle'); return; }

      setStatus('loading');
      const product = await lookupBarcode(displayValue);
      if (product) {
        emitScan(product);
      } else {
        setStatus('notfound');
      }
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const message = getErrorMessage(error).toLowerCase();
      if (code === 'USER_CANCELLED' || message.includes('cancel')) {
        setStatus('idle');
      } else {
        setErrorMsg(getErrorMessage(error) || 'Scanner error');
        setStatus('error');
      }
    }
  };

  // Web: ZXing live video stream
  useEffect(() => {
    if (isNative || !webCameraAvailable) return;

    const reader = new BrowserMultiFormatReader();
    if (!videoRef.current) return;

    reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
      if (scannedRef.current) return;
      if (err instanceof NotFoundException) return;
      if (err || !result) return;

      scannedRef.current = true;
      setStatus('loading');
      const product = await lookupBarcode(result.getText());
      if (product) { emitScan(product); }
      else {
        setStatus('notfound');
        setTimeout(() => { scannedRef.current = false; setStatus('scanning'); }, 2000);
      }
    }).catch((e) => {
      setErrorMsg(e?.message || 'Camera error');
      setStatus('error');
    });

    return () => { BrowserMultiFormatReader.releaseAllStreams(); };
  }, []);

  // ── Native UI ────────────────────────────────────────────────────────────
  if (isNative) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#111',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', gap: '24px',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        <button
          onClick={handleNativeScan}
          disabled={status === 'scanning' || status === 'loading'}
          style={{
            width: 120, height: 120, borderRadius: '50%',
            background: (status === 'scanning' || status === 'loading')
              ? 'rgba(74,124,89,0.4)' : 'var(--accent)',
            border: '3px solid rgba(255,255,255,0.2)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '8px', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h3M18 3h3M3 21h3M18 21h3" />
            <rect x="7" y="7" width="3" height="8" rx="0.5" />
            <rect x="11" y="7" width="1.5" height="8" rx="0.5" />
            <rect x="14" y="7" width="3" height="8" rx="0.5" />
          </svg>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>
            {status === 'loading' ? 'Looking up...' : 'Scan Barcode'}
          </span>
        </button>

        {status === 'notfound' && (
          <div style={{ color: '#ff9999', fontSize: 13, textAlign: 'center' }}>
            Product not found — try scanning again
          </div>
        )}
        {status === 'error' && (
          <div style={{ color: '#ff9999', fontSize: 13, textAlign: 'center' }}>{errorMsg}</div>
        )}

        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>— or —</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: 300 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Enter barcode manually</div>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
              placeholder="e.g. 012345678901"
              style={{
                flex: 1, padding: '12px 14px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: '14px', fontFamily: "'Cormorant Garamond', serif",
              }}
            />
            <button
              onClick={handleManualLookup}
              disabled={manualLoading || !manualBarcode.trim()}
              style={{
                padding: '12px 16px', borderRadius: '10px', border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                opacity: manualLoading || !manualBarcode.trim() ? 0.5 : 1,
              }}
            >{manualLoading ? '...' : 'Look up'}</button>
          </div>
          {notFound && <div style={{ color: '#ff9999', fontSize: 13 }}>Product not found</div>}
        </div>
      </div>
    );
  }

  // ── Web UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {webCameraAvailable && (
        <video ref={videoRef} style={{ flex: 1, width: '100%', objectFit: 'cover' }} autoPlay muted playsInline />
      )}
      <div style={{
        position: webCameraAvailable ? 'absolute' : 'relative',
        inset: webCameraAvailable ? 0 : undefined,
        flex: webCameraAvailable ? undefined : 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: webCameraAvailable ? 'none' : 'auto',
        padding: '32px 24px', gap: '20px',
      }}>
        {webCameraAvailable && (
          <>
            <div style={{ width: 240, height: 160, position: 'relative', marginBottom: 24 }}>
              {[
                { top: 0, left: 0, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '4px 0 0 0' },
                { top: 0, right: 0, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 4px 0' },
              ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }} />)}
              {status === 'scanning' && (
                <div style={{ position: 'absolute', left: 8, right: 8, height: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'scanLine 1.8s ease-in-out infinite' }} />
              )}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600, fontFamily: "'Cormorant Garamond', serif" }}>
              {status === 'scanning' && 'Point at a barcode'}
              {status === 'loading' && 'Looking up product...'}
              {status === 'notfound' && 'Not found — try again'}
              {status === 'error' && (errorMsg || 'Camera error')}
            </div>
          </>
        )}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: 320 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {webCameraAvailable ? 'Or enter barcode manually' : 'Enter barcode number'}
          </div>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
              placeholder="e.g. 012345678901"
              style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', fontFamily: "'Cormorant Garamond', serif" }}
            />
            <button
              onClick={handleManualLookup}
              disabled={manualLoading || !manualBarcode.trim()}
              style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: manualLoading || !manualBarcode.trim() ? 0.5 : 1 }}
            >{manualLoading ? '...' : 'Look up'}</button>
          </div>
          {notFound && <div style={{ color: '#ff9999', fontSize: 13 }}>Product not found</div>}
        </div>
      </div>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
      <style>{`@keyframes scanLine { 0% { top: 8px; } 50% { top: calc(100% - 10px); } 100% { top: 8px; } }`}</style>
    </div>
  );
}
