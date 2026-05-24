import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function KeyboardInputPreview() {
  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const activeInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Native: track keyboard show/hide via Capacitor
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let showHandle: PluginListenerHandle | null = null;
    let hideHandle: PluginListenerHandle | null = null;
    let cancelled = false;

    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight: h }) => {
        setKeyboardHeight(h);
        setKeyboardVisible(true);
      });
      hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      });
      if (cancelled) {
        showHandle?.remove();
        hideHandle?.remove();
      }
    })();

    return () => {
      cancelled = true;
      showHandle?.remove();
      hideHandle?.remove();
    };
  }, []);

  // Web: detect keyboard height via visualViewport shrink
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const h = window.innerHeight - vv.offsetTop - vv.height;
      if (h > 50) {
        setKeyboardHeight(h);
        setKeyboardVisible(true);
      } else {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      }
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Track which input is focused and mirror its value
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return;
      activeInput.current = el;
      setText(el.value);
      setPlaceholder(el.placeholder ?? '');
      setInputFocused(true);
    };

    const onFocusOut = () => {
      setInputFocused(false);
      activeInput.current = null;
    };

    const onInput = (e: Event) => {
      if (e.target === activeInput.current) {
        setText((e.target as HTMLInputElement | HTMLTextAreaElement).value);
      }
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onInput);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onInput);
    };
  }, []);

  const isNative = Capacitor.isNativePlatform();
  const show = inputFocused && (isNative ? keyboardVisible : true);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: keyboardHeight + 10,
        left: 16,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none',
        animation: 'kbPreviewFadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--input-border)',
          borderRadius: '14px',
          padding: '11px 16px',
          fontSize: '16px',
          lineHeight: '1.4',
          color: text ? 'var(--text-primary)' : 'var(--text-muted)',
          fontFamily: "'Cormorant Garamond', serif",
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          wordBreak: 'break-word',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {text || placeholder || 'Start typing…'}
      </div>
    </div>
  );
}
