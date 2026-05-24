import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const TARGET_ID = 'kb-scroll-target';
const GAP = 16;

function applyShift(keyboardHeight: number) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return;

  const rect = el.getBoundingClientRect();
  const obscured = rect.bottom + GAP - (window.innerHeight - keyboardHeight);

  const target = document.getElementById(TARGET_ID);
  if (!target) return;

  target.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
  target.style.transform = obscured > 0 ? `translateY(-${obscured}px)` : '';
}

function clearShift() {
  const target = document.getElementById(TARGET_ID);
  if (!target) return;
  target.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
  target.style.transform = '';
}

export function KeyboardScrollManager() {
  // Native: use Capacitor keyboard events
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let showHandle: PluginListenerHandle | null = null;
    let hideHandle: PluginListenerHandle | null = null;
    let cancelled = false;

    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => applyShift(keyboardHeight));
      hideHandle = await Keyboard.addListener('keyboardWillHide', clearShift);
      if (cancelled) { showHandle?.remove(); hideHandle?.remove(); }
    })();

    return () => {
      cancelled = true;
      showHandle?.remove();
      hideHandle?.remove();
    };
  }, []);

  // Web: use visualViewport resize to detect keyboard
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const kbHeight = window.innerHeight - vv.offsetTop - vv.height;
      if (kbHeight > 50) applyShift(kbHeight);
      else clearShift();
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return null;
}
