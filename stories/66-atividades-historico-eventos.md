# Plan: Atividades — histórico de eventos do card + abas (comentários | histórico)

## Context

Follow-up final do bloco Atividades (stories 48, 62, 65). Item 6 do BACKLOG: registrar o
**histórico de tudo** que acontece num card — desde a criação, passando por comentário, alteração
de título, mudança de status, atribuição de responsável, até a conclusão. O histórico ocupa o
**mesmo espaço** dos comentários no modal, exibido por **abas: Comentários | Histórico**.

Depende da story 62 (modal `ActivityDetailsDialog`) e da 65 (que introduziu a moldura de abas e a
aba Comentários). Esta story acrescenta a trilha de auditoria e a segunda aba.

### Decisões travadas (defaults automáticos do modo auto — revisar se desejado)

- **Histórico é só-leitura e gerado pelo backend.** Os eventos são registrados pelo
  `activity.service` a cada mutação relevante — o front nunca escreve histórico.
- **Eventos cobertos:** `CREATED`, `STATUS_CHANGED` (de→para), `TITLE_CHANGED`,
  `DESCRIPTION_CHANGED`, `RESPONSIBLE_CHANGED`, `COMMENTED` (referencia o comentário criado),
  `DELETED`. Cada evento guarda **ator** (`User`), **tipo**, **metadados** (ex: `{ from, to }`,
  `{ before, after }`) e timestamp.
- **Escopo de UI: `adm.fonte`** (mesma janela das stories 62/65). ops consome depois se pedido.
- **Visibilidade = a da atividade** (regra de escopo por casa da 48). Sem acesso de
  `RELATIVE`/`RESIDENT`.
- **Registro desacoplado, sobre-registrar é aceitável** (padrão da story 59): o service grava o
  evento na mesma transação/fluxo da mutação; preferir simplicidade a otimização. Comentários
  geram tanto a linha em `activity_comments` (story 65) quanto um evento `COMMENTED` — a aba
  Histórico mostra a ocorrência; o conteúdo vive nos comentários.

## Desenho

### Backend — entidade `activity_events` (no módulo `activity`)

**Entity `activity_events`** (snake_case, UUID; **sem** soft delete — log é append-only):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `activity_id` | uuid | FK `activities` (índice) |
| `type` | enum `ActivityEventType` | CREATED \| STATUS_CHANGED \| TITLE_CHANGED \| DESCRIPTION_CHANGED \| RESPONSIBLE_CHANGED \| COMMENTED \| DELETED |
| `actor_user_id` | uuid | FK `users` — quem disparou |
| `metadata` | jsonb nullable | `{ from, to }`, `{ commentId }`, etc. |
| `created_at` | timestamp | |

**Registro no `activity.service`** (helper privado `recordEvent(activityId, type, actor, metadata)`):
chamado em `create` (CREATED), `update` (TITLE/DESCRIPTION/RESPONSIBLE_CHANGED conforme o que mudou),
`changeStatus` (STATUS_CHANGED com `{ from, to }`), `remove` (DELETED). O `activity-comment.service`
(story 65) chama `recordEvent(..., COMMENTED, { commentId })` ao criar comentário. Para evitar ciclo,
o helper pode morar no `activity.service` e ser injetado, ou usar EventEmitter2 (padrão da story 59)
— escolher na implementação; preferir chamada direta no mesmo módulo.

**Endpoint**: `GET /activities/:id/events` — lista cronológica (desc) dos eventos; valida
visibilidade (`assertVisible`). Roles ADMIN/COORDINATOR/SERVANT.

**Enum** `ActivityEventType` em `packages/types`. **Migration** nova
(`...-ActivityEvents.ts`): tabela + enum + FK + índice em `activity_id`. Nunca editar migrations
existentes.

**Spec**: cada mutação gera o evento esperado com metadados corretos; listagem respeita
visibilidade; status change grava `{ from, to }`.

### packages/types / api-client

- `ActivityEvent` + `ActivityEventType` em `packages/types`. `pnpm build:types`.
- `api-client`: `listEvents(activityId)`. `pnpm build:api-client`.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Hook `useActivityEvents(activityId, { enabled })`; query key `activities.events(activityId)`.
- No `ActivityDetailsDialog`: a moldura de abas da story 65 ganha a aba **Histórico**, ocupando o
  **mesmo espaço** dos comentários. `HistoryTimeline` (lista) + `HistoryEventItem` extraído —
  renderiza cada evento com ícone por tipo, ator, timestamp e um texto humano (ex: "moveu de
  *a fazer* para *fazendo*", "alterou o título", "comentou"). Estados via
  `LoadingState`/`EmptyState`/`ErrorState`.
- Mapa tipo→label/ícone em `constants.ts` da feature.

### Postman

- Adicionar `GET /activities/:id/events` à coleção `fonte-api.postman_collection.json`.

## Validação

- `pnpm build:types` + `pnpm build:api-client`.
- `pnpm test:api` verde, incluindo spec de eventos (cada mutação registra; metadados; visibilidade).
- `pnpm dev:api` sobe e roda a migration.
- adm: `pnpm --filter adm.fonte build`. Smoke: abrir card → alternar abas Comentários/Histórico;
  criar/mover/renomear/comentar e ver os eventos aparecendo na timeline na ordem certa.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Backend: cobrir que **cada mutação** (`create`, `update` de
  título/descrição/responsável, `changeStatus`, `remove`, `COMMENTED`) registra o evento esperado
  com os metadados certos (`{ from, to }`, `{ commentId }`), e a listagem por visibilidade.
  Frontend: hook + render de cada tipo de evento (label/ícone). Rodar `pnpm test:api:cov` + runner
  de cobertura do `adm.fonte`; **não reduzir** a cobertura do módulo `activity` nem da feature
  `activities`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Histórico no `ops.fonte` (backend pronto; UI mobile vira follow-up).
- Diff visual detalhado de descrição (guardar before/after em metadata é suficiente; render rico
  fica fora).
- Filtro/busca/paginação do histórico (lista simples por enquanto).
- Retenção/expurgo de eventos antigos.
