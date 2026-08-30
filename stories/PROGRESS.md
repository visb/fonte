# PROGRESS — ledger ativo

Rodada de autorun **191–192** — aberta em 2026-08-30.

## Config da rodada

- **Tema:** observabilidade da API — custo por requisição (CPU, memória, queries) instrumentado no
  backend e lido numa tela ADMIN do `adm.fonte`.
- **Ordem:** 191 → 192
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** 191 → 192. A 192 consome `GET /observability/stats` e o módulo
  `observability` do `@fonte/api-client`, ambos entregues pela 191. **Se 191 bloquear, 192 bloqueia
  junto** — não pular para a 192.
- **Escopo técnico por story:**
  - **191** — `services/api/src/common/observability/` (middleware + AsyncLocalStorage, TypeORM
    `QueryLogger`, `MetricsStore` in-memory, `RuntimeService` com `monitorEventLoopDelay`,
    controller com health/stats/reset), `app.module.ts`, `config/database.config.ts`,
    `.env.example`, atributos de span no Sentry, `packages/api-client` (tipos + módulo + export),
    Postman. **Sem migration, sem `packages/types`.**
  - **192** — `apps/adm.fonte/src/features/observability/` (hooks, `RuntimeCards`,
    `RouteCostTable` + row, `RecentRequestsTable` + row, `constants.ts`, `utils.ts`, page),
    `lib/queryKeys.ts`, `App.tsx`, `components/layout/AppLayout.tsx`, `e2e/observability.spec.ts`.
    **Frontend-only** — se faltar dado, volta para a 191, não se remenda no front.
- **Cuidados da rodada:**
  - **Contratos:** 191 mexe em `packages/api-client` → `pnpm build:api-client` **antes** de subir
    API/adm e antes de qualquer gate da 192. `packages/types` não muda.
  - **Postman obrigatório** na 191: três rotas novas (`GET /observability/health`,
    `GET /observability/stats`, `POST /observability/reset`).
  - **Sentry sem DSN em dev/teste** é inerte por desenho — os testes mockam `@sentry/nestjs`, nunca
    dependem de evento real. Não inventar DSN, não chamar o Sentry de verdade.
  - **API do Sentry v10:** `setMeasurement` está depreciado; conferir contra o pacote instalado e
    usar atributo de span (`getActiveSpan()?.setAttributes`). Se a API divergir do plano, seguir o
    pacote instalado e registrar a nota no commit.
  - **LGPD:** o store não guarda body, query string, IP nem `user_id`; o log de query lenta sai
    **sem parâmetros**. Há asserção explícita disso no plano — não relaxar.
  - **`maxQueryExecutionTime: 1`** em `database.config.ts` não pode reativar o log verboso do
    TypeORM; conferir no boot da API de teste.
  - **Isolamento e2e (story 182):** nenhuma das duas suítes cria ou apaga linha em banco — o reset
    toca só memória. Registrar isso no header dos specs.
  - **Gate de cobertura ≥ 90** no pacote tocado, por story.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 191 — observabilidade da API (backend) | [ ] | | | |
| 2 | 192 — tela de observabilidade no adm.fonte | [ ] | | | |

## Log

```
```

## Resumo final

<vazio até o fim da rodada>
