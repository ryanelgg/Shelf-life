import { useEffect, useRef } from 'react';

/**
 * setTimeout that cleans up after itself.
 *
 * Returns a `schedule(fn, ms)` helper that behaves like `setTimeout` but tracks
 * every pending timer and clears them all when the component unmounts. Screens
 * remount on tab change (`key={activeTab}` in App.tsx), so a delayed setState —
 * a success toast resetting after 2s, a Shopping-Radar "added" badge clearing
 * after 2.5s — would otherwise fire on an unmounted component and trigger a
 * React state-update-after-unmount warning / small leak. This makes those
 * one-shot timers safe without threading a ref through every call site.
 */
export function useTimeouts(): (fn: () => void, ms: number) => void {
  const timers = useRef<number[]>([]);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  return (fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}
