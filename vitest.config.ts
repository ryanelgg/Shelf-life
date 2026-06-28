import { defineConfig } from 'vitest/config';

// Unit tests run against pure logic (no DOM needed), so the lightweight node
// environment keeps them fast. Add jsdom here later if/when components get tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
