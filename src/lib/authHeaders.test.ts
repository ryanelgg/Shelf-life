import { describe, it, expect } from 'vitest';
import { NotSignedInError } from './authHeaders';

describe('NotSignedInError', () => {
  it('carries a user-safe default message', () => {
    expect(new NotSignedInError().message).toBe('Please sign in to use Avo.');
  });

  it('is tagged friendly so the Avo chat catch shows the message verbatim', () => {
    // The CookScreen catch shows err.message when `friendly` is truthy, and
    // otherwise falls through to a generic "connection" error. A guest hitting
    // Ask Avo must get the sign-in prompt, not the generic message.
    const err = new NotSignedInError();
    expect((err as Error & { friendly?: boolean }).friendly).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotSignedInError');
  });
});
