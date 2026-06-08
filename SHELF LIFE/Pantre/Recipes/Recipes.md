---
type: index
section: recipes
total: 180
---

# Pantre Recipe Library

The full recipe set that powers Avo's daily briefing — 180 recipes total. 60 originals from the launch + 120 community additions.

## Sections

- [[Breakfast]] — 51 recipes (11 original + 40 community)
- [[Lunch]] — 56 recipes (16 original + 40 community)
- [[Dinner]] — 73 recipes (33 original + 40 community)

## Where they live in the codebase

- Original 60: `src/data/recipes.ts` (`ORIGINAL_RECIPES`)
- Community 120: `src/data/recipesExtra.ts` (`EXTRA_RECIPES`)
- Merged export via `recipes.ts` → `BROWSE_RECIPES = [...ORIGINAL_RECIPES, ...EXTRA_RECIPES]`
- Consumed by: CookScreen (Avo chat), PlanScreen (meal plan), Avo daily briefing

## Recipe schema

```ts
{
  id: string;              // br1–br180
  name: string;
  description: string;
  cookTime: number;        // minutes, total
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  ingredients: { name, amount, fromPantry }[];
  steps: string[];
  savingsEstimate: number; // dollars
  tags: string[];          // meal type + dietary + style
}
```

## Tag taxonomy

**Meal type:** `breakfast`, `lunch`, `dinner`, `snack`
**Speed:** `quick` (≤15 min), `easy`, `medium`, `hard`
**Dietary:** `vegetarian`, `vegan`, `dairy-free`, `gluten-free`, `healthy`, `high-protein`
**Style:** `kid-friendly`, `comfort-food`, `meal-prep`
