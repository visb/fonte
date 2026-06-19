# Plan: Atividades — modal de detalhes do card + descrição editável (trava em "fazendo")

## Context

Follow-up da story 48 (`done/48-atividades-kanban.md`), que entregou o módulo Atividades. Item 2
do BACKLOG: ao **clicar num card**, abrir um **modal com todas as informações** da atividade; a
**descrição** é editável pelo ADMIN ou pelo criador, e essa edição fica **bloqueada após a
atividade chegar em "fazendo" (`DOING`)**.

Hoje a story 48 só tem o `ActivityDialog` de criar/editar e movimenta cards por botões — não há
uma visão de detalhe ao clicar. A regra de edição da 48 era: `PATCH /activities/:id` permite editar
conteúdo com **ADMIN sempre; criador só enquanto `DRAFT`**. Esta story **substitui** essa janela
de edição da descrição.

### Decisões travadas

- **Escopo: `adm.fonte` + `ops.fonte`.** adm ganha modal de detalhes ao clicar no card; ops ganha
  tela/modal de detalhes equivalente a partir da lista.
- **Nova regra de edição da descrição** (substitui a da story 48):
  - **ADMIN**: edita a descrição em **qualquer status** (override).
  - **Criador**: edita a descrição em `DRAFT`, `REQUESTED` e `TODO`; ao chegar em **`DOING`**
    (e além — `BLOCKED`, `DONE`) **não edita mais**.
  - Ninguém além de ADMIN/criador edita descrição.
  - Backend é a autoridade — o front esconde/desabilita o campo, mas a regra vive no service.
- **Novo componente `ActivityDetailsDialog`**, separado do `ActivityDialog` de criar/editar. Mostra
  **todas** as infos (título, status, casa, responsável, criador, datas) + edição inline da
  descrição quando permitido. Decisão prepara terreno para as abas de comentários (item 5) e
  histórico (item 6), que entram nesse mesmo modal depois.
- **Edição da descrição inline no modal** (não abre outro dialog). Demais campos seguem editáveis
  pelos fluxos já existentes (dialog de edição / ação de status) — esta story não muda isso.

## Desenho

### Backend — ajuste de regra (`services/api/src/modules/activity/`)

- Extrair/ajustar helper `canEditDescription(activity, user)` no `activity.service.ts`:
  - `true` se `user` é ADMIN.
  - `true` se `user` é o criador (`createdBy.userId === user.userId`) **e**
    `activity.status ∈ { DRAFT, REQUESTED, TODO }`.
  - senão `false`.
- `update()` (`PATCH /activities/:id`) aplica o helper ao mudar `description`: se vier
  `description` no DTO e `!canEditDescription` → `ForbiddenException`. (Regras de `title`/`houseId`
  permanecem como na 48; só a janela da **descrição** muda.)
- Atualizar `activity.service.spec.ts`: criador edita descrição em TODO (ok), criador em DOING
  (proibido), ADMIN edita descrição em DOING (ok).
- Sem mudança de rota/DTO/response shape → contrato HTTP igual. (Conferir `fonte-api.postman_collection.json`;
  só atualizar se a descrição de comportamento da rota precisar refletir a nova regra.)

### packages/types / api-client

- Sem novos métodos — reusa `getById` e `update` existentes. `Activity` já carrega os campos do
  detalhe (status, casa, responsável, criador, datas) da story 48; se faltar algum no payload de
  `getById`, incluir no `relations`/select do `findOne` do backend.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- `ActivityCard.tsx`: clique no card abre o `ActivityDetailsDialog` (estado de "card aberto" no
  `ActivityBoard`/`ActivitiesPage`). Não conflitar com os botões de mover (stopPropagation).
- Novo `components/ActivityDetailsDialog.tsx`:
  - Autossuficiente: recebe `activityId`, busca via `useActivity(id, { enabled: open })`.
  - Exibe todas as infos (status badge, casa, responsável com nome, criador, created/updated_at,
    descrição).
  - Descrição editável inline (textarea RHF + zod) **só quando** o helper de permissão do front
    (espelha o backend) liberar; senão renderiza só-leitura. Salva via `useUpdateActivity`.
  - Erros via `getErrorMessage`; estados via `LoadingState`/`ErrorState`.
  - Estrutura preparada para abas (placeholder de área inferior — comentários/histórico entram
    nos itens 5 e 6).
- Helper `canEditDescription(activity, user)` na lib da feature (mesma regra do backend).

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- Tela/modal de detalhes (`pages/ActivityDetailPage.tsx` ou modal) acessível ao tocar o card na
  lista. Mostra as mesmas infos; descrição editável via `Controller` (RHF) quando permitido.
- Componentes de estado equivalentes; `getErrorMessage` equivalente. Rota Expo Router seguindo o
  padrão de `incidents` se for tela dedicada.

## Validação

- Backend: `pnpm test:api` verde, incluindo os novos casos de `canEditDescription`.
- `pnpm build:types` / `pnpm build:api-client` só se algum tipo mudar (provável que não).
- **adm**: `pnpm --filter adm.fonte build`. Smoke: clicar card abre modal com todas as infos; como
  criador editar descrição em "a fazer" (ok) e tentar em "fazendo" (campo bloqueado); como ADMIN
  editar descrição em "fazendo" (ok).
- **ops**: typecheck/compila. Smoke (se emulador): abrir detalhe, editar descrição onde permitido.

## Fora de escopo

- Comentários no modal (item 5 / story dedicada).
- Histórico e abas comentários|histórico (item 6 / story dedicada) — só deixamos o modal preparado.
- Drag-and-drop (item 3) e visual de responsável no card (item 4).
- Mudança nas regras de edição de `title`/`houseId` ou na matriz de transição de status da 48.
