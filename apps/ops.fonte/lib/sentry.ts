import * as Sentry from '@sentry/react-native';

// Inicializa o Sentry. Sem DSN o SDK fica inerte — dev local não dispara eventos.
// No build web (react-native-web) os recursos nativos (profiling Hermes, crash
// nativo) viram no-op; errors e tracing seguem via fallback browser.
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    integrations: [Sentry.reactNativeTracingIntegration()],
    // Tracing (performance).
    tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    _experiments: {
      // Logs estruturados.
      enableLogs: true,
      // Profiling via Hermes (relativo às traces amostradas).
      profilesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE ?? 1.0),
    },
  });
}
