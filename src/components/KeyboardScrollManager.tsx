import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const GAP = 16;

function findScrollableAncestor(el: Element): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node as HTMLElement;
    node = node.parentElement;
  }
  return null;
}

function applyShift(keyboardHeight: number) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return;

  const rect = el.getBoundingClientRect();
  const visibleBottom = window.innerHeight - keyboardHeight - GAP;

  if (rect.bottom <= visibleBottom) return; // already above keyboard, nothing to do

  const scrollAmount = rect.bottom - visibleBottom;
  const scrollable = findScrollableAncestor(el);

  if (scrollable) {
    scrollable.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  } else {
    // Fallback for non-scrollable screens: shift the whole content wrapper
    const target = document.getElementById('kb-scroll-target');
    if (target) {
      target.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
      target.style.transform = `translateY(-${scrollAmount}px)`;
    }
  }
}

function clearShift() {
  // Only needed for the fallback translate — scrollable containers restore naturally
  const target = document.getElementById('kb-scroll-target');
  if (target && target.style.transform) {
    target.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
    target.style.transform = '';
  }
}

export function KeyboardScrollManager() {
  // Native: Capacitor keyboard events
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let showHandle: PluginListenerHandle | null = null;
    let hideHandle: PluginListenerHandle | null = null;
    let cancelled = false;

    (async () => {
      showHandle = await Keyboard.addListener('keyboardDidShow', ({ keyboardHeight }) => applyShift(keyboardHeight));
      hideHandle = await Keyboard.addListener('keyboardWillHide', clearShift);
      if (cancelled) { showHandle?.remove(); hideHandle?.remove(); }
    })();

    return () => {
      cancelled = true;
      showHandle?.remove();
      hideHandle?.remove();
    };
  }, []);

  // Web: visualViewport resize detects keyboard
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
