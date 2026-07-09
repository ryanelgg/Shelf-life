const INVITE_BASE_URL = 'https://usepantre.me/join';

/** The text encoded into an invite QR — a share URL carrying the code. */
export function buildInviteUrl(code: string): string {
  return `${INVITE_BASE_URL}?code=${encodeURIComponent(code)}`;
}

function normalize(s: string): string | null {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length >= 4 && c.length <= 12 ? c : null;
}

/**
 * Extract a household invite code from scanned QR text. Accepts the forms Pantre
 * generates, and rejects arbitrary QR codes so scanning a random poster doesn't
 * try to join a household:
 *   - share URL:   "https://usepantre.me/join?code=ABC123"
 *   - scheme form: "PANTRE:ABC123"
 *   - bare code:   "ABC123" (only when it has no URL structure)
 *
 * Returns the normalized (uppercase, alphanumeric) code, or null.
 */
export function parseInviteCode(scanned: string | null | undefined): string | null {
  if (!scanned) return null;
  const text = scanned.trim();

  const codeParam = text.match(/[?&]code=([A-Za-z0-9-]+)/i);
  if (codeParam) return normalize(codeParam[1]!);

  const scheme = text.match(/^pantre:([A-Za-z0-9-]+)$/i);
  if (scheme) return normalize(scheme[1]!);

  // Bare code only — reject anything with URL/scheme structure (/, :, ., ?, …).
  if (/^[A-Za-z0-9-]{4,14}$/.test(text)) return normalize(text);

  return null;
}
