import { describe, it, expect } from 'vitest';
import { lookupShelfLife } from './shelfLife';

describe('lookupShelfLife', () => {
  it('matches a known single-word food', () => {
    expect(lookupShelfLife('milk', 'fridge')).toBe(7);
    expect(lookupShelfLife('milk', 'freezer')).toBe(90);
  });

  it('matches a multi-word food', () => {
    expect(lookupShelfLife('whole milk', 'fridge')).toBe(7);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(lookupShelfLife('  MILK  ', 'fridge')).toBe(7);
  });

  // --- Regression tests for the substring-matching bug ---
  // The old matcher used String.includes, so "milkshake" matched "milk" and
  // "buttermilk" matched "butter", handing perishable shelf lives to unrelated
  // foods. Whole-word matching must NOT do that.
  it('does not match a compound word as its substring (milkshake ≠ milk)', () => {
    expect(lookupShelfLife('milkshake', 'fridge')).toBeNull();
  });

  it('does not match buttermilk as butter or milk', () => {
    expect(lookupShelfLife('buttermilk', 'fridge')).toBeNull();
  });

  // A bare head word should still fall back to a multi-word keyword
  // (e.g. "beef" → "ground beef") so common single-word entries keep working.
  it('falls back from a bare head word to a multi-word keyword (beef → ground beef)', () => {
    expect(typeof lookupShelfLife('beef', 'fridge')).toBe('number');
  });

  it('returns null for an unknown food', () => {
    expect(lookupShelfLife('zzzznotafood', 'fridge')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(lookupShelfLife('', 'fridge')).toBeNull();
    expect(lookupShelfLife('   ', 'fridge')).toBeNull();
  });
});
