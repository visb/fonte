# Plan: Detalhes da casa — aba Filhos com paginação, filtros e busca

## Context

Bloco **App adm → Detalhes da casa** do BACKLOG.

Na tela de detalhe da casa (`HouseDetailPage`), a aba **Filhos** (`ResidentsTab`) lista hoje **todos**
os residents da casa de uma vez, sem paginação, filtros ou busca
(`apps/adm.fonte/src/features/houses/components/tabs/ResidentsTab.tsx:34` →
`useHouseResidents(houseId)` → `api.houses.listResidents(houseId)`). Em casas cheias isso fica
pesado e sem como filtrar/buscar. O item pede o mesmo padrão da listagem `/residents`: infinite
scroll + filtros + busca.

Levantamento do planning — a infra de `/residents` já existe e é reusável:

- `useInfiniteResidents(params)` (`apps/adm.fonte/src/features/residents/hooks/useResidents.ts:15`)
  **já aceita `houseId`** e pagina (limit 20, `getNextPageParam`, retorna `total`). O backend do
  `GET /residents` já filtra por `houseId` + `search` + `status` + `sort`/`order` com paginação.
- `ResidentsPage` (`.../residents/pages/ResidentsPage.tsx`) é o modelo: `ResidentsFilters` (busca,
  status, casa, overdue, sort), `useDebounce` na busca, sentinela `IntersectionObserver` p/
  `fetchNextPage`, `ResidentCard` por item.

Decisões travadas (defaults recomendados, sem ambiguidade que mude produto):

- A aba **reusa `useInfiniteResidents`** com `houseId` **fixo** (o da casa), não um endpoint novo.
  `useHouseResidents`/`api.houses.listResidents` deixa de ser usado pela aba (remover se ficar órfão).
- Filtros da aba = paridade com `/residents` **menos o seletor de Casa** (casa é fixa): busca,
  status, overdue, sort. Infinite scroll idêntico.
- Estado dos filtros/busca **local à aba** (`useState`), **sem** persistir em preferência e **sem**
  escrever na URL (a URL de `HouseDetailPage` já carrega o `tab`; não colidir). Sem hidratação de
  preferência aqui.
- Manter o **dialog de detalhes do filho** já existente na aba (clique no item abre o resumo +
  "Ver página completa").

## Desenho

1. Reescrever `ResidentsTab` para usar `useInfiniteResidents({ houseId, search, status, overdue,
   sort, order })` com `houseId` fixo; sentinela + `IntersectionObserver` como em `ResidentsPage`;
   `LoadingState`/`EmptyState`/`ErrorState` compartilhados.
2. Barra de filtros: reusar `ResidentsFilters` **ocultando o seletor de Casa** (adicionar prop tipo
   `hideHouseFilter` se o componente não permitir hoje) ou extrair uma barra enxuta equivalente —
   sem duplicar lógica de busca/status/sort.
3. Extrair o item da lista num componente próprio (`HouseResidentRow` ou reusar `ResidentCard` se
   couber no visual da aba) — CLAUDE.md: nada de item inline complexo em lista.
4. Preservar o dialog de detalhes (`useResidentById(selectedId)`) e o botão "Ver página completa".
5. Exibir a contagem total (`total` do primeiro page) no cabeçalho da aba, como `/residents`.

Escopo frontend-only (`adm.fonte`). Sem mudança de backend/contrato (o `GET /residents` já cobre).

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** (`pnpm --filter adm.fonte test:cov` verde, cobertura ≥90 do código tocado).

- **adm unit** (`ResidentsTab.test.tsx`, atualizar):
  - lista os filhos da casa via `useInfiniteResidents` com o `houseId` da casa;
  - a busca filtra (após debounce, dispara nova query com `search`);
  - o filtro de status aplica; o seletor de Casa **não** aparece;
  - o sentinela dispara `fetchNextPage` quando há próxima página (mock de `IntersectionObserver`);
  - lista vazia → `EmptyState`; erro → `ErrorState`;
  - clicar num item abre o dialog de detalhes e "Ver página completa" navega.
- Rever testes existentes que dependiam de `useHouseResidents` na aba para não quebrarem.

## Fora de escopo

- Alterar a listagem `/residents` ou o componente `ResidentsFilters` além de permitir ocultar o
  seletor de Casa.
- Endpoint novo de residents por casa / mudança de backend.
- Persistir filtros da aba em preferência ou na URL.
- Contagem por casa / census (fora desta aba).
