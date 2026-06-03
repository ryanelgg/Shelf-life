// Dev-only logging helpers. In production builds (npm run build) every call
// here is a no-op, so we can leave diagnostic logging in the codebase without
// shipping noise to users' devices.
//
// Use these instead of console.* directly:
//   import { log, warn, error } from './debug';
//   log('[auth] something happened', x);
//
// `error` is always live — unexpected exceptions should surface even in prod
// (and one day route to a real error tracker like Sentry).

const isDev = import.meta.env.DEV;

const noop = (): void => { /* stripped in prod */ };

export const log: (...args: unknown[]) => void = isDev
  ? console.log.bind(console)
  : noop;

export const warn: (...args: unknown[]) => void = isDev
  ? console.warn.bind(console)
  : noop;

// Errors are always logged — they represent unexpected failures and we want
// visibility even after release.
export const error: (...args: unknown[]) => void = console.error.bind(console);
