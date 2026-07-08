# Plan: adm — declarar valor monetário e produtos na contribuição

> **Status: PLANEJAMENTO.** Filha 3 de [[110]]. Depende de [[112]] (backend). Frontend-only.

## Context

No adm, a declaração da contribuição mensal é feita em `RegisterPaymentDialog` (aba
`ContributionsTab` do detalhe do filho), hoje só com valor monetário ([[15]]). O epic [[110]] exige
declarar **ambos os tipos**: valor **e** produtos. O backend ([[112]]) já expõe o modelo de
contribuição-produtos com os dois modos (item de catálogo / descrição avulsa).

### Decisões travadas

- **Mesma tela, duas seções**: manter valor monetário como está e adicionar uma seção **"Produtos"**
  com linhas dinâmicas. Cada linha alterna entre:
  - **Do catálogo**: seletor de produto (catálogo unificado [[111]], filtrado pela casa do filho) +
    quantidade + unidade (da item).
  - **Avulso**: descrição livre (ex: "cesta básica") + quantidade/unidade opcionais. Sinaliza
    visualmente que ficará **pendente de detalhamento**.
- **`react-hook-form` + `zod`** com `useFieldArray` para as linhas de produto (nunca `useState`);
  validação item-XOR-descrição espelhando o backend.
- **Valor e produtos independentes**: pode declarar só valor, só produtos, ou ambos, numa submissão.
- Após declarar, `ContributionsTab`/`ReceivableRow` exibe as contribuições de produto da parcela
  (lista com produto/descrição + quantidade + badge "pendente" no avulso). Invalidar as query keys
  da parcela.

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **Hooks** em `features/residents/hooks/`: `useDeclareProductContribution` (mutation → api [[112]];
  onSuccess invalida `queryKeys` da parcela/residents) e `useInventoryCatalog(houseId)` (query do
  catálogo unificado p/ o seletor; reusar hook existente de storeroom/supply se já cobrir).
- **`RegisterPaymentDialog`**: nova seção "Produtos" com `useFieldArray`; componente
  `ProductContributionRow` (extraído — item complexo não fica inline) com o toggle catálogo/avulso.
- **Exibição**: `ReceivableRow`/`ContributionsTab` mostram as contribuições de produto já declaradas;
  componente `ProductContributionList`/`Item` próprio.
- Estados/erros via `LoadingState`/`EmptyState`/`ErrorState` + `getErrorMessage`.

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL)**: `ProductContributionRow` alterna catálogo/avulso e valida item-XOR-descrição;
  `useFieldArray` adiciona/remove linhas; `useDeclareProductContribution` envia o payload certo e
  invalida a query; lista renderiza produtos declarados com badge "pendente" no avulso.
- **`pnpm test:adm`** (Playwright): abrir a declaração, adicionar uma linha de catálogo + uma avulsa,
  salvar; parcela passa a listar os produtos; declarar só produtos (sem valor) funciona.
- `pnpm build:api-client` se tocar contratos do cliente.

## Fora de escopo

- Backend/modelo ([[112]]).
- Fluxo do ops ([[114]]).
- Distrinchar a linha avulsa (logística, manual).
