import { describe, it, expect } from 'vitest';
import { meetsDiet, nameAllowedByDiet } from './dietFilter';
import type { Recipe, DietaryPref } from '../types';

// Minimal recipe factory — meetsDiet only reads ingredient names.
function recipe(...ingredientNames: string[]): Recipe {
  return {
    ingredients: ingredientNames.map(name => ({ name, amount: '1', fromPantry: false })),
  } as unknown as Recipe;
}

const NUT_FREE: DietaryPref[] = ['nut-free'];
const VEGAN: DietaryPref[] = ['vegan'];
const VEGETARIAN: DietaryPref[] = ['vegetarian'];
const GF: DietaryPref[] = ['gluten-free'];

describe('meetsDiet — plural allergen names (regression: recipes store plurals)', () => {
  it('blocks recipes whose ingredients are stored in the plural form', () => {
    // The recipe catalog stores "Walnuts"/"Almonds"/"Peanuts"/"Eggs".
    expect(meetsDiet(recipe('Walnuts'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Almonds'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Peanuts'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Eggs'), VEGAN)).toBe(false);
  });

  it('blocks singular forms too', () => {
    expect(meetsDiet(recipe('Walnut'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Egg'), VEGAN)).toBe(false);
  });

  it('blocks the "-y" → "-ies" plural (anchovy → anchovies)', () => {
    expect(meetsDiet(recipe('Anchovies'), VEGETARIAN)).toBe(false);
  });

  it('keeps the whole-word guards — must NOT block innocent substrings', () => {
    expect(meetsDiet(recipe('Eggplant'), VEGAN)).toBe(true);       // contains "egg"
    expect(meetsDiet(recipe('Buckwheat'), GF)).toBe(true);          // contains "wheat"
    expect(meetsDiet(recipe('Graham crackers'), VEGETARIAN)).toBe(true); // contains "ham"
  });

  it('allows fully-compliant recipes', () => {
    expect(meetsDiet(recipe('Rice', 'Broccoli', 'Tofu'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Rice', 'Chickpeas'), NUT_FREE)).toBe(true);
  });

  it('no active diet → everything passes', () => {
    expect(meetsDiet(recipe('Walnuts', 'Eggs'), ['none'])).toBe(true);
  });
});

describe('nameAllowedByDiet — single shopping-list item names', () => {
  it('rejects plural allergen item names', () => {
    expect(nameAllowedByDiet('Walnuts', NUT_FREE)).toBe(false);
    expect(nameAllowedByDiet('Eggs', VEGAN)).toBe(false);
  });

  it('allows innocent substrings', () => {
    expect(nameAllowedByDiet('Eggplant', VEGAN)).toBe(true);
    expect(nameAllowedByDiet('Buckwheat flour', GF)).toBe(false); // "flour" is blocked, correctly
    expect(nameAllowedByDiet('Buckwheat', GF)).toBe(true);
  });
});
