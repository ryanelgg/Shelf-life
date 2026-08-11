import { describe, it, expect } from 'vitest';
import { lookupShelfLife, COUNTER_COLD_CHAIN_DAYS } from './shelfLife';

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

  describe('counter (room temperature) never inherits the fridge shelf life', () => {
    it('caps a cold-chain food left on the counter at ~1 day, not its fridge life', () => {
      // Milk/raw chicken have a fridge life but no shelf-stable pantry life.
      // On the counter they must NOT borrow the 7-/2-day fridge value.
      expect(lookupShelfLife('milk', 'fridge')).toBe(7);
      expect(lookupShelfLife('milk', 'counter')).toBe(COUNTER_COLD_CHAIN_DAYS);
      expect(lookupShelfLife('raw chicken', 'fridge')).toBe(2);
      expect(lookupShelfLife('raw chicken', 'counter')).toBe(COUNTER_COLD_CHAIN_DAYS);
    });

    it('uses the real pantry life for a shelf-stable food on the counter', () => {
      // Bananas (4) and bread (7) are genuinely fine at room temperature.
      expect(lookupShelfLife('bananas', 'counter')).toBe(4);
      expect(lookupShelfLife('bread', 'counter')).toBe(7);
    });

    it('treats any perishable with a fridge-only life as cold-chain on the counter', () => {
      // Lettuce has a fridge life but no pantry life — on the counter it gets the
      // conservative ~1 day, never its 10-day fridge life.
      expect(lookupShelfLife('lettuce', 'fridge')).toBe(10);
      expect(lookupShelfLife('lettuce', 'counter')).toBe(COUNTER_COLD_CHAIN_DAYS);
    });

    it('returns unknown when a food has neither a pantry nor a fridge life', () => {
      // Ice cream is freezer-only (fridge + pantry both null); don't invent a
      // counter expiry — fall back to the caller's category default.
      expect(lookupShelfLife('ice cream', 'freezer')).toBe(60);
      expect(lookupShelfLife('ice cream', 'counter')).toBeNull();
    });

    it('leaves the pantry location unchanged (still falls back to fridge)', () => {
      // Regression guard: the counter change must not alter pantry behavior.
      expect(lookupShelfLife('milk', 'pantry')).toBe(7); // pantry still inherits fridge
      expect(lookupShelfLife('butter', 'pantry')).toBe(14);
    });
  });
});
