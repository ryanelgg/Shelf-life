import { describe, it, expect } from 'vitest';
import { parseVoiceItems } from './voiceParse';

// Fixed "today" so offsets are deterministic.
const TODAY = new Date(2026, 6, 2); // 2026-07-02 (local)

function expOf(transcript: string): string | undefined {
  const parsed = parseVoiceItems(transcript, TODAY);
  return parsed[0]?.expirationDate;
}

describe('parseVoiceItems date parsing', () => {
  it('"in 0 days" means today (regression: used to map to 1 day)', () => {
    expect(expOf('milk in 0 days')).toBe('2026-07-02');
  });

  it('"in 3 days" adds three days', () => {
    expect(expOf('milk in 3 days')).toBe('2026-07-05');
  });

  it('"tomorrow" is +1 day', () => {
    expect(expOf('bread tomorrow')).toBe('2026-07-03');
  });

  it('number words still work ("in two days")', () => {
    expect(expOf('eggs in two days')).toBe('2026-07-04');
  });

  it('"this week" is +7 days (regression: only "a/next week" parsed before)', () => {
    expect(expOf('milk this week')).toBe('2026-07-09');
  });

  it('"this month" is +30 days', () => {
    expect(expOf('milk this month')).toBe('2026-08-01');
  });

  it('"this week" does not pollute the item name', () => {
    const items = parseVoiceItems('add milk this week', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].name.toLowerCase()).toBe('milk');
  });
});

describe('parseVoiceItems compound foods', () => {
  it('keeps "mac and cheese" as a single item', () => {
    const items = parseVoiceItems('add mac and cheese', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].name.toLowerCase()).toBe('mac and cheese');
  });

  it('strips a repeated lead command per segment (regression: "add eggs" named "Add Eggs")', () => {
    const items = parseVoiceItems('add milk and add eggs', TODAY);
    const names = items.map(i => i.name.toLowerCase());
    expect(names).toContain('milk');
    expect(names).toContain('eggs');
    expect(names).not.toContain('add eggs');
  });

  it('keeps a compound together while still splitting real separate items', () => {
    const items = parseVoiceItems('milk, chips and salsa and 2 eggs', TODAY);
    const names = items.map(i => i.name.toLowerCase());
    expect(names).toContain('milk');
    expect(names).toContain('chips and salsa');
    expect(names).toContain('eggs');
    expect(items).toHaveLength(3);
  });

  it('still splits a plain "and" between two foods', () => {
    const items = parseVoiceItems('bread and milk', TODAY);
    expect(items.map(i => i.name.toLowerCase())).toEqual(['bread', 'milk']);
  });
});

describe('parseVoiceItems quantity words (regression)', () => {
  it('"a couple apples" is 2 apples, not 1 "Couple Apples"', () => {
    const items = parseVoiceItems('a couple apples', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    expect(items[0].name.toLowerCase()).toBe('apples');
  });

  it('"a few bananas" is 3 bananas, not 1 "Few Bananas"', () => {
    const items = parseVoiceItems('add a few bananas', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(items[0].name.toLowerCase()).toBe('bananas');
  });

  it('"couple apples" (no article) still parses as 2', () => {
    const items = parseVoiceItems('couple apples', TODAY);
    expect(items[0].quantity).toBe(2);
    expect(items[0].name.toLowerCase()).toBe('apples');
  });

  it('"a dozen eggs" stays 1 × dozen (dozen is a unit, not a count here)', () => {
    const items = parseVoiceItems('a dozen eggs', TODAY);
    expect(items[0].quantity).toBe(1);
    expect(items[0].unit).toBe('dozen');
    expect(items[0].name.toLowerCase()).toBe('eggs');
  });

  it('a plain article "a banana" is still 1 banana', () => {
    const items = parseVoiceItems('a banana', TODAY);
    expect(items[0].quantity).toBe(1);
    expect(items[0].name.toLowerCase()).toBe('banana');
  });
});

describe('parseVoiceItems weekday false-matches (regression)', () => {
  it('does not read "mon" out of "salmon"', () => {
    const items = parseVoiceItems('add salmon', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].name.toLowerCase()).toBe('salmon');
    expect(items[0].expirationDate).toBeUndefined();
  });

  it('does not corrupt "cinnamon"', () => {
    const items = parseVoiceItems('add cinnamon', TODAY);
    expect(items[0].name.toLowerCase()).toBe('cinnamon');
    expect(items[0].expirationDate).toBeUndefined();
  });

  it('still parses a real weekday', () => {
    // 2026-07-02 is a Thursday; "friday" is the next day.
    expect(parseVoiceItems('milk friday', TODAY)[0].expirationDate).toBe('2026-07-03');
  });

  it('does not read "sun" (→ Sunday) out of "sun-dried tomatoes"', () => {
    const items = parseVoiceItems('add sun-dried tomatoes', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].name.toLowerCase()).toBe('sun-dried tomatoes');
    expect(items[0].expirationDate).toBeUndefined();
  });
});

describe('parseVoiceItems name integrity (regression: name corruption)', () => {
  it('keeps "half and half" as one item, not "Half" + "Half"', () => {
    const items = parseVoiceItems('add half and half', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].name.toLowerCase()).toBe('half and half');
  });

  it('does not drop load-bearing "extra"/"fresh" from product names', () => {
    // "extra" was filler → "extra virgin olive oil" became "Virgin Olive Oil".
    expect(parseVoiceItems('add extra virgin olive oil', TODAY)[0].name.toLowerCase())
      .toBe('extra virgin olive oil');
    expect(parseVoiceItems('add fresh mozzarella', TODAY)[0].name.toLowerCase())
      .toBe('fresh mozzarella');
  });

  it('still splits a genuine two-item "X and Y" utterance', () => {
    const items = parseVoiceItems('add milk and eggs', TODAY);
    expect(items).toHaveLength(2);
  });
});
