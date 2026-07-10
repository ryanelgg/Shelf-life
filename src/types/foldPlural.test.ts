import { describe, it, expect } from 'vitest';
import { ingredientMatchesItem } from './index';

// Regression guard for the plural-folding fix: the old "-es" rule mangled any
// plural of a word ending in a silent "e" (apples→appl), which silently broke
// recipe↔pantry ingredient matching.
describe('ingredientMatchesItem plural folding', () => {
  it('matches "-e" + "s" plurals to their singular', () => {
    expect(ingredientMatchesItem('apple', 'apples')).toBe(true);
    expect(ingredientMatchesItem('grape', 'grapes')).toBe(true);
    expect(ingredientMatchesItem('lime', 'limes')).toBe(true);
    expect(ingredientMatchesItem('date', 'dates')).toBe(true);
  });

  it('still matches sibilant/-o "-es" plurals to the bare stem', () => {
    expect(ingredientMatchesItem('tomato', 'tomatoes')).toBe(true);
    expect(ingredientMatchesItem('potato', 'potatoes')).toBe(true);
  });

  it('still matches simple "-s" and "-ies" plurals', () => {
    expect(ingredientMatchesItem('egg', 'eggs')).toBe(true);
    expect(ingredientMatchesItem('berry', 'berries')).toBe(true);
  });

  it('does not match unrelated foods', () => {
    expect(ingredientMatchesItem('apple', 'oranges')).toBe(false);
  });
});
