# Plan: Eventos — adm.fonte (CRUD + listagem em timeline)

> Segunda fatia da feature Eventos. Depende de [[56]] (backend + api-client `events`). Antes de
> [[58]] (inscrição pública).

## Context

Com o backend de [[56]] pronto, o `adm.fonte` ganha a tela de gestão de eventos. A listagem tem
aparência de **timeline**: os **próximos 3 eventos** ficam destacados visualmente e os **eventos
passados** aparecem mais opacos. O admin cria/edita/remove e anexa o banner.

### Decisões travadas (do usuário)

- Listagem em **timeline** (linha do tempo vertical), ordenada por `start_at`.
- **Próximos 3 eventos** (os 3 com `start_at` futuro mais próximos) **destacados** visualmente.
- **Eventos passados** (`start_at < now`) com visual **mais opaco**.
- CRUD completo: criar, editar, remover, anexar banner.
- Permissão: **ADMIN e COORDINATOR** (igual ao backend [[56]]).
- Reusar `@fonte/api-client` recurso `events` da [[56]] — sem HTTP novo no app.

## Desenho

### Frontend adm.fonte — feature `events`

Vertical slice + MVVM (skill `fonte-frontend`):

- `features/events/hooks/useEvents.ts` — `useEvents(filter?)`, `useEventById`, `useCreateEvent`,
  `useUpdateEvent`, `useDeleteEvent`, `useUploadEventBanner`. Query keys em `lib/queryKeys.ts`
  (`queryKeys.events.*`) — nunca string literal. Mutations invalidam `queryKeys.events.all`.
- `pages/EventsPage.tsx` — orquestra a timeline; sem fetch direto; `LoadingState`/`EmptyState`/
  `ErrorState` de `@/components/shared`.
- `components/EventTimeline.tsx` — lista vertical (não renderizar item inline; extrair o item).
- `components/EventTimelineItem.tsx` — um evento. Recebe flags de exibição:
  - **destacado** se está entre os 3 próximos (`start_at >= now`, 3 primeiros por data).
  - **opaco** se passado (`start_at < now`).
  - Mostra título, data/hora (start–end), local, banner (se houver), badge de vagas/lotação
    quando `capacity` definido. Ações editar/remover.
- `components/EventForm.tsx` — react-hook-form + zod (NUNCA `useState` de campo). Campos do modelo
  ([[56]]); validação `endAt ≥ startAt` e janela de inscrição coerente no schema zod.
- `components/EventBannerUpload.tsx` — input de imagem que chama `useUploadEventBanner`.
- `components/CreateEventDialog.tsx` / `EditEventDialog.tsx` — autossuficientes (buscam o que
  precisam; sem prop drilling).
- Cálculo dos "3 próximos" e "passado" numa função pura testável (ex.: `lib/eventTimeline.ts`
  `classifyEvents(events, now)` → `{ highlightedIds, pastIds }`), consumida pela page/timeline.
- Rota `/eventos` + item de menu (grupo coerente; ADMIN+COORDINATOR). Erros via `getErrorMessage`.
- Componente acima de ~150 linhas → quebrar (regra CLAUDE.md).

## Validação

- `pnpm test:adm:unit` (Vitest + RTL) — unit:
  - `classifyEvents`: marca os 3 próximos por `start_at` futuro; marca passados; ignora futuros
    além dos 3 no destaque; estabilidade com empate de datas.
  - schema zod do form: `endAt < startAt` inválido; janela de inscrição incoerente inválida.
- `pnpm test:adm` — Playwright `events.spec.ts`: cria evento (aparece na timeline), os 3 próximos
  vêm destacados, um evento com data passada aparece opaco, edita e remove. Helper de login
  existente.
- `pnpm --filter adm.fonte build` (tsc -b + vite) verde.

## Fora de escopo

- Backend (já em [[56]]).
- Inscrição pública / portal / contagem de vagas no fluxo de inscrição → [[58]].
- Telas no `ops.fonte`/`app.fonte`.
