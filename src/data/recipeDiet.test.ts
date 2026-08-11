import { describe, it, expect } from 'vitest';
import { BROWSE_RECIPES } from './recipes';
import { meetsDiet } from '../lib/dietFilter';
import type { DietaryPref } from '../types';

// The Plan/Cook category chips filter recipes by their `tags` alone (no
// meetsDiet call), so a recipe that carries a diet tag it doesn't actually
// satisfy is shown to that diet's users as compliant — e.g. a "vegetarian"
// soup made with chicken broth, or a "vegan" bowl sweetened with honey.
// Conversely, a user WITH that saved preference has the mislabeled recipe
// hidden, so a recipe meant for them silently vanishes. This invariant locks
// every recipe's diet tags to what meetsDiet actually allows.
const DIET_TAGS: DietaryPref[] = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free'];

describe('recipe diet tags are consistent with meetsDiet', () => {
  for (const diet of DIET_TAGS) {
    it(`every recipe tagged "${diet}" actually passes the ${diet} filter`, () => {
      const violations = BROWSE_RECIPES
        .filter(r => (r.tags as string[]).includes(diet) && !meetsDiet(r, [diet]))
        .map(r => {
          const offending = r.ingredients
            .filter(i => !meetsDiet({ ...r, ingredients: [i] }, [diet]))
            .map(i => i.name)
            .join(', ');
          return `${r.id} "${r.name}" — offending: ${offending}`;
        });
      expect(violations, `Recipes tagged ${diet} but failing the ${diet} filter:\n${violations.join('\n')}`).toEqual([]);
    });
  }
});
