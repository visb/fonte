# Plan: idempotência de escrita no backend (`Idempotency-Key`)

> Item do `stories/BACKLOG.md`, levantado pelo epic [[167]] (ops.fonte offline-first).
> **Implementar ANTES da [[169]]** — decisão travada abaixo.

## Context

O epic [[167]] põe as escritas de campo do `ops.fonte` numa outbox persistida que reenvia o
lançamento quando a rede volta ([[169]]). O replay **não é idempotente do lado do servidor**: se a
requisição chega ao backend mas a resposta se perde (rede caindo no meio, app morto pelo SO), o
item continua na fila e o reenvio **duplica** o lançamento.

O caso crítico é movimento de estoque: `storeroom`/`supply_room` **não têm estorno** — pelo
`BUSINESS_RULES.md`, correção só por lançamento novo. Um IN duplicado no almoxarifado vira
divergência de inventário que ninguém consegue desfazer, só compensar.

Estado verificado (2026-08-09):

- `services/api/src/main.ts:27-31` — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
  transform: true })`. **Campo extra no body é 400**, não é ignorado. Isso invalida a decisão 9 da
  [[169]] como estava escrita ("campo extra ignorado pelo backend não quebra nada") — a [[169]]
  precisa ser corrigida junto com esta story.
- Existe padrão pronto de cross-cutting concern: `@Audit()`
  (`common/decorators/audit.decorator.ts`) + `AuditInterceptor`
  (`common/interceptors/audit.interceptor.ts`) + entity própria (`modules/audit/audit-log.entity.ts`),
  registrado por handler via `Reflector.getAllAndOverride`. Esta story copia essa forma.
- `@nestjs/schedule` já é usado com `@Cron(CronExpression.EVERY_WEEK)`
  (`modules/retention/retention.service.ts:59`) — há onde pendurar a limpeza sem infra nova.
- Migrations em `src/database/migrations/`, última `1783037400000-AddAdmissionToReceivables.ts`.
  Padrão do banco: snake_case, UUID v4 (CLAUDE.md).

### Decisões travadas (refinadas nesta sessão)

1. **Transporte: header `Idempotency-Key`**, não campo no body. Com `forbidNonWhitelisted: true`,
   um `clientRequestId` no body exigiria adicionar o campo em ~10 DTOs de escrita só para satisfazer
   o pipe, poluindo o contrato de negócio com metadado de transporte. Header não toca DTO nenhum,
   é imune ao pipe e é o padrão de mercado (Stripe). Descartado o campo no body.
2. **Mecânica: tabela genérica `idempotency_keys` + `@Idempotent()` + interceptor.** Espelha o
   `@Audit`: o handler só ganha um decorator; nenhum service muda. Descartada a coluna
   `client_request_id` por tabela de domínio (migration + entity + service em cada módulo, e cada
   um tratando conflito do seu jeito).
3. **Escopo: só as escritas dos fluxos de campo do ops** — as que passam pela outbox da [[169]].
   O resto da API não tem replay automático, então não corre o risco; interceptor global gravaria
   linha para tráfego que nunca vai ser reenviado. Endpoints alvo:
   censo (add resident, conclude), atualização de status/casa de resident vinda do censo,
   ocorrências (create), almoxarifado (createItem, createMovement), despensa (createItem,
   createMovement), venda de rua (create, update), atividades (create, comment).
4. **Ordem: 172 antes da [[169]].** Backend pronto primeiro, para o replay já nascer seguro e não
   existir janela em que o epic roda com risco de duplicata em aberto. Como parte desta story,
   **corrigir a decisão 9 da [[169]]** para apontar o header em vez do campo no body.
5. **Reserva antes de executar (protege contra concorrência).** O interceptor insere a chave com
   status `IN_PROGRESS` **antes** de chamar o handler. Se o insert viola a unique, a requisição é
   duplicata: chave `COMPLETED` → devolve a resposta e o status originais **sem executar o
   handler**; chave `IN_PROGRESS` → **409** ("requisição ainda em processamento"), que o cliente
   trata como transitório e tenta de novo. Só o unique index resolve duas cópias simultâneas —
   checar-antes-de-inserir tem corrida.
6. **Escopo da chave é `(user_id, method, path, key)`.** Chave repetida por outro usuário ou em
   outra rota não colide. Sem `user_id` no escopo, um cliente poderia ler a resposta de outro.
7. **Só resposta de sucesso é memorizada.** Handler que falha (4xx/5xx) **remove** a reserva — o
   erro não pode ficar cacheado, senão o operador nunca consegue corrigir e reenviar.
8. **Header ausente = comportamento de hoje.** O decorator não torna o header obrigatório; sem
   `Idempotency-Key` a requisição passa direto. Isso mantém adm.fonte, portal e Postman existentes
   funcionando sem mudança.
9. **Header inválido (não-UUID) → 400.** Sem isso, cliente com bug gera lixo ilimitado na tabela.
10. **Retenção de 7 dias**, purgada por `@Cron`. Cobre com folga o pior caso de operador offline
    (fila drenada quando volta à casa); guardar resposta serializada além disso é acúmulo de dado
    pessoal sem finalidade (LGPD, `docs/lgpd/DIAGNOSTICO_LGPD.md`).

## Desenho

### Migration + entity

`src/database/migrations/<timestamp>-AddIdempotencyKeys.ts` (nova, **nunca editar existente**):

Tabela `idempotency_keys`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid PK | default v4 |
| `key` | varchar | valor do header |
| `user_id` | uuid | do JWT |
| `http_method` | varchar | |
| `path` | varchar | rota normalizada |
| `status` | varchar | `IN_PROGRESS` \| `COMPLETED` |
| `response_status` | int null | status HTTP memorizado |
| `response_body` | jsonb null | resposta serializada |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz null | |

- **Unique** em `(key, user_id, http_method, path)` — é o que garante a dedupe sob concorrência.
- Index em `created_at` para a purga.
- Sem `deleted_at`: tabela é operacional e some na purga, não é registro de domínio.

`src/modules/idempotency/idempotency-key.entity.ts`, `idempotency.service.ts` (reserve /
complete / release / purge), `idempotency.module.ts`.

### `common/decorators/idempotent.decorator.ts` (novo)

`@Idempotent()` — `SetMetadata` no espírito do `@Audit`, sem parâmetros obrigatórios.

### `common/interceptors/idempotency.interceptor.ts` (novo)

1. Sem metadata `@Idempotent` → `next.handle()`.
2. Sem header → `next.handle()`.
3. Header não-UUID → `BadRequestException`.
4. `reserve()`; violação de unique → busca a chave: `COMPLETED` devolve `response_body` com
   `response_status`; `IN_PROGRESS` → `ConflictException`.
5. `next.handle().pipe(tap(...))` grava a resposta e marca `COMPLETED`; `catchError` libera a
   reserva e repropaga o erro.

Registrado como interceptor global (como o `AuditInterceptor`), inerte sem o decorator.

### Controllers alvo

`@Idempotent()` nos handlers do escopo (decisão 3) — census, incident, storeroom, supply-room,
street-sale, activity. Nenhum service muda.

### Purga

`IdempotencyService.purgeExpired()` com `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`, apagando
`created_at < now() - 7 dias`.

### `@fonte/api-client`

- `packages/api-client/src/client.ts`: aceitar header por chamada (`RequestOptions` opcional com
  `idempotencyKey`) nos métodos de escrita dos módulos do escopo. Não é header global do axios —
  cada requisição enfileirada tem a **sua** chave, e uma chave global deduplicaria tudo.
- `pnpm build:types` (se `packages/types` receber o tipo do option) e `pnpm build:api-client`.

### Correção na story [[169]]

Editar `stories/169-ops-offline-outbox-e-replay.md`, decisão 9: a chave vai no header
`Idempotency-Key` (gerada uma vez no `onMutate` e **reusada em todo reenvio** do mesmo item —
gerar chave nova a cada retry anula a idempotência), e some a ressalva sobre `forbidNonWhitelisted`.

### Postman

`fonte-api.postman_collection.json` atualizado nos endpoints do escopo com o header opcional
documentado (CLAUDE.md: coleção é documentação viva).

## Validação

**Unit (`pnpm test:api`)**

- `idempotency.service.spec.ts`: `reserve` cria `IN_PROGRESS`; segunda `reserve` com a mesma tupla
  viola unique; `complete` grava status+body e marca `COMPLETED`; `release` apaga a reserva;
  `purgeExpired` apaga só o que passou de 7 dias e **não** apaga o que está dentro da janela.
- `idempotency.interceptor.spec.ts`:
  - handler sem `@Idempotent` → passa direto, nada gravado;
  - com decorator e **sem** header → executa normal, nada gravado (não regride cliente atual);
  - header não-UUID → 400;
  - primeira chamada → executa e memoriza;
  - segunda chamada com a mesma chave → **handler não é executado** e a resposta original volta
    com o mesmo status (o teste que prova a dedupe);
  - chave `IN_PROGRESS` → 409;
  - handler que lança → reserva liberada e o erro repropagado (reenvio depois funciona);
  - mesma chave com `user_id` diferente → executa normal (isolamento entre usuários);
  - mesma chave em rota diferente → executa normal.

**E2E (`pnpm test:api:e2e`)**

- `POST /storerooms/movements` duas vezes com o **mesmo** `Idempotency-Key` → 1 movimento criado,
  `current_quantity` mexeu **uma** vez, segunda resposta igual à primeira. É o caso que motiva a
  story inteira.
- Mesmo endpoint com chaves **diferentes** → 2 movimentos (não deduplicar demais).
- Um caso por família do escopo: incidente, venda de rua, atividade e censo (add resident) —
  duplicata não cria segundo registro.
- Sem header → comportamento de hoje preservado.

**Contratos**

- `pnpm build:types` (se o tipo do option entrar em `packages/types`) e `pnpm build:api-client`.
- `packages/api-client` — teste de contrato cobrindo que o header sai na requisição quando o option
  é passado e **não** sai quando não é.
- `fonte-api.postman_collection.json` atualizado.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e `pnpm test:api-client`; **não
reduzir** a cobertura dos módulos afetados (`modules/idempotency`, `common/interceptors`, e os
controllers decorados). Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Tornar o header **obrigatório** em qualquer endpoint.
- Idempotência fora dos fluxos de campo do ops (adm, portal, associados, webhooks de pagamento).
- Unique de domínio por tabela como defesa extra (`client_request_id` em `storeroom_movements`) —
  se o interceptor se mostrar insuficiente na prática, vira story própria.
- Retry automático do cliente no 409 de `IN_PROGRESS` — o comportamento de fila da [[169]] já
  trata 5xx/transitório; classificar o 409 desse caso específico é ajuste da [[169]], não daqui.
- Purga configurável por env (7 dias é constante).
