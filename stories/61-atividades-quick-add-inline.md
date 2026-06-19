# Plan: Atividades — criação inline de card por coluna (quick-add estilo Trello)

## Context

A story 48 (`done/48-atividades-kanban.md`) entregou o módulo **Atividades**: board Kanban de 6
colunas no `adm.fonte`, lista agrupada por status no `ops.fonte`, backend completo (`activity`
module) e criação via `ActivityDialog`. Esta story é um **follow-up de UX**: trazer a criação
rápida estilo Trello — no fim da lista de cards de uma coluna há um campo para digitar o **título**
e criar a atividade ali, **sem abrir o modal**.

Item 1 do BACKLOG: *"criar atividades em todas as colunas; cada coluna tem, no fim da lista, um
espaço para inserir o título de uma nova task e criar ali, sem modal"*.

### Decisões travadas

- **Escopo: `adm.fonte` + `ops.fonte`.** Os dois apps ganham quick-add. No adm é o board de 6
  colunas; no ops é a lista agrupada por status (cada seção/coluna ganha seu campo).
- **Sem mudança de backend / regra de negócio.** O backend da story 48 continua sendo a
  autoridade sobre **onde** cada usuário pode criar:
  - ops cria só em **rascunho** (`DRAFT`).
  - ADMIN cria em **rascunho** (`DRAFT`) ou **a fazer** (`TODO`, exige responsável).
  Logo o quick-add **só aparece nas colunas em que o usuário corrente pode criar**. "Criar em
  todas as colunas" fica condicionado à matriz de permissão já existente — não relaxamos regra.
- **Quick-add só pede o título.** Igual ao Trello: digita o título, Enter → cria. Demais campos
  (descrição, casa, responsável) ficam para edição posterior no card/modal. `POST /activities`
  com `{ title, status: <coluna> }` (e `houseId` resolvido pelo backend/escopo como hoje).
  - Exceção da coluna "a fazer" do ADMIN, que exige responsável no backend: nessa coluna **não**
    exibir quick-add (criar lá continua pelo `ActivityDialog`/aprovação, que já coleta
    responsável). Quick-add fica nas colunas sem campo obrigatório além do título.
- **Sem otimismo arriscado:** após criar, invalidar as query keys de atividades e deixar a lista
  refletir o backend (fonte da verdade do escopo/colunas).

## Desenho

Mudança **somente frontend** — reaproveita `useCreateActivity` e o `api-client` já existentes da
story 48.

### adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Novo componente `QuickAddCard.tsx`: input de título + ação de criar (Enter cria, Esc/blur vazio
  cancela). Estado de "adicionando" local ao componente. Form com `react-hook-form` + `zod`
  (schema mínimo: `title` não vazio) — sem `useState` solto para o campo.
- `ActivityColumn.tsx` renderiza `<QuickAddCard status={column.status} houseId? />` no rodapé da
  coluna **apenas se** o usuário corrente pode criar naquele status (helper de permissão no
  `constants.ts`/lib da feature, espelhando a matriz do backend; ADMIN: DRAFT; ops: DRAFT —
  TODO fica de fora por exigir responsável).
- Usa `useCreateActivity` (hook existente). Erros via `getErrorMessage`. Após sucesso, limpar o
  campo e manter o modo de adição aberto (estilo Trello permite criar vários em sequência).

### ops.fonte (`apps/ops.fonte/features/activities/`)

- Componente equivalente `QuickAddCard.tsx` (RN): `TextInput` via `Controller` (RHF), botão/See
  return-key para criar. Aparece só na seção **rascunho** (única coluna onde ops cria).
- Inserido no rodapé da seção correspondente em `ActivitiesPage.tsx`.
- Estados/erros seguindo os componentes de estado do app; `getErrorMessage` equivalente.

### constants/permissão

- Helper `canQuickAddInStatus(status, user)` compartilhado na feature de cada app (não cruza
  apps) — mantém a regra de exibição alinhada ao backend e fácil de ajustar se a matriz mudar.

## Validação

- **adm**: `pnpm --filter adm.fonte build` (typecheck). Smoke: como ADMIN, criar card inline na
  coluna "rascunho" digitando só o título; confirir que aparece e que a coluna "a fazer" **não**
  mostra quick-add. Como COORDINATOR/SERVANT, quick-add só em "rascunho".
- **ops**: typecheck/compila. Smoke (se emulador disponível): criar rascunho inline na seção
  rascunho.
- Sem mudança de endpoint/contrato → `fonte-api.postman_collection.json` e `pnpm test:api` não
  mudam. (Se algum spec de front existir para a feature, atualizar.)

## Fora de escopo

- Qualquer mudança de backend, DTO, regra de transição ou matriz de permissão da story 48.
- Quick-add em colunas que exigem campos além do título (ex: "a fazer" do ADMIN, que exige
  responsável — continua via dialog/aprovação).
- Edição inline de outros campos no card (descrição, responsável) — é a story do modal de
  detalhes (item 2).
- Drag-and-drop (item 3), comentários (item 5), histórico (item 6).
