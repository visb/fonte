# Plan: Atividades — comentários no modal de detalhes

## Context

Follow-up da story 48 (`done/48-atividades-kanban.md`) e da story 62 (modal de detalhes do card).
Item 5 do BACKLOG: adicionar **comentários** no modal de detalhes da atividade. É a primeira das
duas abas que o modal vai ter (a outra é o histórico — item 6/story 66).

Depende da story 62 (que cria o `ActivityDetailsDialog` e deixa a área inferior preparada para
abas). Esta story é greenfield de backend (entidade de comentários nova).

### Decisões travadas (defaults automáticos do modo auto — revisar se desejado)

- **Escopo de UI: `adm.fonte` + `ops.fonte`.** Os comentários entram no `ActivityDetailsDialog`
  da story 62 (web) **e** na tela/modal de detalhes equivalente do ops (story 62 entregou o
  detalhe nos dois apps). Mesmo backend serve os dois. (Correção de escopo solicitada no planning —
  era adm-only por default automático; o usuário pediu ops também.)
- **Quem comenta = quem enxerga a atividade.** Qualquer staff com visibilidade da atividade
  (mesma regra de escopo por casa da story 48: ADMIN tudo; COORDINATOR/SERVANT a própria casa)
  pode comentar e ler comentários. Sem comentário de `RELATIVE`/`RESIDENT`.
- **Comentário é imutável após criado.** Sem edição. **Exclusão**: o próprio autor ou ADMIN
  (soft delete via `deleted_at`, padrão do projeto). Sem ameaçar histórico.
- **Autor = `User`.** Comentário referencia `created_by_user_id`; exibe nome do autor + timestamp.
- **Texto simples.** Sem markdown/anexos/menções nesta versão.

## Desenho

### Backend — entidade `activity_comments` (no módulo `activity`)

`services/api/src/modules/activity/` — seguir o padrão do módulo (entity + DTO + service + controller fino + spec).

**Entity `activity_comments`** (snake_case, UUID, soft delete):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `activity_id` | uuid | FK `activities` (ManyToOne; índice) |
| `body` | text | obrigatório, não vazio |
| `created_by_user_id` | uuid | FK `users` — autor |
| `created_at` | timestamp | |
| `deleted_at` | timestamp nullable | soft delete |

**Endpoints** (`@UseGuards(JwtAuthGuard, RolesGuard)`, roles ADMIN/COORDINATOR/SERVANT):

- `GET /activities/:id/comments` — lista (ordem cronológica) os comentários da atividade. Valida
  **visibilidade** da atividade pelo usuário (reusa `assertVisible` do `activity.service`); 404/403
  se fora do escopo.
- `POST /activities/:id/comments` — cria. Body `CreateActivityCommentDto` (`body` `@IsString
  @IsNotEmpty`). `created_by_user_id = user.userId`. Valida visibilidade.
- `DELETE /activities/:id/comments/:commentId` — soft delete; autor ou ADMIN.

Regras no service (`activity-comment.service.ts` ou métodos no `activity.service`): assertVisible
antes de ler/criar; assertCanDelete (autor || ADMIN). Controller só roteia.

**Migration** nova (`...-ActivityComments.ts`): cria tabela + FK + índice em `activity_id`. Nunca
editar migrations existentes.

**Spec**: criar comentário (visível ok / fora de escopo barrado), listar, deletar (autor ok,
terceiro barrado, ADMIN ok).

### packages/types / api-client

- Tipo `ActivityComment` em `packages/types` (id, activityId, body, author {id,name}, createdAt).
  `pnpm build:types`.
- `api-client`: métodos `listComments(activityId)`, `addComment(activityId, dto)`,
  `deleteComment(activityId, commentId)`. `pnpm build:api-client`.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Hooks: `useActivityComments(activityId, { enabled })`, `useAddComment(activityId)`,
  `useDeleteComment(activityId)`. Query keys: `activities.comments(activityId)` em `queryKeys.ts`.
- No `ActivityDetailsDialog` (story 62): aba/área **Comentários** — lista (`CommentItem` extraído:
  autor, timestamp, corpo, ação de excluir quando permitido) + campo de novo comentário
  (`react-hook-form` + `zod`, `body` não vazio). Estados via `LoadingState`/`EmptyState`/`ErrorState`;
  erros via `getErrorMessage`. Invalidar a query após criar/excluir.
- A estrutura de **abas** (Comentários | Histórico) é introduzida aqui de forma mínima; a aba
  Histórico é preenchida pela story 66.

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- Mesma feature de comentários na tela/modal de detalhes do ops (entregue pela story 62): hooks
  equivalentes, lista de `CommentItem` (componente RN próprio) + campo de novo comentário com
  `Controller` (RHF) + `zod`. Estados (loading/empty/error) e `getErrorMessage` equivalentes do ops.
  Mesma regra de visibilidade/escopo por casa servida pelo backend.

- Adicionar os 3 endpoints de comentários na coleção `fonte-api.postman_collection.json`.

## Validação

- `pnpm build:types` + `pnpm build:api-client` (novo tipo/métodos).
- `pnpm test:api` verde, incluindo spec de comentários (visibilidade, criação, exclusão por
  autor/ADMIN).
- `pnpm dev:api` sobe e roda a migration nova.
- adm: `pnpm --filter adm.fonte build`. Smoke: abrir card → aba Comentários, criar comentário,
  excluir o próprio; conferir que COORDINATOR/SERVANT só vê/comenta em atividade da própria casa.
- ops: typecheck/compila. Smoke (se emulador): abrir detalhe → comentar, listar, excluir o próprio.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Backend: cobrir `assertVisible`/`assertCanDelete` (autor,
  ADMIN, terceiro barrado) e criação/listagem por escopo de casa. Frontend: hooks + `CommentItem`/
  form (validação `body` não vazio) nos dois apps. Rodar `pnpm test:api:cov` + runners de cobertura
  do `adm.fonte` e do `ops.fonte`; **não reduzir** a cobertura do módulo `activity` nem da feature
  `activities`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Edição de comentário, markdown, anexos, menções, notificações de novo comentário.
- Histórico de eventos e a aba Histórico em si (story 66) — aqui só criamos a moldura de abas.
