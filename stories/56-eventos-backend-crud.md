# Plan: Eventos — backend (módulo `event`) + CRUD admin

> Primeira fatia da feature Eventos. Base para [[57]] (timeline no adm) e [[58]] (inscrição
> pública + portal). Implementar primeiro.

## Context

A comunidade precisa divulgar e gerir eventos (retiros, cultos, encontros de famílias, formaturas
do curso bíblico etc.). Esta fatia entrega o **domínio + CRUD administrativo**: criar, editar,
listar, remover eventos e anexar um banner. Sem inscrição ainda — só o cadastro e a leitura
ordenada que a timeline ([[57]]) vai consumir.

A entidade de inscrição (`event_registration`) **não** entra aqui — é da [[58]] (fluxo público).

### Decisões travadas (do usuário)

- Feature fatiada em **3 stories**: 56 (este, backend CRUD), [[57]] (adm: CRUD + timeline),
  [[58]] (inscrição pública + rename `associados`→`portal.fonte`).
- **Inscrição é pública** (qualquer pessoa, sem login) — mas o backend disso é da [[58]].
- Campos do evento: `title`, `description`, `start_at`, `end_at?`, `location?`, `capacity?`
  (null = ilimitado), `banner_key?` (storage), `registration_opens_at?`,
  `registration_closes_at?`.
- Permissão de gestão: **ADMIN e COORDINATOR** (mesma classe de gestão administrativa do adm).
- Domínio **novo e independente**. Módulo NestJS próprio `event`.

## Desenho

### Backend — `services/api/src/modules/event/`

- **Migration** `1783200000000-Events.ts` criando `events`:
  - `id` uuid v4 PK, `title` varchar not null, `description` text not null,
    `start_at` timestamptz not null, `end_at` timestamptz null,
    `location` varchar null, `capacity` int null (null = ilimitado),
    `banner_key` varchar null (chave no bucket, NUNCA URL),
    `registration_opens_at` timestamptz null, `registration_closes_at` timestamptz null,
    `created_at`/`updated_at`/`deleted_at` (soft delete). snake_case.
  - Índice em `start_at` (ordenação da timeline).
- **Entity** TypeORM `event.entity.ts` correspondente.
- **DTOs** + `class-validator`:
  - `CreateEventDto`: `title` (string min 1), `description` (string min 1),
    `startAt` (ISO date string → Date), `endAt?` (ISO, opcional), `location?` (string),
    `capacity?` (int > 0), `registrationOpensAt?`, `registrationClosesAt?` (ISO).
    Validar coerência: `endAt` ≥ `startAt`; `registrationClosesAt` ≥ `registrationOpensAt`
    (validação no service, 400 se violar).
  - `UpdateEventDto` (partial de create).
  - `ListEventsDto` (query): `filter?` = `all | upcoming | past` (default `all`),
    paginação simples se necessário (`limit?`/`offset?`).
- **Endpoints** (JWT, ADMIN+COORDINATOR via guard de role existente):
  - `POST   /events` — cria.
  - `GET    /events` — lista ordenada por `start_at` asc; `filter=upcoming` → `start_at >= now`,
    `filter=past` → `start_at < now`.
  - `GET    /events/:id` — detalhe.
  - `PATCH  /events/:id` — edita.
  - `DELETE /events/:id` — soft delete.
  - `POST   /events/:id/banner` — upload do banner (`FileInterceptor('file')`, mesmas
    `attachmentOptions`/limites do módulo `payable`; grava `banner_key` no storage; valida
    mime de imagem). Responder com o evento atualizado.
- **Banner**: usar `StorageService` existente + `StorageUrlInterceptor` para devolver signed URL
  do `banner_key` nas respostas (mesmo padrão de anexo do `payable`). Nunca persistir URL.
- **Service** com a lógica; controller fino só valida/roteia (regra do CLAUDE.md).
- Registrar `EventModule` no `app.module.ts`.
- Atualizar `fonte-api.postman_collection.json` com a seção Events.

### Tipos compartilhados — `packages/types`

- `Event` (camelCase, datas como string ISO no contrato), `EventFilter` (`all|upcoming|past`),
  inputs `CreateEventInput`/`UpdateEventInput`. Reexportar no `index.ts`. `pnpm build:types`.

### api-client — `packages/api-client`

- Recurso `events` (`events.ts`) com `list(filter?)`, `getById`, `create`, `update`, `remove`,
  `uploadBanner(id, file)`. Não duplicar HTTP nos apps. `pnpm build:api-client`.

## Validação

- `pnpm test:api` — unit do `event.service`: create persiste campos + gera id; `endAt < startAt`
  → erro 400; `registrationClosesAt < registrationOpensAt` → 400; list `upcoming`/`past` filtra
  por `start_at`; update parcial; remove soft (some da lista); capacity null aceito. Verde.
- `pnpm test:api:e2e` — e2e CRUD `/events`: ADMIN/COORDINATOR autorizam, SERVANT/RELATIVE 403;
  validações de DTO (400); list ordenada; upload de banner devolve evento com signed URL. Verde.
- `pnpm build:types` e `pnpm build:api-client` sem erro.
- Postman atualizado.

## Fora de escopo (fica nas outras fatias)

- Timeline / qualquer UI no adm → [[57]].
- Entidade `event_registration`, endpoints públicos, contagem de vagas, janela de inscrição
  aplicada na inscrição → [[58]].
- Rename do app `associados` → [[58]].
- Notificação/WhatsApp de evento, recorrência, check-in.
