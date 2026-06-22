# Plan: Cobertura de testes — `ops.fonte` e `app.fonte` (React Native) →80%

> Filha do epic **78**. Dois apps Expo/RN com jest-expo. ops parte de **2.87%**, app de **4.61%**.
> Provável subdividir `ops` por feature (é grande: 213 arquivos).

## Context

`ops.fonte` media **2.87%** (70 tests, 213 arquivos) e `app.fonte` **4.61%** (20 tests, 47
arquivos). Ambos usam `preset: jest-expo`. `collectCoverageFrom` já configurado (story 78) sobre
`app/components/features/lib`.

- ops features: `activities census dashboard house-settings incidents messages ministries
  notifications profile residents storeroom street-sales supply-room support-groups wishlist`.
- app features: `auth checkin home messages privacy profile wishlist`.

### Decisões travadas

- **`@testing-library/react-native`** para componentes; hooks com `QueryClientProvider` + mock
  `@fonte/api-client` (jest mock).
- **Rotas Expo Router (`app/**`) e `_layout.tsx` fora do denominador** (orquestração → Maestro E2E).
  Já excluídos no `collectCoverageFrom`; manter.
- **React Native usa `Controller`** do react-hook-form (não `register`) — testar forms por ele.
- **ops modo Resident / timer de uso**: testar a **lógica do contador** (limite diário, reset), não
  a tela. Lógica deve estar em hook/lib testável; se estiver presa na tela, extrair (refactor mínimo
  citado no PR).
- Ordem: `app.fonte` primeiro (menor, 47 arquivos, fecha rápido) → depois `ops.fonte` por feature.

## Desenho

Mesma pirâmide do epic, por app/feature: **lib → hooks → componentes**; telas/rotas fora.

### `app.fonte` (menor — alvo de 1–2 PRs)
- `auth checkin home messages privacy profile wishlist`: hooks + componentes + libs.
- `checkin` tem regra (presença em grupo de apoio) — cobrir bem.

### `ops.fonte` (subdividir por feature, catraca por PR)
- Ordem sugerida: `residents` → `activities` → `incidents` → `storeroom`/`supply-room` →
  `street-sales` → `support-groups` → `wishlist` → `ministries` → `census` →
  `messages`/`notifications` → `house-settings`/`profile`/`dashboard`.
- `incidents` (não deletável) e storeroom (sem estorno) — alinhar asserções com BUSINESS_RULES.

Catraca de `coverageThreshold` por PR; meta 80% statements por app.

## Fora de escopo

- E2E Maestro (stories próprias).
- `resident.fonte` (não scaffoldado).
- Refactor grande de telas além do mínimo p/ extrair lógica testável.

## Validação

- `pnpm --filter ops.fonte test:unit -- --coverage` e
  `pnpm --filter app.fonte test:unit -- --coverage` ≥ piso vigente; **80%** ao final de cada app.
- Maestro existente não regredir.
- Sem `skip/only` sem justificativa; assert real em cada caminho.
