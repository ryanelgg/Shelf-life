import { describe, it, expect } from 'vitest';
import { parseInviteCode, buildInviteUrl } from './inviteCode';

describe('parseInviteCode', () => {
  it('accepts a raw code', () => {
    expect(parseInviteCode('ABC123')).toBe('ABC123');
  });

  it('uppercases and strips separators', () => {
    expect(parseInviteCode('abc-123')).toBe('ABC123');
  });

  it('extracts from a share URL with a code param', () => {
    expect(parseInviteCode('https://usepantre.me/join?code=ABC123')).toBe('ABC123');
  });

  it('round-trips the generated invite URL', () => {
    expect(parseInviteCode(buildInviteUrl('XYZ789'))).toBe('XYZ789');
  });

  it('extracts from a scheme form', () => {
    expect(parseInviteCode('PANTRE:ABC123')).toBe('ABC123');
  });

  it('returns null for empty / nullish input', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode(null)).toBeNull();
    expect(parseInviteCode(undefined)).toBeNull();
  });

  it('returns null for text that is too short to be a code', () => {
    expect(parseInviteCode('AB')).toBeNull();
  });

  it('returns null for a long non-code URL with no code param', () => {
    expect(parseInviteCode('https://example.com/some/really/long/marketing/pagexyz')).toBeNull();
  });
});
