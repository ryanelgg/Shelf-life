import { describe, it, expect } from 'vitest';
import { meetsDiet, nameAllowedByDiet, DIET_BLOCKLIST } from './dietFilter';
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

describe('meetsDiet — plant-based milk/cream is vegan & dairy-free (regression: coconut milk was hidden)', () => {
  const DAIRY_FREE: DietaryPref[] = ['dairy-free'];

  it('does NOT hide plant-milk recipes from vegan users', () => {
    // The catalog ships these tagged vegan+dairy-free (e.g. Coconut Red Lentil Dal).
    expect(meetsDiet(recipe('Coconut milk', 'Red lentils'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Almond milk', 'Banana'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Oat milk'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Coconut cream'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Soy milk'), DAIRY_FREE)).toBe(true);
    expect(meetsDiet(recipe('Cashew cream'), DAIRY_FREE)).toBe(true);
  });

  it('still blocks GENUINE dairy for vegan & dairy-free', () => {
    expect(meetsDiet(recipe('Whole milk'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Milk'), DAIRY_FREE)).toBe(false);
    expect(meetsDiet(recipe('Heavy cream'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Sour cream'), DAIRY_FREE)).toBe(false);
    // fused/aliased dairy the whole-word matcher used to miss
    expect(meetsDiet(recipe('Buttermilk'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Buttermilk'), DAIRY_FREE)).toBe(false);
    expect(meetsDiet(recipe('Feta'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Feta'), DAIRY_FREE)).toBe(false);
  });

  it('keeps nut-free blocking "almond milk"/"cashew cream" via the qualifier', () => {
    // Scrubbing removes only "milk"/"cream"; the nut qualifier must still match.
    expect(meetsDiet(recipe('Almond milk'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Cashew cream'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Hazelnut milk'), NUT_FREE)).toBe(false);
    // …but coconut/oat/soy milk are nut-free-safe.
    expect(meetsDiet(recipe('Coconut milk'), NUT_FREE)).toBe(true);
    expect(meetsDiet(recipe('Oat milk'), NUT_FREE)).toBe(true);
  });
});

describe('meetsDiet — non-dairy "butter"/"cream" foods (regression: peanut butter was hidden)', () => {
  const DAIRY_FREE: DietaryPref[] = ['dairy-free'];

  it('does NOT hide nut/seed/plant butters from vegan & dairy-free users', () => {
    expect(meetsDiet(recipe('Peanut butter', 'Banana'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Peanut butter'), DAIRY_FREE)).toBe(true);
    expect(meetsDiet(recipe('Almond butter'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Cocoa butter'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Apple butter'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Sunflower seed butter'), DAIRY_FREE)).toBe(true);
  });

  it('does NOT hide butter-named produce or cream of tartar', () => {
    expect(meetsDiet(recipe('Butter lettuce'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Butter beans'), DAIRY_FREE)).toBe(true);
    expect(meetsDiet(recipe('Cream of tartar'), VEGAN)).toBe(true);
  });

  it('still blocks GENUINE butter/cream for vegan & dairy-free', () => {
    expect(meetsDiet(recipe('Butter'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Salted butter'), DAIRY_FREE)).toBe(false);
    expect(meetsDiet(recipe('Brown butter'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Heavy cream'), DAIRY_FREE)).toBe(false);
    // "butter milk" (two words) is still dairy and must stay blocked
    expect(meetsDiet(recipe('Butter milk'), VEGAN)).toBe(false);
  });

  it('keeps nut-free blocking nut butters via the qualifier', () => {
    expect(meetsDiet(recipe('Peanut butter'), NUT_FREE)).toBe(false);
    expect(meetsDiet(recipe('Almond butter'), NUT_FREE)).toBe(false);
    // …but sunflower/cocoa/apple butter are nut-free-safe.
    expect(meetsDiet(recipe('Sunflower butter'), NUT_FREE)).toBe(true);
    expect(meetsDiet(recipe('Cocoa butter'), NUT_FREE)).toBe(true);
  });
});

describe('meetsDiet — naturally gluten-free noodles (regression: rice noodles were hidden)', () => {
  it('does NOT hide GF noodles from gluten-free users', () => {
    expect(meetsDiet(recipe('Rice noodles', 'Peanut butter'), GF)).toBe(true);
    expect(meetsDiet(recipe('Glass noodles'), GF)).toBe(true);
    expect(meetsDiet(recipe('Shirataki noodles'), GF)).toBe(true);
    expect(meetsDiet(recipe('Sweet potato noodles'), GF)).toBe(true);
    expect(meetsDiet(recipe('Mung bean noodles'), GF)).toBe(true);
  });

  it('still blocks wheat-based noodles for gluten-free', () => {
    expect(meetsDiet(recipe('Egg noodles'), GF)).toBe(false);
    expect(meetsDiet(recipe('Udon noodles'), GF)).toBe(false);
    expect(meetsDiet(recipe('Ramen noodles'), GF)).toBe(false);
    expect(meetsDiet(recipe('Noodles'), GF)).toBe(false); // bare/unqualified stays blocked
  });
});

describe('meetsDiet — vegan is a strict superset of vegetarian (regression: fish leaked)', () => {
  it('blocks every vegetarian-blocked animal food for vegans too', () => {
    // Vegan is stricter than vegetarian; any term the vegetarian list blocks the
    // vegan list must also block, or a vegan gets told meat/fish is "vegan-safe".
    const missing = DIET_BLOCKLIST.vegetarian.filter(
      t => !DIET_BLOCKLIST.vegan.includes(t),
    );
    expect(missing).toEqual([]);
  });

  it('specifically blocks halibut/trout/mahi/catfish for vegans', () => {
    expect(meetsDiet(recipe('Halibut'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Trout'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Mahi'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Catfish'), VEGAN)).toBe(false);
    // and the shopping-list gate (nameAllowedByDiet) rejects them too
    expect(nameAllowedByDiet('Trout', VEGAN)).toBe(false);
  });
});

describe('meetsDiet — mussels block shellfish diets (regression: singular escaped)', () => {
  it('blocks mussels for vegetarians AND vegans, singular or plural', () => {
    expect(meetsDiet(recipe('Mussels'), VEGETARIAN)).toBe(false);
    expect(meetsDiet(recipe('Mussel'), VEGETARIAN)).toBe(false);
    expect(meetsDiet(recipe('Mussels'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Mussel'), VEGAN)).toBe(false);
  });
});

describe('meetsDiet — vegan is a strict superset of dairy-free (regression: brie/mascarpone/half-and-half leaked)', () => {
  const DAIRY_FREE: DietaryPref[] = ['dairy-free'];

  it('blocks every dairy-free-blocked food for vegans too', () => {
    // Vegan bans all dairy, so anything dairy-free hides a vegan must hide as
    // well — otherwise a vegan is told a dairy food is "vegan-safe".
    for (const term of DIET_BLOCKLIST['dairy-free']) {
      expect(meetsDiet(recipe(term), VEGAN)).toBe(false);
    }
  });

  it('blocks brie, mascarpone, and half-and-half for BOTH vegan and dairy-free', () => {
    expect(meetsDiet(recipe('Mascarpone'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Brie'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Half and half'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Half and half'), DAIRY_FREE)).toBe(false);
    expect(nameAllowedByDiet('Mascarpone', VEGAN)).toBe(false);
    expect(nameAllowedByDiet('Half and half', DAIRY_FREE)).toBe(false);
  });

  it('blocks bare named cheeses that carry no "cheese" word', () => {
    expect(meetsDiet(recipe('Gouda'), DAIRY_FREE)).toBe(false);
    expect(meetsDiet(recipe('Provolone'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Camembert'), DAIRY_FREE)).toBe(false);
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
