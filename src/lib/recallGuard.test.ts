import { describe, it, expect } from 'vitest';
import { matchRecalls } from './recallApi';
import type { NormalizedRecall, RecallMatch } from './recallApi';
import { selectNewRecalls } from './recallGuard';

function recall(partial: Partial<NormalizedRecall>): NormalizedRecall {
  return {
    id: partial.id ?? 'r1',
    source: partial.source ?? 'FDA',
    product: partial.product ?? '',
    reason: partial.reason ?? '',
    firm: partial.firm ?? '',
  };
}

describe('matchRecalls', () => {
  it('matches on a significant shared word', () => {
    const matches = matchRecalls(
      ['Whole Milk'],
      [recall({ id: 'x', product: 'Recalled Milk Gallons', source: 'USDA' })],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.matchedItem).toBe('Whole Milk');
    expect(matches[0]!.source).toBe('USDA');
  });

  it('does NOT match on a generic stopword like "oil" (the cry-wolf bug)', () => {
    const matches = matchRecalls(
      ['Olive Oil'],
      [recall({ product: 'Corn Oil — voluntary recall' })],
    );
    expect(matches).toHaveLength(0);
  });

  it('ignores short words (<= 3 chars) so "egg" noise does not over-match', () => {
    const matches = matchRecalls(
      ['Egg'],
      [recall({ product: 'Egg salad sandwiches' })],
    );
    // "egg" is 3 chars → below the significance threshold, so no match here.
    expect(matches).toHaveLength(0);
  });

  it('returns at most one match per recall', () => {
    const matches = matchRecalls(
      ['Spinach', 'Baby Spinach'],
      [recall({ id: 'spin', product: 'Fresh Spinach clamshells' })],
    );
    expect(matches).toHaveLength(1);
  });

  it('returns [] when nothing matches', () => {
    expect(matchRecalls(['Bananas'], [recall({ product: 'Ground Beef' })])).toEqual([]);
  });
});

describe('selectNewRecalls', () => {
  const m = (id: string): RecallMatch => ({
    id,
    productDescription: 'p',
    reason: 'r',
    recallingFirm: 'f',
    matchedItem: 'item',
    source: 'FDA',
  });

  it('drops already-notified recalls', () => {
    const fresh = selectNewRecalls([m('a'), m('b'), m('c')], ['b']);
    expect(fresh.map(x => x.id)).toEqual(['a', 'c']);
  });

  it('de-dupes repeated ids within one run', () => {
    const fresh = selectNewRecalls([m('a'), m('a'), m('b')], []);
    expect(fresh.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('returns [] when everything is already known', () => {
    expect(selectNewRecalls([m('a'), m('b')], ['a', 'b'])).toEqual([]);
  });
});
