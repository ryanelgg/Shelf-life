import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { InAppReview } from '@capacitor-community/in-app-review';
import * as debug from './debug';

// App Store listing is identified by its numeric ID. Configure either the full
// review URL or just the ID via env; we build the "write a review" deep link
// from whichever is present. Both optional so the native overlay still works
// on device (StoreKit/Play don't need the ID) without any config.
const APP_STORE_ID = (import.meta.env.VITE_APP_STORE_ID as string | undefined)?.trim();
const REVIEW_URL_OVERRIDE = (import.meta.env.VITE_APP_STORE_REVIEW_URL as string | undefined)?.trim();

/** The App Store "write a review" URL, or null if we don't know the listing. */
export function appStoreReviewUrl(): string | null {
  if (REVIEW_URL_OVERRIDE) return REVIEW_URL_OVERRIDE;
  if (APP_STORE_ID) return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  return null;
}

/**
 * The contextual, system-initiated rating overlay (iOS StoreKit /
 * Android Play In-App Review). Use this after a positive moment — the OS
 * rate-limits it (a few times a year) and may show nothing, so never block UX
 * on it or assume it appeared. On web it falls back to the listing URL.
 */
export async function requestInAppReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = appStoreReviewUrl();
    if (url) window.open(url, '_blank');
    return;
  }
  try {
    await InAppReview.requestReview();
  } catch (err) {
    debug.warn('[review] in-app review unavailable:', err);
  }
}

/**
 * The explicit "Rate us" action behind a button tap. Apple's guidance is to
 * deep-link straight to the App Store review page for user-initiated rating
 * (the in-app overlay is reserved for system-chosen moments and the OS may
 * silently suppress it). Falls back to the native overlay if no listing URL
 * is configured yet.
 */
export async function openAppStoreReview(): Promise<void> {
  const url = appStoreReviewUrl();
  if (url) {
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url });
      else window.open(url, '_blank');
      return;
    } catch (err) {
      debug.warn('[review] opening store URL failed, trying in-app overlay:', err);
    }
  }
  await requestInAppReview();
}
