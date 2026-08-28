# Plan: Remover a dependência de Redis do backend

## Context

A migração para o VPS (story 189) reduz a stack ao mínimo. O Redis existe hoje para **um único
caso de uso** — cachear a listagem de casas e a contagem de filhos por casa (story 59) — e
custa um container, uma dependência (`ioredis`) e um caminho de falha a mais.

**Decisão do usuário:** tirar o Redis e tudo que depende dele. O compose de produção da story
189 já nasce sem o serviço.

### O uso real é pequeno e o custo de remover é baixo

Levantamento completo do que toca Redis:

- `modules/cache/` — `CacheService`, um wrapper fino de `ioredis` que já **degrada
  graciosamente**: sem `REDIS_URL` o cliente é `null`, `get` devolve `null` e `set`/`del` são
  no-op (`cache.service.ts:17-27`). Ou seja, a aplicação **já roda sem Redis hoje**; o que
  falta é remover o código morto e parar de logar aviso de conexão.
- `HouseService` — **único consumidor**. Duas leituras cacheadas
  (`getResidentCountsMap()`, `findAll()`) e dois handlers de invalidação.
- `RESIDENT_COUNTS_CHANGED_EVENT` e `HOUSE_STAFF_CHANGED_EVENT` — existem **só** para
  invalidar esse cache; `HouseService` é o único `@OnEvent` de ambos.
- `EventEmitter2` em `ResidentService` e `StaffService` — injetado **só** para emitir esses
  dois eventos (`resident.service.ts:106`, `staff.service.ts:36`). Nenhum outro uso.

> **`EventEmitterModule` fica.** `NOTIFICATION_CREATED_EVENT` continua usando o barramento
> para alimentar o `NotificationGateway` (websocket, `notification.gateway.ts:74`). Só os dois
> eventos de invalidação saem.

### Impacto de performance: aceitável

Sem cache, `GET /houses` volta a rodar em toda requisição um `GROUP BY house_id` sobre
`residents` (filtrado por status e `deleted_at IS NULL`), um `GROUP BY` sobre `staff` e um
`DISTINCT ON` sobre `house_photos` — tudo já em paralelo via `Promise.all`
(`house.service.ts:95-113`).

A ordem de grandeza é de dezenas de casas e ~1.000 filhos. É consulta agregada trivial para o
Postgres nesse volume, numa tela que não é de alta frequência. **Se** virar gargalo, o caminho
é índice ou view materializada — não trazer o Redis de volta.

---

## Desenho

### 1. Apagar o módulo de cache

Remover `services/api/src/modules/cache/` inteiro (module, service, spec) e o import de
`CacheModule` em `app.module.ts:43,62`.

### 2. `HouseService` — leituras diretas

- Remover a injeção de `CacheService` (`house.service.ts:39`).
- `getResidentCountsMap()`: manter a query, tirar o `get` de entrada e o `set` de saída. O
  método vira só "roda o GROUP BY e monta o mapa".
- `findAll()`: mesma coisa — tirar o `get`/`set`, manter o `Promise.all` e a montagem do
  resultado.
- Apagar os dois handlers `@OnEvent` (`invalidateResidentCounts`, `invalidateHouseList`) e as
  constantes `RESIDENT_COUNTS_KEY`, `HOUSE_LIST_KEY`, `RESIDENT_COUNTS_TTL`.
- Limpar os comentários que descrevem o cache (`house.service.ts:23,42-45,72-74,82`).

### 3. Apagar os eventos de invalidação

- Remover `common/events/resident-counts.event.ts` e `common/events/house-staff.event.ts`.
- `ResidentService`: remover o `emit` (`:106`) e a injeção de `EventEmitter2` (`:3,100`).
  Ajustar o comentário de `:104` que explica a sobre-invalidação.
- `StaffService`: remover o `emit` (`:36`) e a injeção (`:7,30`).
- Conferir se o método que envolvia o `emit` fica vazio ou trivial — se sim, remover a
  indireção em vez de deixar wrapper morto.

### 4. Dependência e configuração

- `services/api/package.json` — remover `ioredis` (`:61`) e rodar `pnpm install` para atualizar
  o lockfile.
- `services/api/.env.example` — remover o bloco `REDIS_URL` (`:9-10`).
- `docker-compose.yml` (dev) — remover o serviço `redis` e seu healthcheck (`:22-30`).
- `CLAUDE.md` — se citar Redis na stack, ajustar.

---

## Arquivos

**Apagar:**
- `services/api/src/modules/cache/cache.module.ts`
- `services/api/src/modules/cache/cache.service.ts`
- `services/api/src/modules/cache/cache.service.spec.ts`
- `services/api/src/common/events/resident-counts.event.ts`
- `services/api/src/common/events/house-staff.event.ts`

**Editar:**
- `services/api/src/app.module.ts` — tirar `CacheModule`; **manter** `EventEmitterModule`.
- `services/api/src/modules/house/house.service.ts` — leituras diretas, sem cache nem eventos.
- `services/api/src/modules/house/house.service.spec.ts` — tirar o mock de `CacheService` e os
  testes de hit/miss/invalidação; cobrir o comportamento direto.
- `services/api/src/modules/resident/resident.service.ts` — tirar `emit` e `EventEmitter2`.
- `services/api/src/modules/resident/resident.service.spec.ts` — ajustar o provider mockado.
- `services/api/src/modules/staff/staff.service.ts` — tirar `emit` e `EventEmitter2`.
- `services/api/src/modules/staff/staff.service.spec.ts` — ajustar o provider mockado.
- `services/api/package.json` — remover `ioredis`.
- `services/api/.env.example` — remover `REDIS_URL`.
- `docker-compose.yml` — remover o serviço `redis`.
- `pnpm-lock.yaml` — resultado do `pnpm install`.

**Não tocar:**
- `modules/notification/` — `NOTIFICATION_CREATED_EVENT` e o gateway continuam iguais.
- `EventEmitterModule.forRoot()` em `app.module.ts:61`.

---

## Validação

**Testes obrigatórios:**

1. `pnpm test:api` — unit verdes. Os specs de `house`, `resident` e `staff` mudam de shape
   (somem providers mockados); nenhum outro spec pode quebrar.
2. `pnpm test:api:e2e` — `GET /houses` continua devolvendo `activeResidentsCount`,
   `staffCount` e `thumbnailUrl` corretos. É o teste que prova que a remoção do cache não
   mudou o contrato.
3. `pnpm test:adm` — a listagem de casas no adm consome esses campos; rodar o e2e do domínio.
4. `pnpm build:api` — compila sem `ioredis` e sem os arquivos apagados.
5. Sem mudança de endpoint, DTO ou schema → **não** há Postman, migration,
   `packages/types` nem `api-client` a atualizar.

**Casos a cobrir em `house.service.spec.ts`:**
- `findAll()` devolve casas com `activeResidentsCount`, `staffCount` e `thumbnailUrl`
  corretos, **sem** nenhum provider de cache no módulo de teste.
- Casa sem filhos → `activeResidentsCount: 0` (não `undefined`); casa sem staff →
  `staffCount: 0`; casa sem foto → `thumbnailUrl: null`.
- Filho com status fora de `PRESENT_RESIDENT_STATUSES` e filho com `deleted_at` **não** entram
  na contagem (a query é a única fonte agora — antes um valor errado podia ficar mascarado
  por cache quente).
- Duas chamadas consecutivas a `findAll()` batem no banco **as duas vezes** (prova que o
  cache saiu de verdade, e não que ficou um caminho residual).

**Casos a cobrir em `resident.service.spec.ts` / `staff.service.spec.ts`:**
- As operações que antes emitiam evento (mudança de status/casa de filho, mudança de staff)
  continuam funcionando com o módulo de teste **sem** `EventEmitter2` — se algum spec ainda
  exigir o provider, sobrou injeção.

**Verificação manual:**
1. Subir a API **sem** `REDIS_URL` e sem container de Redis: nenhum log de cache nem de
   tentativa de conexão (hoje loga `REDIS_URL ausente — cache inerte`).
2. Abrir a lista de casas no adm, mudar um filho de casa e recarregar: a contagem reflete a
   mudança **imediatamente** — antes dependia do evento de invalidação chegar.
3. `grep -ri redis services/api/src` não retorna nada.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente
> — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e **não reduzir** a cobertura
> dos módulos afetados (`house`, `resident`, `staff`). Atenção: apagar o `cache.service.spec.ts`
> muda o denominador global — conferir o número por módulo, não só o total. Sem
> `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

---

## Fora de escopo

- **Substituir o cache por outra coisa** (cache em memória, view materializada, índice
  dedicado). A story remove; otimizar de novo só se medição mostrar necessidade.
- `EventEmitterModule` e o fluxo de notificações — continuam como estão.
- Redis para qualquer outro fim (fila, sessão, rate limit). Nada disso existe hoje.
- O compose de produção — é a story 189, que já nasce sem o serviço.
