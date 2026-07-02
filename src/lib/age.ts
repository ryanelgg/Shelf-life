// Pure age-gate helpers, kept out of the component so the rules are unit-testable.

/** A birth year is valid if it's a 4-digit year between 1900 and this year. */
export function isValidBirthYear(birthYear: number, referenceYear: number): boolean {
  return Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= referenceYear;
}

/**
 * Conservative age check: uses year difference only (we don't collect the full
 * birthdate). Someone born in `referenceYear - minAge` is treated as old enough,
 * which is the lenient edge — acceptable for a 13+ gate.
 */
export function meetsMinimumAge(birthYear: number, minAge: number, referenceYear: number): boolean {
  if (!isValidBirthYear(birthYear, referenceYear)) return false;
  return referenceYear - birthYear >= minAge;
}
