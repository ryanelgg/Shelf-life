import { describe, it, expect } from 'vitest';
import { isPantryStaple } from './pantryStaples';

describe('isPantryStaple — assumed-on-hand staples never hit the buy list', () => {
  it('flags the conservative staple set (case- and whitespace-insensitive)', () => {
    expect(isPantryStaple('Salt')).toBe(true);
    expect(isPantryStaple('salt ')).toBe(true);
    expect(isPantryStaple('Water')).toBe(true);
    expect(isPantryStaple('Pepper')).toBe(true);
    expect(isPantryStaple('Black pepper')).toBe(true);
    expect(isPantryStaple('Ice')).toBe(true);
    expect(isPantryStaple('Cooking spray')).toBe(true);
  });

  it('does NOT flag real produce that merely contains a staple word', () => {
    // Whole-name match, not substring — "pepper" must not swallow these.
    expect(isPantryStaple('Bell pepper')).toBe(false);
    expect(isPantryStaple('Bell peppers')).toBe(false);
    expect(isPantryStaple('Red pepper flakes')).toBe(false);
    expect(isPantryStaple('Watermelon')).toBe(false);
  });

  it('deliberately KEEPS oil/sugar/flour/butter on the list (people run out)', () => {
    expect(isPantryStaple('Olive oil')).toBe(false);
    expect(isPantryStaple('Vegetable oil')).toBe(false);
    expect(isPantryStaple('Sugar')).toBe(false);
    expect(isPantryStaple('Flour')).toBe(false);
    expect(isPantryStaple('Butter')).toBe(false);
  });
});
