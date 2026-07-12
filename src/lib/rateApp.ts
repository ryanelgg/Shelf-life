// "Rate Pantre" → send the user to the App Store review page.
//
// Once Pantre is live, set its numeric App Store ID here (or via the
// VITE_APP_STORE_ID env var) and the button deep-links straight to the
// write-a-review screen. An explicit VITE_APP_STORE_REVIEW_URL overrides
// everything. Until an ID is set, it opens the App Store app so the button is
// never dead.

const REVIEW_URL_OVERRIDE = (import.meta.env.VITE_APP_STORE_REVIEW_URL as string | undefined)?.trim();
// TODO(launch): replace with Pantre's real App Store ID (digits only), or set
// VITE_APP_STORE_ID at build time.
const APP_STORE_ID = ((import.meta.env.VITE_APP_STORE_ID as string | undefined)?.trim()) || '';

/** The URL that opens the App Store review sheet for Pantre. */
export function appStoreReviewUrl(): string {
  if (REVIEW_URL_OVERRIDE) return REVIEW_URL_OVERRIDE;
  if (APP_STORE_ID) return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  // No ID yet (pre-launch): open the App Store app rather than a dead link.
  return 'https://apps.apple.com/';
}

/**
 * Open the App Store review page. Uses the '_system' target so Capacitor hands
 * the URL to the OS (which opens the App Store app on iOS) instead of an in-app
 * web view.
 */
export function openAppStoreReview(): void {
  window.open(appStoreReviewUrl(), '_system');
}
