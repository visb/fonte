# Plan: Eventos — toggle de inscrição por evento + seção de config no adm

> Estende a feature Eventos ([[56]] backend, [[57]] adm, [[58]] portal público). Primeira de 3
> fatias do refino de eventos: [[67]] (este, toggle), [[68]] (campos de formulário customizáveis),
> [[69]] (pagamento da inscrição). Fazer primeiro — [[68]] e [[69]] dependem do toggle existir.

## Context

Hoje (entregue em [[58]]) **todo** evento futuro dentro da janela de inscrição aparece no portal
público com formulário. Mas nem todo evento aceita inscrição — muitos são só divulgação (avisos,
cultos abertos, formaturas). Falta um controle explícito de "este evento aceita inscrição".

Esta fatia adiciona o flag `registration_enabled` e reorganiza os controles de inscrição numa
seção própria do form de evento no adm.

### Decisões travadas (do usuário — 2026-06-19)

- **Portal público = página de inscrição.** Evento com inscrição **desligada NÃO aparece** na lista
  pública (`GET /public/events`) nem tem detalhe público. Fica só na gestão interna do adm
  (timeline da [[57]]). Decidido: "some do portal".
- **Default ao criar = inscrição DESLIGADA.** Evento novo nasce só-divulgação; o admin liga
  inscrição explicitamente. (Muda o comportamento implícito da [[58]], onde todo evento era
  inscritível.)
- **Reorganizar a UI**: agrupar todos os controles de inscrição (toggle, `capacity`,
  `registration_opens_at`, `registration_closes_at`) numa **seção própria** do `EventForm`, que só
  habilita os demais campos quando o toggle está ligado.
- Permissão de gestão: **ADMIN e COORDINATOR** (igual ao resto da feature).

## Desenho

### Backend — módulo `event` (continuação de [[56]]/[[58]])

- **Migration** nova `…-EventRegistrationEnabled.ts` (nunca editar migrations existentes):
  - `events.registration_enabled` boolean not null default `false`.
  - Eventos já existentes ficam `false` (consistente com o novo default). Se houver eventos em
    produção que devem continuar inscritíveis, ligar manualmente pelo adm depois do deploy
    (anotar no PR).
- **Entity** `event.entity.ts`: campo `registrationEnabled`.
- **DTOs**: `CreateEventDto`/`UpdateEventDto` ganham `registrationEnabled?: boolean` (default
  `false` na criação). Validação de coerência no service: se `registrationEnabled = false`, os
  campos de inscrição (`capacity`, janela) podem vir nulos/ignorados; se `true`, aplicar as
  validações de janela já existentes ([[56]]).
- **Endpoints públicos** ([[58]]) passam a filtrar por `registration_enabled = true`:
  - `GET /public/events` — só eventos com inscrição ligada (além dos filtros de janela/futuro já
    existentes).
  - `GET /public/events/:id` — 404 se `registration_enabled = false` (não vaza evento interno).
  - `POST /public/events/:id/register` — 404/409 claro se inscrição desligada (defesa em
    profundidade, não confiar só no filtro da lista).
- **Endpoints admin** (`GET /events`, `/events/:id`, CRUD) retornam o flag normalmente.
- Atualizar `fonte-api.postman_collection.json` (campo novo nos bodies/responses de events).

### Tipos / api-client

- `@fonte/types`: `Event` + inputs ganham `registrationEnabled`. `EventPublic` permanece (só vem
  de eventos ligados). `pnpm build:types`.
- `@fonte/api-client`: recurso `events` já cobre create/update — só propagar o campo novo.
  `pnpm build:api-client`.

### Frontend adm.fonte — feature `events` (continuação de [[57]])

- `components/EventForm.tsx`: extrair uma **seção de inscrição** (`EventRegistrationSection` ou
  bloco no schema zod) com:
  - toggle `registrationEnabled` (default `false`);
  - `capacity`, `registrationOpensAt`, `registrationClosesAt` **desabilitados/escondidos** quando o
    toggle está off; validação de janela só aplica quando on.
- `EventTimelineItem` ([[57]]): badge/indicador visual de "inscrição aberta/desligada" para o admin
  distinguir eventos inscritíveis dos só-divulgação.
- Se a seção fizer o `EventForm` passar de ~150 linhas, extrair componente próprio (regra
  CLAUDE.md). Erros via `getErrorMessage`.

## Validação

- `pnpm test:api` — unit `event.service`: create default `registrationEnabled=false`; público lista
  só eventos ligados; `GET /public/events/:id` de evento desligado → 404; register em evento
  desligado rejeitado; com toggle off não exige janela coerente.
- `pnpm test:api:e2e` — `public/events` não retorna eventos com inscrição off; register bloqueado
  (404/409) em evento off; CRUD admin persiste/edita o flag; SERVANT/RELATIVE seguem 403 no admin.
- `pnpm test:adm:unit` — schema zod do `EventForm`: com toggle off não valida janela; com on exige
  janela coerente. `pnpm test:adm` — Playwright: criar evento com inscrição off não aparece no
  portal (ou ao menos o flag persiste e a seção habilita/desabilita os campos).
- `pnpm --filter adm.fonte build` verde. `pnpm build:types`/`build:api-client` sem erro. Postman
  atualizado.

## Fora de escopo

- Campos de formulário customizáveis → [[68]].
- Pagamento da inscrição → [[69]].
- Telas de eventos no `ops.fonte`/`app.fonte`.
- Backfill automático de `registration_enabled=true` em eventos pré-existentes (decisão manual
  pós-deploy).
