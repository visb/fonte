# PROGRESS — rodada 191–192 (encerrada)

Rodada de autorun **191–192** — aberta e encerrada em 2026-08-30.

## Config da rodada

- **Tema:** observabilidade da API — custo por requisição (CPU, memória, queries) instrumentado no
  backend e lido numa tela ADMIN do `adm.fonte`.
- **Ordem:** 191 → 192
- **Branch base:** `main` (cada branch partiu da `main` já com o merge da story anterior).
- **Deps rígidas:** 191 → 192 (a 192 consome `GET /observability/stats` e o módulo `observability`
  do `@fonte/api-client`). Não chegou a ser exercitada: 191 fechou verde.
- **Cuidados da rodada:** contratos (`build:api-client` antes dos gates), Postman obrigatório na
  191, Sentry inerte/mockado nos testes, LGPD (nada de body/query/IP/user_id no store; log de query
  lenta sem parâmetros), `maxQueryExecutionTime: 1` sem reativar log verboso do TypeORM, cap de
  cardinalidade, isolamento e2e da story 182, gate de cobertura ≥ 90.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 191 — observabilidade da API (backend) | [OK] | api 1739 · e2e 592 · cov 98,75% | `bd277af` | `29795a4` |
| 2 | 192 — tela de observabilidade no adm.fonte | [OK] | unit 1707 · e2e 189 · cov 93,5% | `32a69f2` | `b17e3b9` |

## Log

```
[OK] 191 — testes: test:api 1739/1739, e2e 592/592, cov common/observability 98,75% stmts — commit: bd277af — merge: 29795a4 — 2026-08-30
     Sentry v10: setMeasurement não existe mais; usado getActiveSpan().setAttributes (conferido no pacote instalado).
     Nota p/ 192: stats devolve também startedAt (início da janela do agregado).

[OK] 192 — testes: test:adm:unit 1707/1707, test:adm 189/189, cov adm 93,5% stmts — commit: 32a69f2 — merge: b17e3b9 — 2026-08-30
     Contrato real da 191 mandou: runtime.memory já vem em MB (sem conversão de bytes na tela).
     E2E do "não-ADMIN logado" é COORDINATOR — SERVANT nem autentica no adm.
```

## Resumo final

**Ambas as stories entregues, verdes e mergeadas na `main` local. Nenhum bloqueio, nenhum
PENDENTE-MANUAL. Sem push, sem PR** (branches preservadas).

### O que passou a existir

- **191 — backend.** `services/api/src/common/observability/`: middleware Express (não interceptor —
  interceptor não enxerga requisição barrada por guard) abrindo `AsyncLocalStorage` e fechando em
  `res.on('finish')` com `durationMs`, `cpuMs`, `heapDeltaKb`; `QueryLogger` do TypeORM contando
  queries e somando tempo; `MetricsStore` in-memory (somas + histograma de buckets fixos para
  p50/p95 a memória constante, ring buffer circular, cap de rotas com bucket `OTHER`);
  `RuntimeService` com `monitorEventLoopDelay`; controller com `GET /observability/health`
  (público, magro), `GET /observability/stats` e `POST /observability/reset` (ADMIN). Atributos de
  span no Sentry + `captureMessage` de requisição lenta com rate limit por rota/minuto. Contrato no
  `@fonte/api-client` e Postman atualizados.
- **192 — tela.** `/observabilidade` no `adm.fonte` (ADMIN): `RuntimeCards` (event loop lag, memória,
  CPU, uptime), `RouteCostTable` ordenável por p95/CPU/queries com marcação de N+1 (> 20 queries
  médias) e de lentidão (p95 > 1000 ms), `RecentRequestsTable`, botão de zerar contadores, aviso
  permanente de que o agregado morre no restart e o histórico é o Sentry.

### Desvios deliberados do plano (documentados nos commits)

- **191:** `logQueryError` loga sem contador próprio (contador que nenhuma tela leria seria dado
  morto; a query com erro já entrou em `dbQueries`); `stats` devolve também `startedAt`, sem o qual
  a tela não sabe desde quando o agregado vale.
- **192:** `runtime.memory` já chega em MB, então não há conversão de bytes na tela; o corte de
  alerta de RSS é threshold de UI (`RSS_ALERT_MB`) porque o payload não expõe o limite do container;
  o caso e2e de "não-ADMIN logado" é COORDINATOR, já que SERVANT sequer autentica no `adm.fonte`.

### Observações para stories futuras

- O `QueryLogger` **tornou visível** um erro antes silencioso: `query error ... Connection
  terminated :: INSERT INTO "audit_logs"` aparece 3× durante `pnpm test:api:e2e`. É corrida
  pré-existente entre o audit log fire-and-forget e o `app.close()` da suíte — não é regressão
  (592/592 passam). Corrigir é story própria.
- `e2e/receipts.spec.ts:93` falhou uma vez por flake pré-existente de PDF/Puppeteer; passou isolado
  e na bateria final. Sem relação com a rodada.
- A verificação manual dos planos (20× `GET /residents` caçando N+1, p99 do event loop depois de um
  PDF, atributos no painel do Sentry) depende de DSN configurado e de uso real — fica para quando a
  API subir em produção.

### Comandos para reproduzir os gates

```
pnpm build:types && pnpm build:api-client
pnpm docker:up && pnpm test:setup
pnpm dev:api:test                      # 3001
pnpm --filter adm.fonte dev:test       # 5174
pnpm test:api
pnpm test:api:e2e
pnpm test:api:cov
pnpm test:adm:unit
pnpm test:adm
```
