import { describe, it, expect } from 'vitest';
import { lookupShelfLife } from './shelfLife';

describe('lookupShelfLife', () => {
  it('exact match wins and is not shadowed by a longer keyword', () => {
    // Regression: "cream" used to resolve to "ice cream" (fridgeDays null)
    // because it was a longer substring. Exact match must win.
    expect(lookupShelfLife('cream', 'fridge')).toBe(7);
    expect(lookupShelfLife('cream', 'freezer')).toBe(120);
  });

  it('resolves a plain staple to its own entry', () => {
    expect(lookupShelfLife('milk', 'fridge')).toBe(7);
    expect(lookupShelfLife('milk', 'freezer')).toBe(90);
  });

  it('matches a keyword as whole words inside a longer query', () => {
    expect(lookupShelfLife('organic whole milk', 'fridge')).toBe(7);
  });

  it('folds plurals', () => {
    // "milks" → "milk"
    expect(lookupShelfLife('milks', 'fridge')).toBe(7);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(lookupShelfLife('  Milk  ', 'fridge')).toBe(7);
  });

  it('returns null for an unknown food', () => {
    expect(lookupShelfLife('zzzznotarealfood', 'fridge')).toBeNull();
  });
});
