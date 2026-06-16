# Plan: Atividades — board Kanban (adm.fonte + ops.fonte)

## Context

Não existe hoje nenhum lugar para a casa registrar e acompanhar **tarefas operacionais**
(manutenção, compras, demandas internas). `grep` por activity/atividade/task/kanban vazio no
backend — é greenfield full-stack. O módulo é alimentado por **dois apps**: `ops.fonte`
(coordenadores/servos da casa) e `adm.fonte` (gestão central).

Modelo: board Kanban com 6 colunas, da esquerda para a direita:

1. **rascunho** (`DRAFT`)
2. **solicitações** (`REQUESTED`)
3. **a fazer** (`TODO`)
4. **fazendo** (`DOING`)
5. **impedimento** (`BLOCKED`)
6. **concluídas** (`DONE`)

Decisões travadas com o usuário (`/issue`):

- **Acesso = só staff.** Apenas `ADMIN`, `COORDINATOR`, `SERVANT`. Nenhum acesso para
  `RELATIVE`/`RESIDENT`.
- **Escopo por casa.** `ADMIN` vê tudo. `COORDINATOR`/`SERVANT` veem **apenas** atividades da
  casa em que servem (`activity.house_id === staff.house_id`). Atividade **sem casa**
  (`house_id = null`) é geral e visível **só para `ADMIN`**.
- **Responsável obrigatório a partir de "a fazer".** Toda atividade tem um responsável que é
  **staff** (qualquer staff). `rascunho` e `solicitações` podem ficar sem responsável;
  ao mover para `a fazer` o responsável passa a ser obrigatório. **Quem define/atribui o
  responsável é o `ADMIN`**, na aprovação ou ao criar direto em "a fazer".
- **Casa = opcional.** Atividade pode ou não estar ligada a uma `House`.
- **Regras de transição:**
  - Criar em `rascunho`: qualquer staff (ops ou ADMIN).
  - `rascunho → solicitações`: o **próprio criador** da atividade (ou ADMIN). "Enviar".
  - `solicitações → a fazer`: **só ADMIN** (aprovação; exige responsável). ADMIN também pode
    **criar direto em "a fazer"**.
  - `a fazer ↔ fazendo ↔ impedimento ↔ concluídas`: **só o responsável da atividade + ADMIN**.
- **Rascunho é visível a todo o escopo** (mesma regra de casa) — não é privado do criador. Só
  marca o estágio "ainda não enviado". O criador é quem promove para `solicitações`.

Trade-offs aceitos: ordem das colunas é fixa (enum), sem reordenação de cards dentro da coluna
nem prioridade explícita nesta versão (ordena por `updated_at`). Sem comentários/anexos/checklist
no card nesta versão. Responsável é qualquer staff (não restrito à casa da atividade) — ADMIN
decide; restrição por casa pode virar regra depois se o usuário pedir.

## Desenho

### Backend — novo módulo `activity` (`services/api/src/modules/activity/`)

Espelha o padrão de `incident` (entity + controller fino + service + DTOs + module + spec) e
reaproveita o padrão de **scoping por casa** de `notification.service` (resolve `houseId` do
`Staff` a partir do `userId` do JWT — o JWT **não** carrega `houseId`).

**Entity `activities`** (tabela `activities`, snake_case, UUID, soft delete):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `title` | varchar | obrigatório |
| `description` | text nullable | |
| `status` | enum `ActivityStatus` | DRAFT \| REQUESTED \| TODO \| DOING \| BLOCKED \| DONE (default DRAFT) |
| `house_id` | uuid nullable | FK `houses` — escopo opcional |
| `responsible_staff_id` | uuid nullable | FK `staff` — responsável (obrigatório de TODO em diante) |
| `created_by_user_id` | uuid | FK `users` — quem criou (define quem promove rascunho) |
| `created_at` / `updated_at` | timestamps | |
| `deleted_at` | timestamp nullable | soft delete |

Relations: `house` (ManyToOne, nullable), `responsible` (ManyToOne `Staff`, nullable),
`createdBy` (ManyToOne `User`). Em listagens, carregar `house` e `responsible` (com nome).

**Enum** em `packages/types/src/index.ts`: `ActivityStatus`. Exportar também o tipo
compartilhado `Activity` se o repo expõe tipos de entidade para o front (seguir o que
`Incident`/`Associate` fazem). Labels de coluna ficam no front (constants).

**Endpoints** (`@Controller('activities')`, `@UseGuards(JwtAuthGuard, RolesGuard)`):

- `GET /activities?houseId=&status=&responsibleStaffId=` — lista **escopada pelo usuário**
  (`@CurrentUser`). ADMIN: todas (filtros opcionais). COORDINATOR/SERVANT: força
  `house_id = staff.houseId` e **exclui** `house_id IS NULL`. Roles: ADMIN, COORDINATOR, SERVANT.
- `GET /activities/:id` — detalhe (valida escopo; 404 se fora do escopo do usuário).
- `POST /activities` — cria. ADMIN pode criar em `DRAFT` ou `TODO` (com responsável). ops cria
  só em `DRAFT`. `created_by_user_id = user.userId`. Roles: ADMIN, COORDINATOR, SERVANT.
- `PATCH /activities/:id` — edita conteúdo (`title`, `description`, `houseId`). ADMIN sempre;
  criador só enquanto `DRAFT`. Reatribuir `responsibleStaffId`: **só ADMIN**.
- `PATCH /activities/:id/status` — **transição** (`{ status, responsibleStaffId? }`). Valida a
  matriz de transição + permissão (ver regras). Aqui mora a regra de negócio.
- `DELETE /activities/:id` — soft delete. ADMIN sempre; criador só o próprio `DRAFT`.

DTOs com `class-validator`: `CreateActivityDto` (`title` `@IsString @IsNotEmpty`, `description?`
`@IsOptional @IsString`, `houseId?` `@IsOptional @IsUUID`, `status?` `@IsOptional @IsEnum`,
`responsibleStaffId?` `@IsOptional @IsUUID`), `UpdateActivityDto` (partial de conteúdo +
`responsibleStaffId?`), `ChangeActivityStatusDto` (`status` `@IsEnum`, `responsibleStaffId?`
`@IsOptional @IsUUID`), `ListActivitiesQueryDto` (filtros opcionais).

**Regras no service** (`activity.service.ts`), não no controller:

- `resolveHouseId(user)` — copiar abordagem de `notification.service` (lazy via Staff repo).
- `assertVisible(activity, user, houseId)` — ADMIN tudo; senão `activity.houseId === houseId`
  (e `houseId != null`). Aplica em `findOne`/`changeStatus`/`update`/`remove`.
- `canTransition(from, to)` — matriz de transições válidas (adjacência das colunas; `DRAFT→REQUESTED`;
  `REQUESTED→TODO`; `TODO↔DOING`, `DOING↔BLOCKED`, `BLOCKED↔DOING/DONE`, `DOING↔DONE`; permitir
  voltar uma coluna no fluxo de trabalho — definir o conjunto explícito no código com comentário).
- `assertCanChangeStatus(activity, from, to, user)`:
  - `DRAFT → REQUESTED`: `user` é o criador **ou** ADMIN.
  - `REQUESTED → TODO`: **ADMIN**; exige responsável (no body ou já setado) → senão `BadRequest`.
  - transições no bloco de trabalho (TODO/DOING/BLOCKED/DONE): ADMIN **ou** `user` é o
    `responsible` (match `responsible.userId === user.userId`).
- Criar com `status=TODO` exige ADMIN + responsável. ops forçado a `DRAFT`.

**Migration** `services/api/src/database/migrations/1782900000000-Activities.ts` — cria enum
`activities_status_enum` + tabela `activities` com FKs e índices (`house_id`, `status`,
`responsible_staff_id`). Nunca editar migrations existentes.

**Spec** `activity.service.spec.ts` cobrindo: scoping (coord não vê casa alheia nem houseless),
criação ops força DRAFT, promote DRAFT→REQUESTED só criador/ADMIN, REQUESTED→TODO só ADMIN e
exige responsável, transição de trabalho só responsável/ADMIN, transição inválida barrada,
soft delete.

### packages/types

`export enum ActivityStatus { DRAFT, REQUESTED, TODO, DOING, BLOCKED, DONE }` (+ tipo `Activity`
se aplicável). `pnpm build:types`.

### api-client — `packages/api-client/src/modules/activities.ts`

Métodos `list(params)`, `getById(id)`, `create(dto)`, `update(id, dto)`,
`changeStatus(id, body)`, `remove(id)`. Registrar no `index.ts`. `pnpm build:api-client`.

### Frontend adm.fonte — feature `apps/adm.fonte/src/features/activities/`

```
activities/
  hooks/useActivities.ts     ← useActivities(filters), useActivity(id), useCreateActivity,
                                useUpdateActivity, useChangeActivityStatus, useDeleteActivity
  lib/activitySchema.ts      ← zod (react-hook-form)
  constants.ts               ← ACTIVITY_COLUMNS (ordem+label+status), badges/variantes
  components/
    ActivityBoard.tsx        ← board com as 6 colunas (KanbanColumn extraído)
    ActivityColumn.tsx       ← uma coluna (header + lista de cards)
    ActivityCard.tsx         ← item extraído (título, casa, responsável, ações de mover)
    ActivityFilters.tsx      ← filtro por casa / responsável
    ActivityDialog.tsx       ← criar/editar (autossuficiente: busca casas e staff)
    ApproveActivityDialog.tsx← REQUESTED→TODO: escolhe responsável e aprova
  pages/ActivitiesPage.tsx   ← orquestra; sem fetch direto
```

- Board completo (6 colunas), ADMIN vê todas. Mover card via botões de ação no card (avançar/
  voltar/aprovar) respeitando o que o backend permite — **não** confiar só no front; o backend
  é a autoridade. (Drag-and-drop fica fora de escopo; usar botões.)
- ApproveActivityDialog para `solicitações → a fazer` com seleção de responsável (staff).
- Query keys em `apps/adm.fonte/src/lib/queryKeys.ts`: `activities.all`, `.list(filters)`,
  `.detail(id)`. **Nunca** string literal inline.
- Estados via `LoadingState`/`EmptyState`/`ErrorState`. Erros via `getErrorMessage`. Form com
  `react-hook-form` + `zod`. Dialog autossuficiente (busca casas/staff via hooks existentes).
- Navegação: novo item "Atividades" no `AppLayout.tsx` + rota em `App.tsx` sob
  `ProtectedRoute` com `allowedRoles={[Role.ADMIN, Role.COORDINATOR, Role.SERVANT]}`. Ícone
  `KanbanSquare`/`ListChecks` (lucide).

### Frontend ops.fonte — feature `apps/ops.fonte/features/activities/`

Padrão de `features/incidents` (`components/`, `hooks/`, `pages/`). Mobile não usa board de 6
colunas lado a lado: usar **lista agrupada por coluna** (seções) ou seletor de coluna.

```
activities/
  hooks/useActivities.ts     ← query escopada (backend já filtra por casa) + mutations
  components/
    ActivityCard.tsx         ← card com casa/responsável/status e ações permitidas
    ActivityFormFields.tsx   ← Controller (RHF) — title, description, casa (a própria)
    StatusBadge.tsx
  pages/
    ActivitiesPage.tsx       ← lista agrupada por status da casa do usuário
    NewActivityPage.tsx      ← cria rascunho
```

- ops cria **rascunho**; o criador "envia" (DRAFT→REQUESTED); responsável move seus cards no
  bloco de trabalho. Sem ações de ADMIN (aprovar/atribuir) no ops.
- Componentes de estado equivalentes aos do app (criar/adotar loading/empty/error se ainda não
  existirem — checar antes). `Controller` obrigatório nos inputs RN.
- Rota Expo Router: `apps/ops.fonte/app/(app)/activities/` + entrada no `_layout.tsx`/dashboard,
  seguindo `incidents`.

### Postman

Atualizar `fonte-api.postman_collection.json` com os 6 endpoints (pasta "Activities").

## Validação

- `pnpm build:types` (novo enum) e `pnpm build:api-client`.
- Backend: `pnpm test:api` verde, incluindo `activity.service.spec.ts` novo.
- `pnpm dev:api` sobe sem erro; rodar a migration (tabela + enum criados).
- adm: typecheck/compila (`pnpm --filter adm.fonte build`). Smoke: como ADMIN criar em "a fazer"
  com responsável, aprovar uma solicitação, mover card; conferir que COORDINATOR/SERVANT só vê a
  própria casa e não vê atividade sem casa.
- ops: compila (typecheck). Smoke (se emulador disponível): criar rascunho, enviar para
  solicitações, mover card onde é responsável.

## Fora de escopo

- Drag-and-drop entre colunas (usar botões de ação).
- Comentários, anexos, checklist, prioridade e reordenação de cards dentro da coluna.
- Notificações (Sentry/push/in-app) de mudança de status — pode virar follow-up.
- Acesso de `RELATIVE`/`RESIDENT`.
- Restrição do responsável à casa da atividade (responsável = qualquer staff por ora).
- Métricas/relatórios de produtividade.
