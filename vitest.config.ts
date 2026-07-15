import { defineConfig } from 'vitest/config';

// Standalone Vitest config so the test run doesn't pull in the full app
// vite.config.ts (Capacitor/PWA plugins etc.). Unit tests here mock Supabase
// and run in a plain node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
