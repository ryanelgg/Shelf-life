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

describe('parseVoiceItems item splitting', () => {
  it('splits a real list on "and"', () => {
    const items = parseVoiceItems('add milk and eggs', TODAY);
    expect(items.map(i => i.name.toLowerCase())).toEqual(['milk', 'eggs']);
  });

  it('keeps compound food names together (regression: "mac and cheese")', () => {
    const items = parseVoiceItems('add mac and cheese', TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]!.name.toLowerCase()).toContain('mac and cheese');
  });

  it('handles a compound name inside a longer list', () => {
    const items = parseVoiceItems('milk, mac and cheese and bread', TODAY);
    const names = items.map(i => i.name.toLowerCase());
    expect(names).toContain('milk');
    expect(names).toContain('bread');
    expect(names.some(n => n.includes('mac and cheese'))).toBe(true);
    expect(items).toHaveLength(3);
  });
});
