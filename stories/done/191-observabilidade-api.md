# Plan: Observabilidade da API — custo por requisição (backend)

> Story irmã: **192 — tela `/observabilidade` no `adm.fonte`**, que consome o
> `GET /observability/stats` desta story. 191 entrega a instrumentação e a API; 192 entrega a tela.
> 192 não começa antes de 191 fechar (depende do contrato no `@fonte/api-client`).

## Context

Hoje a única observabilidade do backend é o Sentry (story 43): erros, tracing amostrado a 10% e
profiling. Isso responde "o que quebrou", mas **não** responde a pergunta que o usuário fez:
*quanto custa, em processamento e memória, cada requisição a determinado endpoint*. Não há health
endpoint, não há contagem de queries por requisição, não há visão de custo por rota.

O contexto de execução aperta a resposta: a API roda num VPS Hostinger de **1 vCPU**
(`docker-compose.prod.yml`), que nem compila o monorepo. Stack de observabilidade auto-hospedada
(Prometheus + Grafana no host) está descartada por custo de CPU/RAM.

### Decisões do usuário

1. **Sentry é o backend de histórico e alerta.** O custo por requisição vira atributo do span
   (`cpu_ms`, `db_queries`, `db_ms`, `heap_delta_kb`), então a visão histórica, o p95 por
   transação e os alertas saem do que já está pago e configurado.
2. **A tela do adm é a janela viva do processo**, não um dashboard histórico: agregado por rota
   desde o boot + últimas N requisições + saúde do runtime, tudo em memória. Zero persistência,
   zero tabela nova, zero dependência nova.
3. **Sem `prom-client`, sem `/metrics` em formato Prometheus.** Se um dia entrar scrape externo,
   o `MetricsStore` desta story já é a fonte — o formato Prometheus vira um `@Get` a mais.
4. **Escopo desta story: backend.** A tela do adm sai na story 192 — a instrumentação tem valor
   sozinha (Sentry + `curl` no endpoint) e as duas juntas não fecham numa rodada.

### Por que middleware Express e não interceptor Nest

Um `NestInterceptor` roda **depois** dos guards e **não roda** quando um guard rejeita. Requisição
barrada por `JwtAuthGuard`/`RolesGuard`/`ThrottlerGuard` — justamente o tipo de tráfego que
interessa medir sob suspeita de abuso — ficaria invisível. Um middleware Express envolve a cadeia
inteira (guards, pipes, handler, serialização, exception filter) e fecha em `res.on('finish')`.

O mesmo middleware abre o `AsyncLocalStorage`, que precisa estar ativo já no primeiro guard: o
`JwtAuthGuard` consulta o banco, e essa query conta como custo da requisição.

### Limitação conhecida de `db_ms`

O TypeORM entrega duração de query **só** no callback `logQuerySlow`, gatilhado por
`maxQueryExecutionTime`. Com `maxQueryExecutionTime: 1`, toda query de **≥1ms** reporta tempo;
queries sub-milissegundo entram na contagem (`db_queries`, via `logQuery`) mas não na soma
(`db_ms`). É trade-off aceito: o sintoma que importa — N+1 — aparece na **contagem**, e o tempo
perdido nas sub-ms é ruído. Documentar isso no código, não deixar o leitor achar que `db_ms` é
soma exata.

---

## Desenho

### 1. `services/api/src/common/observability/` (módulo novo)

```
common/observability/
  request-context.ts        ← AsyncLocalStorage + tipo do store
  route-name.ts             ← normalização de rota (anti-cardinalidade)
  metrics.store.ts          ← agregado por rota + ring buffer (in-memory)
  observability.middleware.ts
  query-logger.ts           ← TypeORM Logger custom
  runtime.service.ts        ← event loop lag, memória, cpu, uptime
  observability.controller.ts
  observability.module.ts
```

#### `request-context.ts`

```ts
export interface RequestStore {
  requestId: string;
  dbQueries: number;
  dbMs: number;
  slowQueries: number;
}
export const requestContext = new AsyncLocalStorage<RequestStore>();
```

O store é mutável de propósito: o `query-logger` incrementa campos sem re-`run`.
`requestContext.getStore()` devolvendo `undefined` (scheduler, seed, boot) **nunca** pode lançar —
todo consumidor trata a ausência como no-op.

#### `route-name.ts`

Cardinalidade é o modo de falha clássico deste tipo de coletor: `/residents/<uuid>` como chave
distinta transforma o `Map` em vazamento de memória.

- Preferir o padrão da rota do Express, disponível em `res.on('finish')`:
  `req.baseUrl + req.route.path` → `/api/v1/residents/:id`.
- Sem `req.route` (404, rota estática, requisição barrada antes do roteador): cair no `req.path`
  **normalizado** — segmento que casa UUID v4, número puro ou hash hex vira `:id`.
- Query string sempre descartada.
- Chave final: `` `${method} ${path}` `` (ex.: `GET /api/v1/residents/:id`).

#### `metrics.store.ts`

Provider `@Injectable()`, singleton, sem I/O.

- **Por rota:** `count`, `errors` (status ≥ 400), `sumDurationMs`, `maxDurationMs`, `sumCpuMs`,
  `sumDbQueries`, `sumDbMs`, `sumHeapDeltaKb`, `lastAt`, e um **histograma de buckets fixos**
  (`5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, +Inf` ms) para p50/p95 aproximados a memória
  constante. Nada de guardar todas as amostras.
- **Cap de cardinalidade:** máximo de 300 rotas distintas (`OBSERVABILITY_MAX_ROUTES`); ao estourar,
  tudo cai num bucket `OTHER`. Trava de segurança sobre a normalização.
- **Ring buffer:** últimas 200 requisições (`OBSERVABILITY_RECENT_SIZE`) com
  `{ requestId, method, route, status, durationMs, cpuMs, dbQueries, dbMs, heapDeltaKb, at }`.
  Array de tamanho fixo com índice circular — sem `shift()`.
- `reset()` exposto para o teste e para um `POST /observability/reset` (ADMIN), útil para medir
  uma janela específica sem reiniciar a API.

> **Sem dado pessoal no store.** Nem `body`, nem query string, nem `user_id`, nem IP. Só rota
> normalizada, status e números. Isso mantém a tela fora do escopo de tratamento de dados pessoais
> (LGPD) e o ring buffer inofensivo em memória.

#### `observability.middleware.ts`

Aplicado a todas as rotas via `configure(consumer)` no `ObservabilityModule` (`NestModule`).

Na entrada: gera `requestId` (`randomUUID`), guarda `process.hrtime.bigint()`,
`process.cpuUsage()`, `process.memoryUsage().heapUsed`, e envolve o `next()` em
`requestContext.run(store, next)`. Escreve o `requestId` no header de resposta
(`X-Request-Id`) — é o que cola o log da API ao evento no Sentry.

Em `res.on('finish')`:

1. Calcula `durationMs`, `cpuMs` (`user + system` do delta, em ms), `heapDeltaKb`.
2. `metricsStore.record({...})`.
3. Anexa ao span ativo do Sentry:
   `Sentry.getActiveSpan()?.setAttributes({ 'fonte.cpu_ms': …, 'fonte.db_queries': …, 'fonte.db_ms': …, 'fonte.heap_delta_kb': …, 'fonte.request_id': … })`.
   Conferir a API contra o `@sentry/nestjs` **instalado** (v10) antes de escrever —
   `setMeasurement` está depreciado no v10; o caminho atual é atributo de span.
4. **Log estruturado** (uma linha JSON via `Logger` do Nest): por padrão só para status ≥ 400 **ou**
   `durationMs > OBSERVABILITY_SLOW_REQUEST_MS` (default 1000). `OBSERVABILITY_LOG_REQUESTS=true`
   loga todas. Em 1 vCPU, logar toda requisição por padrão é custo de I/O sem retorno.
5. Requisição acima do threshold de lentidão dispara `Sentry.captureMessage('slow request', …)`
   com os números no contexto — **com rate limit próprio** (no máximo 1 evento por rota por
   minuto), porque `tracesSampleRate` é 0.1 e a requisição lenta pode não estar na amostra; sem o
   rate limit, um endpoint degradado queima a quota do Sentry em minutos.

#### `query-logger.ts`

Implementa `Logger` do TypeORM (`logQuery`, `logQuerySlow`, `logQueryError`, `logSchemaBuild`,
`logMigration`, `log`).

- `logQuery` → `store.dbQueries++`.
- `logQuerySlow(time)` → `store.dbMs += time`; se `time > DB_SLOW_QUERY_MS` (default 200),
  `store.slowQueries++` e loga a query (**sem parâmetros** — parâmetro carrega CPF, nome, telefone).
- `logQueryError` → loga e conta.
- Sempre no-op quando não há store.

Registro em `config/database.config.ts`: `logger: new QueryLogger()`, `maxQueryExecutionTime: 1`.
Confirmar que isso não reativa o log verboso do TypeORM (o `logging` padrão continua desligado; o
logger custom recebe os callbacks direto).

#### `runtime.service.ts`

- `monitorEventLoopDelay({ resolution: 10 })` de `perf_hooks`, iniciado no `onModuleInit`. Em
  1 vCPU, **lag de event loop é o sinal mais importante** — é ele que denuncia que o Puppeteer
  gerando PDF, o `sharp` gerando thumbnail ou o `pg_dump` do backup estão travando o processo.
  Expor p50/p99/max em ms e um `reset()` por janela.
- `process.memoryUsage()` (rss, heapUsed, heapTotal, external), `process.uptime()`,
  `process.cpuUsage()` acumulado convertido em **% de CPU desde o último sample**.
- Sem `setInterval` de coleta: tudo é lido sob demanda no request do controller. Timer em 1 vCPU é
  custo permanente para dado que ninguém está olhando.

#### `observability.controller.ts`

| Rota | Auth | Devolve |
|---|---|---|
| `GET /observability/health` | **pública** | `{ status: 'ok'\|'degraded', uptimeSec, db: 'up'\|'down' }` |
| `GET /observability/stats` | `@Roles(ADMIN)` | `{ runtime, routes[], recent[] }` |
| `POST /observability/reset` | `@Roles(ADMIN)` | zera store e janela do event loop |

`health` é pública de propósito — é liveness para o `healthcheck` do compose e para o nginx — e por
isso **não** expõe memória, versão, contagem de rotas nem nada que ajude quem está sondando. `db`
sai de um `SELECT 1` com timeout curto.

`stats` calcula as médias/percentis na leitura (`avgCpuMs = sumCpuMs / count`, p50/p95 dos buckets).
O store guarda só somas.

### 2. `app.module.ts`

Importar `ObservabilityModule`. Ele é `NestModule` e aplica o middleware em `'*'`, então tem que
entrar **antes** dos módulos de feature na lista de `imports` para o middleware envolver tudo.

### 3. Contratos — `packages/api-client`

Seguir onde os tipos de `backup` já moram: `packages/api-client/src/types.ts` (não
`packages/types`, que não tem os equivalentes).

- Tipos: `ObservabilityHealth`, `ObservabilityStats`, `ObservabilityRouteStats`,
  `ObservabilityRecentRequest`, `ObservabilityRuntime`.
- `src/modules/observability.ts`: `stats()`, `health()`, `reset()`.
- Registrar em `client.ts` e exportar os tipos em `index.ts`.

### 4. Postman

`fonte-api.postman_collection.json` ganha a pasta `observability` com as três rotas — obrigação do
CLAUDE.md para qualquer endpoint novo.

### 5. Env

`services/api/.env.example` ganha, com comentário de default:
`OBSERVABILITY_LOG_REQUESTS`, `OBSERVABILITY_SLOW_REQUEST_MS` (1000), `DB_SLOW_QUERY_MS` (200),
`OBSERVABILITY_RECENT_SIZE` (200), `OBSERVABILITY_MAX_ROUTES` (300).

---

## Validação

### Backend — `pnpm test:api`

**`metrics.store.spec.ts`**
- `record()` soma `count`, `errors` (status 400 e 500 contam; 200 e 302 não), somas de cpu/db/heap.
- p50/p95 pelos buckets: distribuição conhecida devolve o bucket certo; rota com **uma** amostra
  devolve p50 = p95; rota sem amostra não aparece.
- Ring buffer: com `size: 3`, a 4ª requisição sobrescreve a 1ª e a ordem devolvida é
  cronológica decrescente (mais recente primeiro) — sem `shift()`.
- Cap de cardinalidade: com `maxRoutes: 2`, a 3ª rota distinta cai em `OTHER` e o `Map` não passa
  de 3 entradas.
- `reset()` zera rotas e ring buffer.

**`route-name.spec.ts`**
- `req.route.path` presente → `GET /api/v1/residents/:id`.
- Sem `req.route`: UUID v4, id numérico e hash hex viram `:id`; segmento textual (`/residents`)
  **não** vira `:id`.
- Query string descartada; barra final normalizada.

**`query-logger.spec.ts`**
- `logQuery` sem store ativo não lança (caso do scheduler/seed).
- Dentro de `requestContext.run`, três `logQuery` → `dbQueries === 3`.
- `logQuerySlow(150)` soma em `dbMs` e **não** incrementa `slowQueries` (default 200);
  `logQuerySlow(250)` incrementa.
- Log de query lenta **não** contém os parâmetros (asserção explícita — é o guard de LGPD).

**`observability.middleware.spec.ts`**
- Requisição feliz: `record()` chamado uma vez com `status`, `durationMs ≥ 0`, `cpuMs ≥ 0` e os
  contadores de DB acumulados pelo store da própria requisição.
- Header `X-Request-Id` presente na resposta e igual ao `requestId` registrado.
- Requisição que termina em 403 (guard rejeitou, handler nunca rodou) **é registrada** — é o
  motivo de existir middleware em vez de interceptor.
- Acima do threshold: loga e chama `Sentry.captureMessage`; **duas** requisições lentas seguidas na
  mesma rota dentro do minuto disparam **um** evento (rate limit).
- Abaixo do threshold e status 200 com `OBSERVABILITY_LOG_REQUESTS` desligado: **não** loga.

**`runtime.service.spec.ts`**
- Expõe `eventLoopLagMs` (p50/p99/max), memória e uptime com os campos e unidades esperados.
- `reset()` reinicia a janela do histograma.

**`observability.controller.spec.ts`**
- `stats()` compõe runtime + rotas + recentes; médias derivadas das somas (rota com `count: 4` e
  `sumCpuMs: 20` → `avgCpuMs: 5`).
- `health()` com `SELECT 1` falhando → `db: 'down'` e `status: 'degraded'`, **sem** lançar.

### Backend — `pnpm test:api:e2e`

Novo `services/api/test/observability.e2e-spec.ts`:
- `GET /observability/health` **sem token** → 200, corpo só com `status`/`uptimeSec`/`db`
  (asserção de que **não** vazam memória e rotas).
- `GET /observability/stats` sem token → 401; com token SERVANT → 403; com ADMIN → 200.
- Duas chamadas com ADMIN: a segunda enxerga a própria rota `GET /api/v1/observability/stats` com
  `count` maior — prova que o middleware está no caminho real e não só no unit.
- `POST /observability/reset` com ADMIN zera; com SERVANT → 403.
- **Isolamento (story 182):** a suíte não cria linha em banco nenhum e o `reset()` só toca memória —
  registrar isso no header do spec para não parecer que falta cleanup.

### Contratos

- `pnpm build:api-client` (tipos e módulo novos). `packages/types` não muda — se mudar, também
  `pnpm build:types`.
- `fonte-api.postman_collection.json` atualizado com as três rotas.

### Verificação manual

1. Subir a API, fazer 20 `GET /residents` e abrir a tela: `queries médias` da rota deve ser um
   número **estável** entre as amostras. Se cresce com o tamanho da lista, é N+1 — e achar isso é
   o ponto da story.
2. Gerar um PDF (Puppeteer) e olhar o `eventLoopLagMs` p99 logo depois: deve subir visivelmente.
   É a confirmação de que o sinal mais importante do 1 vCPU está sendo medido.
3. Com `SENTRY_DSN` configurado, conferir no Sentry que a transação carrega os atributos
   `fonte.cpu_ms` / `fonte.db_queries`.
4. `curl` no `/observability/health` sem token → 200; `/observability/stats` sem token → 401.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` — o módulo `common/observability`
> nasce coberto e não pode entrar puxando a média para baixo — e **não reduzir** a cobertura dos
> módulos afetados. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

---

## Fora de escopo

- **A tela `/observabilidade` no `adm.fonte`** — é a story 192, que consome o endpoint desta.
- **`prom-client` e `/metrics` em formato Prometheus.** Decisão explícita do usuário. O
  `MetricsStore` desta story é a fonte se um dia entrar scrape externo.
- **Grafana, Prometheus ou qualquer coletor auto-hospedado no VPS.** 1 vCPU.
- **Persistência histórica** (tabela de métricas, série temporal). O agregado é desde o boot e
  morre no restart; histórico é o Sentry.
- **OpenTelemetry / tracing distribuído** entre frontends e API.
- **Alertas.** Configuração de alerta é no painel do Sentry, não em código.
- **Observabilidade dos frontends** (Web Vitals, custo de render). Story própria se virar
  necessidade.
- **Otimizar qualquer endpoint** que a instrumentação venha a acusar. Esta story mede; corrigir é
  a story que nascer da medição.
