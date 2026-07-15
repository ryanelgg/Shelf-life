import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { Capacitor } from "@capacitor/core";
import posthog from 'posthog-js';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'

// Sentry init is wrapped in try/catch — the Capacitor wrapper can fail on the
// open web (no native bridge), and a Sentry failure must never crash the app.
try {
  const sentryConfig = {
    dsn: "https://ad598e37653f4a0efb8f5688531d9631@o4511508268449792.ingest.us.sentry.io/4511508282146816",
    environment: import.meta.env.MODE,
    release: `pantre@${import.meta.env.VITE_APP_VERSION}`,
    tracesSampleRate: 0.2,
    enabled: import.meta.env.PROD,
  };
  if (Capacitor.isNativePlatform()) {
    // Native iOS/Android — use the Capacitor wrapper for native crash reporting.
    Sentry.init(sentryConfig, SentryReact.init);
  } else {
    // Plain web (Cloudflare Pages, dev server) — pure React Sentry.
    SentryReact.init(sentryConfig);
  }
} catch (err) {
  // Sentry can't tell us about Sentry's own failure, so log to console once.
  console.error('Sentry init failed:', err);
}

try {
  posthog.init('phc_qqS9Vz4xTbWKasnQb3b2HjYNTa3PuMDDj3SXeBg8bZTb', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    session_recording: {
      maskAllInputs: true,
    },
  });
} catch (err) {
  console.error('PostHog init failed:', err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryReact.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <App />
    </SentryReact.ErrorBoundary>
  </StrictMode>,
)
