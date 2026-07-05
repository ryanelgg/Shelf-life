import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { AvocadoMascot } from './AvocadoMascot';

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

/**
 * Lightweight camera QR reader. Reuses ZXing (already a dependency for barcode
 * scanning) but stays separate from BarcodeScanner, which is wired to the
 * product-lookup flow. Emits the raw decoded text once, then the caller closes.
 */
export function QRScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const cameraAvailable = !!(navigator.mediaDevices?.getUserMedia);
  const [status, setStatus] = useState<'scanning' | 'error' | 'nocamera'>(
    cameraAvailable ? 'scanning' : 'nocamera',
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!cameraAvailable || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (doneRef.current) return;
      if (err instanceof NotFoundException) return;
      if (err || !result) return;
      doneRef.current = true;
      onResultRef.current(result.getText());
    }).catch((e: unknown) => {
      setErrorMsg(e instanceof Error ? e.message : 'Camera error');
      setStatus('error');
    });
    return () => { BrowserMultiFormatReader.releaseAllStreams(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = {
    scanning: 'Point at a Pantre invite QR',
    error: errorMsg || 'Camera trouble',
    nocamera: 'Avo needs camera access',
  }[status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#1a1612', display: 'flex', flexDirection: 'column' }}>
      {cameraAvailable && (
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          autoPlay muted playsInline
        />
      )}
      {cameraAvailable && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(26,22,18,0.55) 100%)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 24px 48px',
      }}>
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

        {cameraAvailable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: 240, height: 240, borderRadius: '28px',
              border: '2px solid rgba(250,247,242,0.85)',
              boxShadow: '0 0 0 9999px rgba(26,22,18,0.42)',
            }} />
            <div style={{
              color: '#faf7f2', fontSize: 17, fontWeight: 700,
              fontFamily: "'Cormorant Garamond', serif",
              textShadow: '0 2px 8px rgba(0,0,0,0.5)', textAlign: 'center',
            }}>{statusLabel}</div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <AvocadoMascot size={56} isStatic />
            <div style={{
              color: '#faf7f2', fontSize: '14px', marginTop: '12px',
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, lineHeight: 1.45,
            }}>
              Avo can't see — no camera on this device.
            </div>
          </div>
        )}
        {cameraAvailable && <div />}
      </div>
    </div>
  );
}
