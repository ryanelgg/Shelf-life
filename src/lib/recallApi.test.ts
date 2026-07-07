import { describe, it, expect } from 'vitest';
import { matchRecalls, type FdaResult } from './recallApi';

function recall(product_description: string, extra: Partial<FdaResult> = {}): FdaResult {
  return {
    recall_number: `R-${product_description.slice(0, 6)}`,
    product_description,
    reason_for_recall: 'Undeclared allergen',
    recalling_firm: 'Test Foods Inc',
    status: 'Ongoing',
    ...extra,
  };
}

describe('matchRecalls (tightened FDA matching)', () => {
  it('does NOT match on a single generic word', () => {
    const recalls = [recall('Lactaid Whole Milk, 1 gallon')];
    expect(matchRecalls(recalls, ['Milk'])).toHaveLength(0);
    expect(matchRecalls(recalls, ['Chicken'])).toHaveLength(0);
    expect(matchRecalls([recall('Fresh Store-Baked Bread')], ['Bread'])).toHaveLength(0);
  });

  it('matches on a distinctive (non-generic) word', () => {
    const recalls = [recall('Dole Baby Spinach 10oz clamshell')];
    const m = matchRecalls(recalls, ['Spinach']);
    expect(m).toHaveLength(1);
    expect(m[0].matchedItem).toBe('Spinach');
  });

  it('matches when two words overlap even if each is generic', () => {
    const recalls = [recall('Almond Milk, unsweetened, 64 fl oz')];
    expect(matchRecalls(recalls, ['Almond Milk'])).toHaveLength(1);
  });

  it('folds plurals so "Bananas" matches a "banana" recall', () => {
    const recalls = [recall('Organic banana bunch')];
    expect(matchRecalls(recalls, ['Bananas'])).toHaveLength(1);
  });

  it('matches on a brand name the user typed', () => {
    const recalls = [recall('Jif Creamy Peanut Butter 16oz')];
    // "peanut" is distinctive → real match
    expect(matchRecalls(recalls, ['Peanut Butter'])).toHaveLength(1);
  });

  it('returns nothing when there is no meaningful overlap', () => {
    const recalls = [recall('Cantaloupe whole melon')];
    expect(matchRecalls(recalls, ['Milk', 'Bread', 'Yogurt'])).toHaveLength(0);
  });

  it('reports at most one match per recall', () => {
    const recalls = [recall('Dole Spinach and Kale blend')];
    const m = matchRecalls(recalls, ['Spinach', 'Kale']);
    expect(m).toHaveLength(1);
  });
});
