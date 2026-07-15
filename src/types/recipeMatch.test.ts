import { describe, it, expect } from 'vitest';
import { ingredientMatchesItem } from './index';

describe('ingredientMatchesItem — plural folding', () => {
  it('matches silent-e plurals to their singular (regression: "apples" was folding to "appl")', () => {
    expect(ingredientMatchesItem('apple', 'apples')).toBe(true);
    expect(ingredientMatchesItem('grape', 'grapes')).toBe(true);
    expect(ingredientMatchesItem('lime', 'limes')).toBe(true);
  });

  it('still folds true "-es" plurals correctly', () => {
    expect(ingredientMatchesItem('tomato', 'tomatoes')).toBe(true);
    expect(ingredientMatchesItem('box', 'boxes')).toBe(true);
    expect(ingredientMatchesItem('dish', 'dishes')).toBe(true);
  });

  it('still folds simple -s and -ies plurals', () => {
    expect(ingredientMatchesItem('egg', 'eggs')).toBe(true);
    expect(ingredientMatchesItem('berry', 'berries')).toBe(true);
  });

  it('does not match unrelated words', () => {
    expect(ingredientMatchesItem('egg', 'eggplant')).toBe(false);
    expect(ingredientMatchesItem('milk', 'buttermilk')).toBe(false);
  });
});
