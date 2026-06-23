import { useEffect, useMemo, useRef, useState } from 'react';
import { AvocadoMascot } from './AvocadoMascot';
import { parseVoiceItems, type ParsedVoiceItem } from '../lib/voiceParse';
import { isDictationSupported, startDictation, type DictationHandle } from '../lib/speech';
import { hapticLight, hapticMedium } from '../lib/haptics';

interface VoiceAddModalProps {
  onClose: () => void;
  onConfirm: (items: ParsedVoiceItem[]) => void;
}

/**
 * "Speak to add" — capture a phrase like "add 2 milks expiring Friday", parse
 * it into structured items, and let the user confirm before it hits the pantry.
 * Voice uses the Web Speech API where available and always falls back to a text
 * field running the exact same parser, so it works on every platform.
 */
export function VoiceAddModal({ onClose, onConfirm }: VoiceAddModalProps) {
  const supported = useMemo(() => isDictationSupported(), []);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<DictationHandle | null>(null);

  const items = useMemo(() => parseVoiceItems(transcript), [transcript]);

  useEffect(() => {
    return () => handleRef.current?.stop();
  }, []);

  const startListening = () => {
    setError(null);
    hapticMedium();
    setListening(true);
    handleRef.current = startDictation({
      onPartial: (text) => setTranscript(text),
      onFinal: (text) => { setTranscript(text); setListening(false); },
      onError: (reason) => {
        setListening(false);
        if (reason === 'not-allowed' || reason === 'service-not-allowed') {
          setError('Microphone access is off. You can type it instead.');
        } else if (reason !== 'no-speech' && reason !== 'aborted') {
          setError('Voice input had a hiccup — type it instead.');
        }
      },
    });
  };

  const stopListening = () => {
    hapticLight();
    handleRef.current?.stop();
    setListening(false);
  };

  const confirm = () => {
    if (items.length === 0) return;
    hapticMedium();
    onConfirm(items);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-enter"
        style={{
          width: '100%', maxWidth: '520px',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 18px calc(20px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <AvocadoMascot size={30} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Speak to add</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              Try “add 2 milks expiring Friday”
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close voice add"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Mic button (only when the platform supports live dictation) */}
        {supported && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 6px' }}>
            <button
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Stop listening' : 'Start listening'}
              style={{
                width: '72px', height: '72px', borderRadius: '50%',
                border: 'none', cursor: 'pointer',
                background: listening ? 'var(--expiring)' : 'var(--accent)',
                color: '#fff', fontSize: '30px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: listening ? '0 0 0 8px rgba(255,90,90,0.18)' : '0 4px 14px rgba(0,0,0,0.18)',
                transition: 'box-shadow 0.2s, background 0.2s',
              }}
            >
              {listening ? '◼' : '🎤'}
            </button>
          </div>
        )}
        {supported && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', minHeight: '16px', marginBottom: '8px' }}>
            {listening ? 'Listening… tap to stop' : 'Tap the mic, or type below'}
          </p>
        )}

        {/* Text field — always present, runs the same parser */}
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={supported ? 'or type it here…' : 'e.g. add 2 milks expiring Friday, 3 bananas'}
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: '10px', padding: '12px 14px',
            color: 'var(--text-primary)', fontFamily: "'Cormorant Garamond', serif",
            fontSize: '15px', outline: 'none', resize: 'none',
          }}
        />

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--expiring)', marginTop: '8px' }}>{error}</p>
        )}

        {/* Parsed preview */}
        {items.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Avo heard {items.length} item{items.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {it.quantity}{it.unit ? ` ${it.unit}` : '×'}
                  </span>
                  <span style={{ flex: 1, fontSize: '14px' }}>{it.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {it.expirationDate ? `exp ${it.expirationDate.slice(5)}` : 'auto exp'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirm */}
        <button
          onClick={confirm}
          disabled={items.length === 0}
          style={{
            width: '100%', marginTop: '16px', padding: '14px',
            borderRadius: '12px', border: 'none',
            background: items.length === 0 ? 'var(--input-border)' : 'var(--accent)',
            color: '#fff', fontWeight: 700, fontSize: '15px',
            cursor: items.length === 0 ? 'default' : 'pointer',
          }}
        >
          {items.length === 0 ? 'Say or type an item' : `Add ${items.length} item${items.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
