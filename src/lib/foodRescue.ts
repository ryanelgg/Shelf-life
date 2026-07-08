import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

// Food-rescue deep links. These open consumer food-sharing apps so a still-good
// item can be given away instead of binned. We use plain universal links (no API
// key / account needed): iOS hands them to the installed app, or falls back to
// the website / App Store.
const OLIO_URL = 'https://olioapp.com/';
const TOO_GOOD_TO_GO_URL = 'https://www.toogoodtogo.com/';

async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}

/** Olio — peer-to-peer food sharing with neighbours. The best "give it away" fit. */
export function openOlio(): Promise<void> {
  return openExternal(OLIO_URL);
}

/** Too Good To Go — surplus-food marketplace. */
export function openTooGoodToGo(): Promise<void> {
  return openExternal(TOO_GOOD_TO_GO_URL);
}

/** Offer the item to someone you know via the native share sheet (SMS fallback on web). */
export async function offerToFriend(itemName: string): Promise<void> {
  const text = `I've got ${itemName} to give away before it goes to waste — want it?`;
  try {
    await Share.share({ title: 'Free food 🥑', text, dialogTitle: 'Offer it to someone' });
  } catch {
    // Share unavailable (e.g. desktop web with no navigator.share) or user cancelled.
    if (!Capacitor.isNativePlatform()) {
      window.open(`sms:?&body=${encodeURIComponent(text)}`, '_blank');
    }
  }
}
