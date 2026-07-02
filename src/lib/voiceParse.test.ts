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
