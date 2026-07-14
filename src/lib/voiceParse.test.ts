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
});
