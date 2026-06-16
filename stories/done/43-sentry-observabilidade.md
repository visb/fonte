# Plan: Observabilidade com Sentry — errors, tracing, profiling e logs em todos os apps

> Story de plataforma/observabilidade. Primeira integração de APM no monorepo. Instrumenta os
> 5 runtimes: `services/api` (NestJS), `apps/adm.fonte` + `apps/associados` (React/Vite),
> `apps/ops.fonte` + `apps/app.fonte` (Expo RN). `resident.fonte` não scaffoldado — fora.

## Context

Hoje não há captura centralizada de erro nem visibilidade de performance em produção. Erros de
backend e frontend somem no console. Queremos **Sentry** cobrindo: errors, tracing (performance),
profiling e logs estruturados.

### Decisões do usuário (travadas — 2026-06-16)

- **Sentry SaaS** (sentry.io), não self-hosted.
- **1 projeto/DSN por app** (5 DSNs). Separa quota, alertas, releases e source maps por runtime.
  Projetos: `fonte-api`, `fonte-adm`, `fonte-associados`, `fonte-ops`, `fonte-app`.
- **Usuário cria os projetos no Sentry e passa os DSNs.** Implementação lê DSN de env var; sem DSN
  o SDK fica inerte (não quebra dev local).
- Escopo: **todos os 5 apps nesta story**.

### Caveat — "Metrics"

O produto **Sentry Metrics (beta)** foi descontinuado (sunset out/2024); não existe mais
`Sentry.metrics.increment()`. "Métricas" passam a ser derivadas de **tracing/spans** (duração de
transação, throughput, web vitals) + spans customizados onde fizer sentido. Esta story entrega
métricas por essa via, não pela API morta. (Sem promessa de dashboards de métricas custom.)

### Recursos por SDK

| App | SDK | Errors | Tracing | Profiling | Logs |
|---|---|---|---|---|---|
| api (NestJS) | `@sentry/nestjs` + `@sentry/profiling-node` | ✓ | ✓ | ✓ (nodeProfilingIntegration) | ✓ (`enableLogs`) |
| adm/associados (Vite) | `@sentry/react` + `@sentry/vite-plugin` | ✓ | ✓ (browserTracing) | ✓ exp. (browserProfiling) | ✓ (`enableLogs`) |
| ops/app (Expo RN) | `@sentry/react-native` | ✓ | ✓ (reactNativeTracing) | ✓ (Hermes `profilesSampleRate`) | ✓ (`enableLogs`) |

## Desenho

### Convenções comuns

- DSN sempre via env; nunca hardcoded.
- `environment`: `process.env.NODE_ENV` (api) / `import.meta.env.MODE` (vite) / `__DEV__` (RN).
- `release`: versão do `package.json` (+ git sha quando disponível no CI).
- Sample rates **configuráveis por env** com default conservador: `tracesSampleRate` 0.1 prod /
  1.0 dev; `profilesSampleRate` 1.0 (relativo às traces amostradas).
- `enableLogs: true` em todos; capturar `console.error`/`warn` via integração de console-logs.
- Em dev, SDK só inicializa se DSN presente (evita ruído e custo).

### 1. Backend — `services/api`

- Deps: `@sentry/nestjs`, `@sentry/profiling-node`.
- Criar `src/instrument.ts` com `Sentry.init({ dsn, integrations:[nodeProfilingIntegration()],
  tracesSampleRate, profilesSampleRate, enableLogs })`. **Importado na primeiríssima linha** de
  `src/main.ts` (antes de qualquer outro import que toque o app) — requisito do auto-instrument.
- `app.module.ts`: importar `SentryModule.forRoot()` no topo dos imports.
- Filtro global de erro: `SentryGlobalFilter` via `APP_FILTER` (captura exceptions não tratadas
  preservando o comportamento atual do Nest).
- Env: `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`,
  `SENTRY_ENVIRONMENT` (fallback p/ NODE_ENV). Adicionar em `.env`, `.env.example`, `.env.test`
  (test sem DSN).
- Logs: expor uso de `Sentry.logger.*` onde já logamos erros relevantes (não varrer tudo agora;
  ligar a integração e deixar `console.error` fluir).

### 2. Web — `apps/adm.fonte` e `apps/associados` (idêntico nos dois)

- Deps: `@sentry/react`, `@sentry/vite-plugin` (dev dep, só p/ upload de source maps no build).
- `Sentry.init` em `src/main.tsx` antes do `createRoot`: integrações `browserTracingIntegration()`,
  `browserProfilingIntegration()`; `tracesSampleRate`, `profilesSampleRate`, `enableLogs`,
  `sendDefaultPii:false`.
- Error boundary: envolver `<App/>` com `Sentry.ErrorBoundary` (fallback = tela de erro amigável).
- `vite.config`: plugin `sentryVitePlugin({ org, project, authToken: env })` + `build.sourcemap:
  true`. authToken só no CI/build (`SENTRY_AUTH_TOKEN`), nunca commitado.
- Env (`.env.example`): `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`,
  `VITE_SENTRY_PROFILES_SAMPLE_RATE`. Build: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

### 3. Mobile — `apps/ops.fonte` e `apps/app.fonte` (Expo Router)

- Dep: `@sentry/react-native`. Config plugin no `app.json` (`@sentry/react-native/expo`) p/ upload
  de source maps via EAS.
- `Sentry.init` no `app/_layout.tsx` (root) antes do render: `reactNativeTracingIntegration()`,
  `enableLogs`, `tracesSampleRate`, `_experiments: { profilesSampleRate }` (Hermes).
- Envolver o root layout export com `Sentry.wrap(...)`.
- DSN via `EXPO_PUBLIC_SENTRY_DSN` (lido em runtime). Demais sample rates idem via `EXPO_PUBLIC_*`.
- Adicionar `.env.example` nos dois apps (hoje só têm `.env.test`).

### 4. Documentação

- Atualizar `CLAUDE.md` (seção curta) ou criar skill/doc apontando: como obter DSN, env vars por
  app, como ligar/desligar em dev.
- **`fonte-api.postman_collection.json`**: não há endpoint novo → sem mudança.

## Validação

- `pnpm build:api` compila com `instrument.ts` importado primeiro.
- `pnpm test:api` verde (SDK inerte sem DSN no `.env.test`).
- `pnpm build:adm` e `pnpm --filter associados build` compilam com vite plugin (source maps gerados;
  upload pulado sem authToken).
- ops/app: `pnpm --filter ops.fonte exec tsc -b --noEmit` (ou lint) sem erro de tipo no init.
- Smoke manual com DSN real: disparar erro de teste em cada app e confirmar evento + trace no
  Sentry. (Depende dos DSNs do usuário; marcar como passo pós-merge se DSNs ainda não vieram.)

## Fora de escopo

- `resident.fonte` (não scaffoldado).
- Alertas, dashboards e regras de sampling fino no painel Sentry (config de produto, não código).
- Session Replay (pode entrar em story futura; aumenta payload/custo).
- Instrumentação manual exaustiva de spans custom — só o auto-instrument + 1-2 spans de exemplo.
- API de Metrics descontinuada.
- CI: criação dos secrets `SENTRY_AUTH_TOKEN` no pipeline (usuário configura; código já lê env).
