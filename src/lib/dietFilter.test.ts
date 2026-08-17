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

describe('meetsDiet — scrubs must NOT leak across ingredient boundaries (regression)', () => {
  // Each ingredient is scrubbed independently. Two SEPARATE ingredients that
  // happen to form a false-positive phrase when concatenated must not hide a
  // genuinely-blocked word.
  it('blocks real butter listed alongside beans (was: "butter beans" hid it)', () => {
    expect(meetsDiet(recipe('Butter', 'Beans'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Butter', 'Lettuce'), VEGAN)).toBe(false);
  });

  it('blocks real cream listed alongside coconut (was: "coconut cream" hid it)', () => {
    expect(meetsDiet(recipe('Coconut', 'Cream'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Coconut', 'Milk'), VEGAN)).toBe(false);
  });

  it('blocks wheat noodles listed alongside rice (was: "rice noodles" let it pass)', () => {
    expect(meetsDiet(recipe('Rice', 'Noodles'), GF)).toBe(false);
  });

  it('still passes the genuine multi-word single ingredient', () => {
    // One ingredient name, not two — the scrub is still correct here.
    expect(meetsDiet(recipe('Butter beans'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Coconut cream'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Rice noodles'), GF)).toBe(true);
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

describe('meetsDiet — vegan is a strict superset of dairy-free (regression: brie/mascarpone leaked)', () => {
  it('blocks every dairy-free-blocked food for vegans too', () => {
    // A vegan must never be shown a food a dairy-free user is protected from.
    // The vegan list omitted brie/mascarpone/half-and-half that dairy-free had.
    const leaks = DIET_BLOCKLIST['dairy-free'].filter(
      term => meetsDiet(recipe(term), VEGAN),
    );
    expect(leaks).toEqual([]);
  });

  it('specifically blocks brie/mascarpone/half-and-half for vegans', () => {
    expect(meetsDiet(recipe('Brie'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Mascarpone'), VEGAN)).toBe(false);
    expect(meetsDiet(recipe('Half-and-half'), VEGAN)).toBe(false);
    expect(nameAllowedByDiet('Brie', VEGAN)).toBe(false); // shopping-list gate too
  });
});

describe('meetsDiet — naturally gluten-free corn tortillas & GF tamari (regression: hidden)', () => {
  it('does NOT hide corn tortillas from gluten-free users', () => {
    expect(meetsDiet(recipe('Corn tortillas', 'Cauliflower'), GF)).toBe(true);
    expect(meetsDiet(recipe('Corn tortilla'), GF)).toBe(true);
  });

  it('does NOT hide gluten-free tamari from gluten-free users', () => {
    expect(meetsDiet(recipe('Tamari (gluten-free soy sauce)', 'Tofu'), GF)).toBe(true);
  });

  it('still blocks flour tortillas and ordinary soy sauce for gluten-free', () => {
    expect(meetsDiet(recipe('Flour tortillas'), GF)).toBe(false);
    expect(meetsDiet(recipe('Soy sauce'), GF)).toBe(false);
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

describe('meetsDiet — additional gluten grains blocked for gluten-free (regression: omitted)', () => {
  it('blocks seitan, spelt, farro, bulgur, semolina and orzo (all wheat/gluten)', () => {
    for (const g of ['Seitan', 'Spelt', 'Farro', 'Bulgur', 'Semolina', 'Orzo']) {
      expect(meetsDiet(recipe(g), GF)).toBe(false);
    }
  });

  it('does not hit innocent words that merely contain a grain substring', () => {
    // \b guards: "revealed" must not trip "veal"; these carry no blocked whole word.
    expect(meetsDiet(recipe('Revealed sauce'), GF)).toBe(true);
    expect(meetsDiet(recipe('Corn'), GF)).toBe(true);
  });
});

describe('meetsDiet — additional animal foods blocked for vegetarian/vegan (regression: omitted)', () => {
  it('blocks duck, veal, venison, bison, gelatin and lard for both diets', () => {
    for (const a of ['Duck', 'Veal', 'Venison', 'Bison', 'Gelatin', 'Lard']) {
      expect(meetsDiet(recipe(a), VEGETARIAN)).toBe(false);
      expect(meetsDiet(recipe(a), VEGAN)).toBe(false);
    }
  });

  it('does not hit innocent words containing an animal-term substring', () => {
    // "reveal" ⊃ "veal", "mallard" ⊃ "lard"/"ard", "larder" ⊃ "lard" — \b keeps them safe.
    expect(meetsDiet(recipe('Reveal'), VEGETARIAN)).toBe(true);
    expect(meetsDiet(recipe('Mallard-free broth'), VEGAN)).toBe(true);
    expect(meetsDiet(recipe('Larder staples'), VEGAN)).toBe(true);
  });
});
