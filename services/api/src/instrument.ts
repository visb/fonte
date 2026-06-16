// Sentry — DEVE ser importado antes de qualquer outro módulo do app (ver main.ts).
// O auto-instrument do @sentry/nestjs depende de carregar antes do Nest/Express.
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

// Sem DSN o SDK fica inerte — dev local e testes não disparam eventos.
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    integrations: [nodeProfilingIntegration()],
    // Tracing (performance). Default conservador em prod; sobrescrito por env.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Profiling relativo às traces amostradas.
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 1.0),
    // Logs estruturados (captura console.error/warn como logs).
    enableLogs: true,
    sendDefaultPii: false,
  });
}
