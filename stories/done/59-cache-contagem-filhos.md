# Plan: Cache da contagem de filhos (Redis) — dashboard e listagem de casas

## Context

No `adm.fonte`, tanto a página inicial (Dashboard → `HouseOccupancyCard`) quanto a
listagem de casas mostram o número de filhos (internos presentes) por casa. Ambas
consomem o mesmo endpoint `GET /houses` → `HouseService.findAll()`, que hoje roda
**sempre** um `GROUP BY house_id` sobre `residents` para recalcular a contagem a cada
request. `HouseService.findOne()` faz o mesmo cálculo por casa.

Objetivo: cachear essa contagem de filhos com Redis, com **invalidação inteligente** —
o cache só é descartado quando um evento muda a contagem (novo filho, mudança de status
que entra/sai de "presente", troca de casa, alta, evasão, promoção a servo, soft delete).

### Decisões travadas

- **Escopo = contagem de filhos.** Só a contagem de internos por casa é cacheada. As
  demais colunas de `findAll` (lista de casas, `staffCount`, thumbnails) seguem ao vivo —
  são consultas baratas e fora do pedido. `staffCount` **não** entra neste cache.
- **Redis ainda não existe no projeto.** Adiciona-se serviço `redis` no `docker-compose`,
  dependência `ioredis` na API e um `CacheModule` global fino.
- **Degradação graciosa (padrão Sentry):** sem `REDIS_URL` o `CacheService` vira no-op
  (sempre miss, nunca escreve). Dev local e testes não exigem Redis — a contagem
  simplesmente é recalculada como hoje.
- **Invalidação desacoplada via EventEmitter2** (já global no `AppModule`). O
  `ResidentService` emite `resident.counts.changed`; o `HouseService` escuta com
  `@OnEvent` e apaga a chave. Evita acoplar `ResidentModule` ao cache de casas.
- **Chave única global** `house:resident-counts` guardando o mapa `{ houseId: count }`
  inteiro (poucas casas). `findAll` e `findOne` leem o mesmo mapa — fonte única.
- **TTL de segurança** (1h) além da invalidação por evento, para nunca servir um valor
  preso por bug de invalidação.
- **Sobre-invalidar é aceitável.** Emitimos o evento em qualquer create/update relevante
  sem checar se a transição cruzou a fronteira "presente" — correção > micro-otimização.

## Desenho

### Novo: `CacheModule` global (`services/api/src/modules/cache/`)

- `cache.service.ts` — `CacheService` envolvendo `ioredis`:
  - Conecta com `REDIS_URL` (via `ConfigService`); sem a env, fica inerte.
  - `get<T>(key): Promise<T | null>` — JSON.parse; miss/erro/inerte → `null`.
  - `set(key, value, ttlSeconds?)` — JSON.stringify + `EX`.
  - `del(key)` — apaga.
  - `onModuleDestroy` fecha a conexão.
  - Erros de Redis são logados e engolidos (cache nunca derruba request).
- `cache.module.ts` — `@Global()`, provê e exporta `CacheService`.
- Registrado no `AppModule`.

### `HouseService` (lê do cache)

- `private async getResidentCountsMap(): Promise<Record<string, number>>` —
  lê `house:resident-counts`; no miss roda o `GROUP BY` atual e grava com TTL.
- `findAll`: troca a subquery de contagem por `getResidentCountsMap()`.
- `findOne`: idem — pega `map[id] ?? 0` em vez de query dedicada.
- `@OnEvent('resident.counts.changed') invalidateResidentCounts()` → `cache.del(KEY)`.
- `HouseModule` ganha `CacheService` (via módulo global) — sem nova import de módulo.

### `ResidentService` (emite invalidação)

- Injeta `EventEmitter2`.
- Emite `resident.counts.changed` após: `create`, `update`, `readmit`, `remove`,
  `promoteToServant`. (Census `addResident`/`approveAll` passam por
  `create`/`update`, então já cobertos; `reject` não muda contagem.)
- Nome do evento em `common/events/resident-counts.event.ts` (constante compartilhada,
  sem DI — evita ciclo entre módulos).

### Infra

- `docker-compose.yml`: serviço `redis` (`redis:7-alpine`, porta 6379, healthcheck).
- `.env.example`: `REDIS_URL=redis://localhost:6379` (comentando que vazio = cache off).

## Validação

- **Unit (Jest backend)** — `pnpm test:api`:
  - `CacheService`: inerte sem `REDIS_URL` (get→null, set/del→no-op sem throw).
  - `HouseService`: `findAll`/`findOne` usam cache (hit não consulta o banco; miss
    consulta e grava); `invalidateResidentCounts` chama `cache.del`.
  - `ResidentService`: `create`/`update`/`remove`/`readmit`/`promoteToServant` emitem
    `resident.counts.changed`.
  - Atualizar os construtores nos specs existentes (novo param `EventEmitter2` no
    `ResidentService`; `CacheService` no `HouseService`).
- Suíte tocada inteira verde (DoD epic 49).
- Sem mudança de endpoint → `fonte-api.postman_collection.json` não muda.

## Fora de escopo

- Cachear `staffCount`, thumbnails ou a própria lista de casas.
- Cache no frontend (React Query já cacheia client-side; aqui é server-side/DB).
- Qualquer mudança de contrato/DTO/resposta da API.
