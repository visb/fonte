import * as Sentry from '@sentry/react';

// Inicializa o Sentry. Sem DSN o SDK fica inerte — dev local não dispara eventos.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
    ],
    // Tracing (performance + web vitals).
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Profiling do browser (relativo às traces amostradas).
    profilesSampleRate: Number(import.meta.env.VITE_SENTRY_PROFILES_SAMPLE_RATE ?? 1.0),
    // Logs estruturados (captura console.error/warn).
    enableLogs: true,
    sendDefaultPii: false,
  });
}
