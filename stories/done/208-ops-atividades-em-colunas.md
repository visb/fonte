# Plan: atividades em colunas (abas por status) no `ops.fonte`

## Context

No `adm` as atividades são um quadro kanban: uma coluna por status, lado a lado, todas visíveis
mesmo vazias (`ActivityBoard` / `ActivityColumn`). No `ops` são uma lista vertical única
(`SectionList`) cortada em seções por status. As seções vazias somem, exceto a de rascunho (por causa
do quick-add). Com muitas atividades, o operador precisa rolar tudo para achar a coluna que quer.
Backlog: *"no app ops, atividades, mostrar as atividades em colunas igual no app adm"*.

### Decisões travadas (usuário)

1. **Abas por status no topo, uma coluna por vez em tela cheia.** Fica uma faixa de chips roláveis
   com contador (`Rascunhos 0 · Solicitações 2 · A fazer 3 · …`), na ordem do `adm`/backend.
   Tocar no chip troca a coluna. No celular cabe uma coluna por vez, então não há board lado a lado.
2. **Sem arrastar e soltar.** O status continua mudando pelas ações do card (`ActivityCardActions`),
   que já são offline-first e testadas. Drag em RN com rolagem horizontal e vertical juntas é frágil.
3. **Todas as colunas aparecem, mesmo vazias**, igual ao `adm`. A posição das abas fica estável e a
   coluna vazia mostra `EmptyState` ("Nenhuma atividade").

### Decisões de desenho (defaults assumidos no refino)

4. **Swipe também troca a coluna**: `FlatList` horizontal com `pagingEnabled`, uma página por
   status, sincronizada com os chips (o chip ativo rola para ficar visível). Sem lib nova
   (nada de `react-native-pager-view` / `tab-view`).
5. **Aba inicial**: a primeira coluna, na ordem, que tem itens. Se todas estiverem vazias, abre em
   *Rascunhos* (onde fica o quick-add). A aba escolhida fica em estado local da tela, sem
   persistência.
6. **Mudar o status de um card não troca de aba.** O card sai da coluna atual e o contador das duas
   abas se atualiza. Isso vale também para a atualização otimista offline.
7. **Quick-add** (`QuickAddCard`) fica no rodapé da coluna onde `canQuickAddInStatus` permite (hoje
   só `DRAFT`). O FAB "Nova atividade" e o pull-to-refresh (por coluna) continuam.
8. **Ordem e rótulos num lugar só**: o `SECTION_ORDER` local da página vai para
   `features/activities/constants.ts` como `ACTIVITY_COLUMNS` (status, título).

---

## Desenho (`ops.fonte`, frontend-only)

```
features/activities/
  constants.ts                       ← ACTIVITY_COLUMNS (sai de ActivitiesPage)
  components/ActivityStatusTabs.tsx  ← chips roláveis com contador; onSelect(status)
  components/ActivityColumn.tsx      ← FlatList vertical de ActivityCard + quick-add + EmptyState + refresh
  pages/ActivitiesPage.tsx           ← orquestra: agrupa por status, aba ativa, pager horizontal
```

- `ActivitiesPage` só orquestra: `useActivities`, `useChangeActivityStatus`, `useIsOnline`, o
  agrupamento por status e a aba ativa. O pager é `FlatList horizontal pagingEnabled` de
  `ActivityColumn`, com `onMomentumScrollEnd` atualizando a aba e `scrollToIndex` ao tocar no chip.
- Componentes ≤ ~150 linhas (CLAUDE.md). O agrupamento e a regra de aba inicial ficam numa função
  pura testável (`lib/groupByStatus.ts` ou similar).
- Loading/erro continuam com `LoadingState`/`ErrorState`; vazio por coluna, com `EmptyState`.
- Nenhuma mudança em hooks, mutations, query keys ou offline. É só apresentação.

---

## Validação

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **Agrupamento / aba inicial** (função pura):
  - distribui as atividades pelos 6 status na ordem de `ACTIVITY_COLUMNS`;
  - a aba inicial é a primeira com itens;
  - tudo vazio → `DRAFT`.
- **`ActivityStatusTabs`**:
  - renderiza as 6 abas com contador certo, inclusive 0;
  - tocar numa aba chama `onSelect` com o status;
  - a aba ativa fica destacada.
- **`ActivityColumn`**:
  - lista os cards da coluna;
  - coluna vazia → `EmptyState`;
  - quick-add só na coluna `DRAFT`.
- **`ActivitiesPage`**:
  - loading e erro pelos componentes compartilhados;
  - colunas vazias aparecem como aba;
  - trocar de aba mostra os cards daquele status;
  - mudar o status de um card (mock da mutation) mantém a aba ativa e atualiza os contadores;
  - FAB navega para `/activities/new`.
- Atualizar os testes existentes que dependem da `SectionList` (`ActivityComponents.test.tsx`,
  `ActivityCardOffline.test.tsx` etc.) sem perder os casos que eles cobrem.

### `ops.fonte`: Maestro (`pnpm test:ops`)

- Novo `e2e/activities.yaml`: menu → Atividades → as abas aparecem → tocar em *A fazer* mostra a
  atividade do seed. Se o seed não tiver atividade, criar a fixture pelo fluxo de criação no próprio
  teste (quick-add em Rascunhos) e conferir na aba *Rascunhos*. A limpeza segue a story 182.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:ops:unit` com cobertura: `features/activities`
sem reduzir, e componentes novos ≥90%. Sem `skip`/`only`/`xfail` sem justificativa explícita no
código (CLAUDE.md).

---

## Fora de escopo

- **Arrastar e soltar** entre colunas (decisão 2).
- **Filtros** (responsável, ministério, prazo) como no `ActivityFilters` do `adm`.
- **Board lado a lado em tablet**: uma coluna por vez em qualquer largura.
- Persistir a última aba entre sessões.
- Mudanças no backend, nas regras de transição ou no fluxo offline de atividades.
