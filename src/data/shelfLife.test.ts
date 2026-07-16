import { describe, it, expect } from 'vitest';
import { lookupShelfLife } from './shelfLife';

describe('lookupShelfLife', () => {
  // The headline bug: raw substring matching made these compound names match
  // the "butter" entry (90 fridge days) and get a wildly wrong expiry.
  it('does NOT match "buttermilk" to the butter entry', () => {
    // No "buttermilk" keyword exists, so it should fall through to null
    // (the caller then uses the category default) — never butter's 90 days.
    expect(lookupShelfLife('buttermilk', 'fridge')).not.toBe(90);
    expect(lookupShelfLife('buttermilk', 'fridge')).toBeNull();
  });

  it('matches "butternut squash" to squash, not butter', () => {
    // Both are 90 fridge days, but the freezer values differ (squash 365 vs
    // butter 270) — so the freezer lookup proves the right entry was chosen.
    expect(lookupShelfLife('butternut squash', 'freezer')).toBe(365);
    expect(lookupShelfLife('butternut squash', 'fridge')).toBe(90);
  });

  it('still resolves exact keywords', () => {
    expect(lookupShelfLife('butter', 'pantry')).toBe(14);
    expect(lookupShelfLife('butter', 'fridge')).toBe(90);
    expect(lookupShelfLife('milk', 'fridge')).toBe(7);
  });

  it('lets a keyword generalize a decorated item name', () => {
    // "organic butter" contains all of the "butter" keyword's words.
    expect(lookupShelfLife('organic butter', 'fridge')).toBe(90);
  });

  it('resolves a bare item to its most specific sensible entry', () => {
    // "chicken" has no exact key; it should reach "chicken breast" (2 fridge
    // days), NOT the much longer "chicken broth canned" entry.
    expect(lookupShelfLife('chicken', 'fridge')).toBe(2);
  });

  it('returns null for unknown foods', () => {
    expect(lookupShelfLife('zzzznotafood', 'fridge')).toBeNull();
  });
});
