import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore build output, native projects, and the Obsidian vault. The vault
  // ships a bundled plugin `main.js` with inline eslint-disable comments for
  // rules we don't load, which otherwise floods `npm run lint` with spurious
  // errors that have nothing to do with app source.
  globalIgnores(['dist', 'android', 'ios', 'SHELF LIFE']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow intentionally-unused args/vars prefixed with `_` (e.g. notification
      // copy builders that take a name they don't use in that variant).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
])
