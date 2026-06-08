import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import posthog from 'posthog-js';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'

Sentry.init({
  dsn: "https://ad598e37653f4a0efb8f5688531d9631@o4511508268449792.ingest.us.sentry.io/4511508282146816",
  environment: import.meta.env.MODE,
  release: `pantre@${import.meta.env.VITE_APP_VERSION}`,
  tracesSampleRate: 0.2,
  enabled: import.meta.env.PROD,
}, SentryReact.init);

posthog.init('phc_qqS9Vz4xTbWKasnQb3b2HjYNTa3PuMDDj3SXeBg8bZTb', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  session_recording: {
    maskAllInputs: true,
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryReact.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <App />
    </SentryReact.ErrorBoundary>
  </StrictMode>,
)
