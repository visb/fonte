# Plan: Atividades — drag-and-drop de cards entre colunas

## Context

Follow-up da story 48 (`done/48-atividades-kanban.md`), que entregou o board Kanban de Atividades
movimentando cards por **botões de ação** (avançar/voltar/aprovar) e deixou **drag-and-drop
explicitamente fora de escopo**. Item 3 do BACKLOG: arrastar cards entre colunas para mover a
atividade de status.

### Decisões travadas (defaults automáticos do modo auto — revisar se desejado)

- **Escopo: só `adm.fonte`.** O board de 6 colunas lado a lado existe no web (`adm.fonte`); o
  `ops.fonte` usa lista agrupada/mobile, onde drag entre colunas não encaixa. ops segue com botões.
- **Biblioteca `@dnd-kit`** (core + sortable) — padrão atual de DnD acessível em React, sem
  dependência de HTML5 DnD cru. Adicionar em `apps/adm.fonte`.
- **Backend é a autoridade.** Soltar um card numa coluna dispara `PATCH /activities/:id/status`
  (mesma rota da story 48). O backend valida a matriz de transição **e** a permissão (criador/
  responsável/ADMIN). **Drag-and-drop não relaxa nenhuma regra** — apenas substitui o clique no
  botão pela ação de arrastar.
- **Drop inválido volta atrás.** Se a transição não for permitida (matriz ou permissão), o card
  retorna à coluna original (rollback otimista) e mostra erro via `getErrorMessage`. UX: durante
  o arraste, sinalizar visualmente colunas onde o drop é permitido para o usuário corrente.
- **Sem reordenação dentro da coluna nem prioridade** — segue fora de escopo (igual 48; ordena por
  `updated_at`). DnD só muda de coluna (status).
- **Transição que exige responsável** (`REQUESTED → TODO`, só ADMIN): soltar nessa coluna abre o
  `ApproveActivityDialog` existente (escolher responsável) em vez de mover direto — reaproveita o
  fluxo de aprovação da 48.

## Desenho

Mudança **somente frontend** (`apps/adm.fonte/src/features/activities/`). Reaproveita
`useChangeActivityStatus` e o `ApproveActivityDialog` da story 48.

- Dependência `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities`) no `package.json` do
  adm.
- `ActivityBoard.tsx`: envolver as colunas num `DndContext`. `onDragEnd` resolve coluna de origem/
  destino e dispara a mutation de status (ou abre `ApproveActivityDialog` quando destino = TODO via
  REQUESTED). Atualização otimista com rollback no erro.
- `ActivityColumn.tsx`: vira *droppable* (`useDroppable`), destacando-se quando o card sobre ela
  pode ser solto pelo usuário corrente (consulta a matriz de transição/permissão no client —
  espelha o backend, que continua decidindo de fato).
- `ActivityCard.tsx`: vira *draggable* (`useDraggable`). Preservar o clique que abre o
  `ActivityDetailsDialog` (story 62) — distinguir clique de arraste (activation constraint de
  distância do dnd-kit). Botões de mover **permanecem** como fallback acessível.
- Helper client `canTransition(from, to, user, activity)` na lib da feature, espelhando a matriz do
  service, para habilitar destinos válidos durante o drag (não é a autoridade — só UX).
- Invalidar query keys de atividades após sucesso; em erro, reverter o estado otimista.

## Validação

- Sem mudança de backend/contrato → `pnpm test:api` e `fonte-api.postman_collection.json` não mudam.
- `pnpm --filter adm.fonte build` (typecheck + nova dep).
- Smoke adm: arrastar card entre colunas adjacentes permitidas (move); arrastar para coluna
  proibida (volta + erro); arrastar de "solicitações" para "a fazer" como ADMIN abre o dialog de
  aprovação; clicar no card (sem arrastar) ainda abre o modal de detalhes.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Cobrir com unit (Vitest) o helper `canTransition`
  (destinos válidos/ inválidos por usuário e estado) e a resolução de `onDragEnd` (move / rollback /
  abre dialog). Rodar o runner de cobertura do `adm.fonte`; **não reduzir** a cobertura da feature
  `activities`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- `ops.fonte` (mobile mantém botões/ações).
- Reordenação de cards dentro da coluna e prioridade explícita.
- Qualquer mudança na matriz de transição, permissões ou DTOs do backend.
- Comentários (item 4) e histórico (item 5).
