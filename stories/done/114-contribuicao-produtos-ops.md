# Plan: ops — declarar contribuição de produtos do filho

> **Status: PLANEJAMENTO.** Filha 4 de [[110]]. Depende de [[112]] (backend). Frontend-only (RN).

## Context

O epic [[110]] exige que o operador da casa (`ops.fonte`, role SERVANT) possa declarar a
contribuição em **produtos** de um filho, com área para informar **qual produto e quantidade**. O
backend ([[112]]) já expõe declarar/listar contribuição-produtos por parcela, liberado para SERVANT.
Ops não declara valor monetário (continua restrito ao adm).

### Decisões travadas

- **Entrada pelo filho**: a partir da lista/detalhe de residents no ops (rota `residents` já existe),
  o operador abre "Declarar contribuição de produtos" para a parcela corrente do filho.
- **Só produtos** no ops (sem valor monetário). Mesmas duas modalidades de linha do backend:
  - **Do catálogo** (catálogo unificado [[111]], filtrado pela casa): produto + quantidade + unidade.
  - **Avulso**: descrição (ex: "cesta básica") + quantidade/unidade opcionais → **pendente de
    detalhamento** (a própria logística da casa distrincha depois nos inventários).
- **`react-hook-form` + `Controller`** (RN — `TextInput` não aceita `register`) + `zod`;
  `useFieldArray` para as linhas; validação item-XOR-descrição.
- Reusar componentes de estado equivalentes do ops (loading/empty/error) — criar se faltarem
  (CLAUDE.md). Chamadas via `@fonte/api-client` (não duplicar HTTP).

## Desenho

### Frontend (`ops.fonte`, feature `residents` ou nova `contributions`)

- **Rota/tela** de declarar contribuição de produtos (Expo Router), acessível do detalhe do filho.
- **Hooks**: `useDeclareProductContribution` (mutation → api [[112]]) e catálogo de produtos por casa
  (reusar o hook dos inventários se já existir no ops).
- **Form** com `useFieldArray`; componente `ProductContributionRow` (extraído) com toggle
  catálogo/avulso, seletor de produto e campos de quantidade/unidade.
- **Listagem** das contribuições de produto já declaradas na parcela, com badge "pendente" no avulso.
- Guard de role/navegação: visível a SERVANT+.

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `ops.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL RN)**: `ProductContributionRow` alterna catálogo/avulso e valida
  item-XOR-descrição; `useFieldArray` adiciona/remove; hook envia o payload certo e trata erro via a
  convenção de erros do ops; lista renderiza com badge "pendente".
- **`pnpm test:ops`** (Maestro): fluxo declarar produtos de um filho (uma linha catálogo + uma
  avulsa) → aparece listado na parcela.
- `pnpm build:api-client` se tocar contratos do cliente.

## Fora de escopo

- Declarar valor monetário no ops (continua só no adm — [[113]]).
- Backend/modelo ([[112]]).
- Distrinchar a linha avulsa em produtos (logística faz manual nos inventários).
