import { describe, it, expect } from 'vitest';
import { bestDinnerForPantry } from './recipeMatch';
import type { PantryItem, Recipe } from '../types';

function item(name: string, expirationDate: string): PantryItem {
  return {
    id: name, name, category: 'Other', location: 'fridge', quantity: 1, unit: 'pcs',
    addedDate: '2026-07-01', expirationDate, estimatedValue: 1,
  };
}

function recipe(id: string, name: string, ingredientNames: string[]): Recipe {
  return {
    id, name, description: '', matchedItemIds: [], missingIngredients: [],
    cookTime: 10, difficulty: 'easy', servings: 2,
    ingredients: ingredientNames.map(n => ({ name: n, amount: '1', fromPantry: true })),
    steps: [], savingsEstimate: 0, tags: [],
  };
}

describe('bestDinnerForPantry', () => {
  it('returns null when nothing in the pantry matches any recipe', () => {
    const result = bestDinnerForPantry([item('Milk', '2026-08-01')], [recipe('r1', 'Steak Dinner', ['Steak'])]);
    expect(result).toBeNull();
  });

  it('prefers the recipe using an expiring item over one with more matches but no urgency', () => {
    const pantry = [item('Spinach', '2026-07-08'), item('Chicken', '2026-09-01'), item('Rice', '2026-09-01'), item('Garlic', '2026-09-01')];
    const urgent = recipe('r1', 'Spinach Salad', ['Spinach']);
    const bigger = recipe('r2', 'Chicken Rice Bowl', ['Chicken', 'Rice', 'Garlic']);
    const result = bestDinnerForPantry(pantry, [bigger, urgent]);
    expect(result?.recipe.id).toBe('r1');
    expect(result?.usesExpiring).toBe(true);
  });

  it('picks the recipe with the most matches when none use expiring food', () => {
    const pantry = [item('Chicken', '2026-09-01'), item('Rice', '2026-09-01'), item('Garlic', '2026-09-01')];
    const small = recipe('r1', 'Garlic Rice', ['Rice', 'Garlic']);
    const big = recipe('r2', 'Chicken Rice Bowl', ['Chicken', 'Rice', 'Garlic']);
    const result = bestDinnerForPantry(pantry, [small, big]);
    expect(result?.recipe.id).toBe('r2');
    expect(result?.usesExpiring).toBe(false);
  });

  it('matches ingredient names loosely (whole/partial word overlap)', () => {
    const pantry = [item('Whole Milk', '2026-09-01')];
    const result = bestDinnerForPantry(pantry, [recipe('r1', 'Milk Toast', ['Milk'])]);
    expect(result?.recipe.id).toBe('r1');
  });
});
