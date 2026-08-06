import { registerPlugin, Capacitor } from '@capacitor/core';

// Bridge to Apple's DeclaredAgeRange framework (iOS 26+). Lets an app request a
// privacy-preserving age *range* (never a birthdate) so it can honor the state
// App Store Accountability Acts and apply age-appropriate defaults. Bounds are
// inclusive years; either may be null (e.g. "18 or older" has no upper bound,
// "under 13" has no lower bound).
export interface DeclaredAgeRangeResult {
  // 'shared'      — the user/parent shared a range.
  // 'declined'    — they were asked and declined to share.
  // 'unavailable' — not iOS 26+, missing entitlement, or web/Android: callers
  //                 fall back to the existing self-declared 13+ gate.
  status: 'shared' | 'declined' | 'unavailable';
  lowerBound?: number | null;
  upperBound?: number | null;
}

const DeclaredAgeRangePlugin = registerPlugin<{
  // ageGates are the thresholds the app cares about; native maps them to
  // Apple's requestAgeRange(ageGates:). 13 (COPPA) and 18 (minor) by default.
  requestAgeRange(options: { ageGates: number[] }): Promise<DeclaredAgeRangeResult>;
}>('DeclaredAgeRange');

// Requests the user's declared age range on iOS 26+. Safely no-ops everywhere
// else (web, Android, older iOS) by resolving { status: 'unavailable' }, so
// callers have a single code path and the web build never depends on the
// native framework.
export async function requestDeclaredAgeRange(
  ageGates: number[] = [13, 18],
): Promise<DeclaredAgeRangeResult> {
  if (Capacitor.getPlatform() !== 'ios') return { status: 'unavailable' };
  try {
    return await DeclaredAgeRangePlugin.requestAgeRange({ ageGates });
  } catch {
    // Older iOS without the plugin returns UNIMPLEMENTED — treat as unavailable.
    return { status: 'unavailable' };
  }
}

// The flags Pantre acts on, derived from a declared range.
export interface AgeSignal {
  isUnder13: boolean; // COPPA — must stay behind the 13+ gate.
  isMinor: boolean;   // under 18 — CAADCA / ASA teen protections apply.
  shared: boolean;    // whether the user actually shared a range.
}

// Interpret a declared range into Pantre's flags. Conservative: decisions use
// the upper bound when present ("under 13" => upperBound 12), and fall back to
// the lower bound only when there is no upper bound ("18 or older" => lower 18,
// not a minor). Declined/unavailable leaves both flags false so we keep relying
// on the existing self-declared 13+ gate rather than guessing.
export function interpretAgeRange(result: DeclaredAgeRangeResult): AgeSignal {
  if (result.status !== 'shared') {
    return { isUnder13: false, isMinor: false, shared: false };
  }
  const { lowerBound, upperBound } = result;
  const isUnder13 = upperBound != null ? upperBound < 13 : false;
  const isMinor =
    upperBound != null ? upperBound < 18 : lowerBound != null ? lowerBound < 18 : false;
  return { isUnder13, isMinor: isMinor || isUnder13, shared: true };
}
