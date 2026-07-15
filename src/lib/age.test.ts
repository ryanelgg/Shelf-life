import { describe, it, expect } from 'vitest';
import { isValidBirthYear, meetsMinimumAge } from './age';

const NOW = 2026;

describe('isValidBirthYear', () => {
  it('accepts a plausible 4-digit year', () => {
    expect(isValidBirthYear(2005, NOW)).toBe(true);
  });
  it('rejects future years, ancient years, and non-integers', () => {
    expect(isValidBirthYear(2030, NOW)).toBe(false);
    expect(isValidBirthYear(1800, NOW)).toBe(false);
    expect(isValidBirthYear(NaN, NOW)).toBe(false);
    expect(isValidBirthYear(20.5, NOW)).toBe(false);
  });
});

describe('meetsMinimumAge (13+)', () => {
  it('lets through someone comfortably over 13', () => {
    expect(meetsMinimumAge(2000, 13, NOW)).toBe(true);
  });
  it('lets through someone turning exactly 13 this year', () => {
    expect(meetsMinimumAge(2013, 13, NOW)).toBe(true);
  });
  it('blocks someone under 13', () => {
    expect(meetsMinimumAge(2015, 13, NOW)).toBe(false);
  });
  it('blocks an invalid year', () => {
    expect(meetsMinimumAge(2099, 13, NOW)).toBe(false);
  });
});
