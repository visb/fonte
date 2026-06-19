# Plan: Atividades — devolver solicitação para rascunho (REQUESTED → DRAFT)

## Context

Follow-up do board Kanban de Atividades (`done/48-atividades-kanban.md`) e do drag-and-drop
(`done/63-atividades-drag-and-drop.md`). Item do BACKLOG: **"deve ser permitido mover uma
atividade de 'solicitações' para 'rascunho'"**.

Hoje a matriz de transição do backend (`activity.service.ts`, const `TRANSITIONS`) só permite
`REQUESTED → TODO`. Não há como **desfazer um envio**: depois que o criador promove `DRAFT →
REQUESTED` ("enviar"), a atividade fica presa em solicitações até o ADMIN aprovar (ou ser
deletada). Falta a aresta de volta `REQUESTED → DRAFT` ("devolver para rascunho"), útil para o
criador puxar de volta e corrigir antes de reenviar, e para o ADMIN devolver uma solicitação que
ainda não está pronta para virar tarefa.

### Decisões travadas (refinadas com o usuário)

- **Permissão = criador OU ADMIN.** Espelha a regra de `DRAFT → REQUESTED` ("enviar"). O criador
  cancela/puxa o próprio envio; o ADMIN devolve a solicitação para revisão. (Descartado "só ADMIN"
  e "só criador".)
- **Escopo = adm.fonte + ops.fonte.** Os dois apps ganham a ação. No `adm.fonte` ela existe via
  drag-and-drop (arrastar card de solicitações para rascunho) **e** botão de mover; no `ops.fonte`
  via botão "Devolver para rascunho" no card (mobile mantém botões, sem drag entre colunas).
- **Sem novo campo / sem novo endpoint.** Reusa `PATCH /activities/:id/status` com
  `{ status: DRAFT }`. Só muda a matriz e a regra de permissão por transição. Nenhuma mudança de
  DTO, entidade ou migration.
- **Responsável não é alterado pela devolução.** Se a atividade já tivesse um `responsibleStaffId`
  setado (caso o ADMIN tenha pré-atribuído antes de aprovar), ele é **preservado** ao voltar para
  DRAFT — não é regra desta story limpar. Mover de volta para TODO depois reaplica a regra de
  responsável obrigatório da 48.
- **Backend é a autoridade.** O front espelha a permissão só para habilitar/desabilitar a ação
  (UX); o service continua decidindo e barrando.

## Desenho

### Backend — `services/api/src/modules/activity/activity.service.ts`

1. **Matriz `TRANSITIONS`**: adicionar `DRAFT` ao array de `REQUESTED`:
   ```ts
   [ActivityStatus.REQUESTED]: [ActivityStatus.TODO, ActivityStatus.DRAFT],
   ```
   Atualizar o comentário-doc da matriz incluindo `REQUESTED → DRAFT (devolver / desfazer envio)`.

2. **`assertCanChangeStatus`**: novo ramo, antes/junto do ramo `REQUESTED → TODO`:
   ```ts
   // REQUESTED → DRAFT: criador ou ADMIN (espelha o "enviar").
   if (from === ActivityStatus.REQUESTED && to === ActivityStatus.DRAFT) {
     if (!admin && activity.createdByUserId !== user.userId) {
       throw new ForbiddenException(
         'Only the creator or ADMIN can return a request to draft',
       );
     }
     return;
   }
   ```
   Nenhuma mutação de `responsibleStaffId` aqui (preservado).

Sem mudança de DTO, entity, migration ou contrato. `assertVisible` já cobre escopo por casa.

### packages/types / api-client

Nada muda — `changeStatus(id, { status })` já existe e `ActivityStatus.DRAFT` já é exportado.

### Frontend adm.fonte — `apps/adm.fonte/src/features/activities/`

- **Helper client `canTransition`** (lib da feature, criado na story 63 espelhando a matriz):
  adicionar a aresta `REQUESTED → DRAFT` e a regra de permissão (ADMIN **ou** `activity.createdByUserId
  === currentUser.userId`). Assim a coluna **rascunho** vira destino válido de drop quando o card
  de solicitações pertence ao usuário corrente (ou ele é ADMIN), e o card destaca a coluna.
- **`ActivityBoard.tsx` / `onDragEnd`**: soltar um card de `REQUESTED` na coluna `DRAFT` dispara
  `useChangeActivityStatus(id, { status: DRAFT })` (otimista + rollback no erro, igual às demais
  transições). **Não** abre dialog (diferente de `REQUESTED → TODO`, que abre o ApproveDialog).
- **`ActivityCard.tsx`**: botão/ação de mover "Devolver para rascunho" como fallback acessível,
  exibido quando `canTransition(REQUESTED, DRAFT, user, activity)` é verdadeiro. Mantém os botões
  existentes como padrão da 48.
- Query keys de atividades invalidadas no sucesso (já é o padrão das mutations da feature).

### Frontend ops.fonte — `apps/ops.fonte/features/activities/`

- **`ActivityCard.tsx`**: na atividade em `REQUESTED` cujo criador é o usuário corrente, exibir
  ação **"Devolver para rascunho"** que chama a mutation de status com `{ status: DRAFT }`.
  Espelha a permissão (criador). ADMIN não opera pelo ops (segue a 48).
- Reusa o hook de mutation de status já existente na feature (`useChangeActivityStatus`/
  equivalente); sem novo hook.

### Postman

`fonte-api.postman_collection.json`: o endpoint `PATCH /activities/:id/status` já existe. Apenas
revisar/garantir um exemplo cobrindo `{ "status": "DRAFT" }` (devolução) na pasta "Activities" —
sem novo endpoint.

## Validação

- **Backend** (`pnpm test:api` verde) — estender `activity.service.spec.ts`:
  - `REQUESTED → DRAFT` permitido para o **criador** (não-ADMIN).
  - `REQUESTED → DRAFT` permitido para **ADMIN** (não-criador).
  - `REQUESTED → DRAFT` **barrado** (`ForbiddenException`) para staff que não é criador nem ADMIN.
  - Escopo: coord de outra casa recebe 404/forbidden (já coberto por `assertVisible`, garantir
    que o caminho novo não fura o escopo).
  - `responsibleStaffId` pré-existente **preservado** após a devolução.
  - Transição inválida intacta: `REQUESTED → DOING`/`BLOCKED`/`DONE` continua `BadRequest`.
- **adm.fonte** (`pnpm --filter adm.fonte build` + runner de cobertura) — unit (Vitest):
  - `canTransition`: `REQUESTED → DRAFT` válido para ADMIN e para o criador; inválido para outro
    staff; demais arestas inalteradas.
  - `onDragEnd`: soltar REQUESTED→DRAFT permitido dispara a mutation (move) e **não** abre dialog;
    drop proibido faz rollback + erro via `getErrorMessage`.
- **ops.fonte** (typecheck + runner de cobertura do app) — unit:
  - a ação "Devolver para rascunho" aparece só para o criador em `REQUESTED` e dispara a mutation
    com `{ status: DRAFT }`.
- Smoke (se ambiente disponível): no adm, como criador, arrastar a própria solicitação de volta
  para rascunho (move) e editar; como ADMIN, devolver solicitação alheia; tentar como staff não
  criador (negado). No ops, criador devolve o próprio envio.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado (matriz, ramo de permissão,
  `canTransition`, `onDragEnd`, ação no ops) tem teste correspondente — código novo sem teste não
  fecha a story. Rodar `pnpm test:api:cov` + runners de cobertura dos apps tocados; **não reduzir**
  a cobertura da feature `activities`. Sem `skip`/`only`/`xfail` sem justificativa no código
  (CLAUDE.md).

## Fora de escopo

- Qualquer outra aresta de transição nova (ex.: `TODO → REQUESTED`, voltar do bloco de trabalho
  para solicitações/rascunho).
- Reordenação de cards dentro da coluna, prioridade, comentários, anexos, histórico.
- Limpar/alterar `responsibleStaffId` na devolução (preservado por decisão).
- Notificação (push/in-app) de devolução para rascunho — pode virar follow-up.
- Drag-and-drop no `ops.fonte` (mobile mantém botões).
