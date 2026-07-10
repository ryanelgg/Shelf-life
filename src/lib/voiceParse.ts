import { formatLocalDate } from '../types';

// ── Natural-language quick-add parser ────────────────────────────────────────
// Turns a spoken/typed phrase like "add 2 milks expiring Friday" into one or
// more structured items the Add flow can drop straight into the pantry.
//
// It is intentionally a PURE function (no Date.now() inside the hot path beyond
// the injectable `today`) so it is fully testable and deterministic.

export interface ParsedVoiceItem {
  quantity: number;
  unit?: string;
  name: string;
  /** YYYY-MM-DD, only when the phrase named an expiry. */
  expirationDate?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, couple: 2, few: 3,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5,
  saturday: 6, sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4,
  thurs: 4, fri: 5, sat: 6,
};

// Units we recognise, normalised to the short forms the manual form uses.
const UNITS: Record<string, string> = {
  gallon: 'gal', gallons: 'gal', gal: 'gal',
  dozen: 'dozen', dozens: 'dozen',
  pound: 'lbs', pounds: 'lbs', lb: 'lbs', lbs: 'lbs',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  piece: 'pcs', pieces: 'pcs', pcs: 'pcs', pc: 'pcs',
  pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack',
  bag: 'bag', bags: 'bag',
  box: 'box', boxes: 'box',
  can: 'can', cans: 'can',
  bottle: 'bottle', bottles: 'bottle',
  carton: 'carton', cartons: 'carton',
  bunch: 'bunch', bunches: 'bunch',
  head: 'head', heads: 'head',
  loaf: 'loaf', loaves: 'loaf',
  jar: 'jar', jars: 'jar',
  cup: 'cup', cups: 'cup',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  kg: 'kg', g: 'g', gram: 'g', grams: 'g', ml: 'ml',
};

// Filler we strip from the start of an utterance and from inside item names.
const LEAD_COMMANDS = /^(?:hey\s+avo[,\s]+)?(?:please\s+)?(?:can you\s+)?(?:add|put|log|track|i(?:'ve| have)?\s+(?:just\s+)?(?:bought|got|have|need|grabbed|picked up))\s+/i;
const NAME_FILLER = new Set(['of', 'some', 'the', 'my', 'a', 'an', 'fresh', 'more', 'extra']);

function addDays(today: Date, n: number): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

// Returns the day-offset for a date phrase found in `text`, plus the matched
// substring so the caller can strip it. null when no date phrase is present.
function extractDateOffset(text: string, today: Date): { offset: number; matched: string } | null {
  // A "lead-in" word that signals a date follows (expiring / use by / by / …).
  // Optional, so a bare "tomorrow" still works.
  const lead = '(?:that\\s+)?(?:expir\\w*|use(?:d)?\\s+by|best\\s+(?:by|before)|good\\s+(?:until|till|til)|goes?\\s+bad|until|till|til|by)?\\s*';

  // in N days / weeks / months  (N = digit or number word)
  let m = text.match(new RegExp(lead + 'in\\s+(\\d+|[a-z]+)\\s+(day|days|week|weeks|month|months)\\b', 'i'));
  if (m) {
    // Handle a literal "0" correctly ("in 0 days" = today): parseInt('0') is
    // falsy, so the old `|| NUMBER_WORDS[…] || 1` chain wrongly mapped it to 1.
    const n = /^\d+$/.test(m[1])
      ? parseInt(m[1], 10)
      : NUMBER_WORDS[m[1].toLowerCase()] ?? 1;
    const unit = m[2].toLowerCase();
    const mult = unit.startsWith('week') ? 7 : unit.startsWith('month') ? 30 : 1;
    return { offset: n * mult, matched: m[0] };
  }

  // today / tonight / tomorrow
  m = text.match(new RegExp(lead + '(today|tonight)\\b', 'i'));
  if (m) return { offset: 0, matched: m[0] };
  m = text.match(new RegExp(lead + '(tomorrow|tmrw|tmw)\\b', 'i'));
  if (m) return { offset: 1, matched: m[0] };

  // next week / this week / next month
  m = text.match(new RegExp(lead + '(?:in\\s+)?(?:a|next)\\s+week\\b', 'i'));
  if (m) return { offset: 7, matched: m[0] };
  m = text.match(new RegExp(lead + '(?:in\\s+)?(?:a|next)\\s+month\\b', 'i'));
  if (m) return { offset: 30, matched: m[0] };

  // (this/next) weekday — soonest future occurrence, +7 more for "next".
  m = text.match(new RegExp(lead + '(this\\s+|next\\s+)?(' + Object.keys(WEEKDAYS).join('|') + ')\\b', 'i'));
  if (m) {
    const isNext = /next/i.test(m[1] || '');
    const target = WEEKDAYS[m[2].toLowerCase()];
    let delta = (target - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;           // "friday" on a Friday → next Friday
    if (isNext) delta += 7;
    return { offset: delta, matched: m[0] };
  }

  return null;
}

function cleanName(raw: string): string {
  const words = raw
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !NAME_FILLER.has(w.toLowerCase()));
  if (words.length === 0) return '';
  // Title-case for a tidy pantry label.
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseSegment(segment: string, today: Date): ParsedVoiceItem | null {
  let text = segment.trim();
  if (!text) return null;

  // 1. Pull out a date phrase (if any) and remove it from the text.
  let expirationDate: string | undefined;
  const date = extractDateOffset(text, today);
  if (date) {
    expirationDate = formatLocalDate(addDays(today, date.offset));
    text = text.replace(date.matched, ' ').trim();
  }

  // 2. Leading quantity (digit or number word).
  let quantity = 1;
  let quantityGiven = false;
  let m = text.match(/^(\d+(?:\.\d+)?)\s+/);
  if (m) {
    quantity = parseFloat(m[1]);
    quantityGiven = true;
    text = text.slice(m[0].length);
  } else {
    m = text.match(/^([a-z]+)\s+/i);
    if (m && NUMBER_WORDS[m[1].toLowerCase()] !== undefined) {
      quantity = NUMBER_WORDS[m[1].toLowerCase()];
      quantityGiven = true;
      // "a"/"an" are articles — keep them out of the count-was-given heuristic
      if (m[1].toLowerCase() === 'a' || m[1].toLowerCase() === 'an') quantityGiven = false;
      text = text.slice(m[0].length);
    }
  }

  // 3. Optional unit right after the quantity (e.g. "2 gallons of milk").
  let unit: string | undefined;
  m = text.match(/^([a-z]+)\b/i);
  if (m && UNITS[m[1].toLowerCase()]) {
    unit = UNITS[m[1].toLowerCase()];
    text = text.slice(m[0].length);
  }

  // 4. Whatever remains is the item name.
  const name = cleanName(text);
  if (!name) return null;

  void quantityGiven;
  return { quantity: quantity > 0 ? quantity : 1, unit, name, expirationDate };
}

// Common foods whose name literally contains "and" — we must NOT split these
// into two items. Matched case-insensitively as whole phrases.
const COMPOUND_FOODS = [
  'mac and cheese', 'macaroni and cheese', 'chips and salsa', 'salt and pepper',
  'peanut butter and jelly', 'surf and turf', 'fish and chips', 'bread and butter',
  'biscuits and gravy', 'rice and beans', 'beans and rice', 'oil and vinegar',
  'sweet and sour', 'cookies and cream', 'bangers and mash', 'ham and cheese',
];

/**
 * Parse a full utterance into one or more items. Splits on commas and the word
 * "and" so "milk, eggs and 2 yogurts expiring friday" yields three items —
 * except for known compound food names like "mac and cheese".
 */
export function parseVoiceItems(transcript: string, today: Date = new Date()): ParsedVoiceItem[] {
  if (!transcript || !transcript.trim()) return [];
  let cleaned = transcript.trim().replace(LEAD_COMMANDS, '');

  // Shield compound names from the "and" splitter by swapping their "and" for a
  // placeholder, then restoring it in each finished segment.
  const AND_PLACEHOLDER = '@@AND@@';
  for (const phrase of COMPOUND_FOODS) {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), m => m.replace(/ and /gi, ` ${AND_PLACEHOLDER} `));
  }

  const segments = cleaned
    .split(/\s*,\s*|\s+and\s+/i)
    .map(s => s.replace(/@@AND@@/g, 'and').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items: ParsedVoiceItem[] = [];
  for (const seg of segments) {
    const parsed = parseSegment(seg, today);
    if (parsed) items.push(parsed);
  }
  return items;
}
