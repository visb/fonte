# Plan: Cobertura de testes — `ops.fonte` (React Native) 2.87→80%

> Filha do epic **78**. App grande (213 arquivos, 150 em features, +77pp) — porte de `adm.fonte`.
> **Não cabe em 1 PR**: sub-dividir por grupo de features (81a–81e). `app.fonte` é story separada
> (**84**).

## Context

`ops.fonte` media **2.87%** (70 tests, 213 arquivos) com `preset: jest-expo`. `collectCoverageFrom`
já configurado (story 78) sobre `app/components/features/lib`, excluindo testes/d.ts/`_layout.tsx`.
Dep `@testing-library/react-native` já instalada.

15 features: `activities census dashboard house-settings incidents messages ministries notifications
profile residents storeroom street-sales supply-room support-groups wishlist` (150 arquivos em
`features/`, 47 em rotas `app/`).

> **Re-baseline:** os 2.87% incluem rotas `app/**` no denominador. Ao manter `app/**` excluído (já
> está no `collectCoverageFrom`), o ponto de partida real sobre `features+lib+components` é outro —
> medir antes de começar e registrar. Excluir rota **não** é progresso de teste (ver caveat do 78).

### Decisões travadas

- **`@testing-library/react-native`** p/ componentes; hooks com `QueryClientProvider` + mock jest do
  `@fonte/api-client` (helper de teste central, reusado entre features).
- **Rotas Expo Router (`app/**`) e `_layout.tsx` fora do denominador** — orquestração → Maestro E2E.
- **`Controller` do react-hook-form** (RN não tem `register`) — testar forms por ele.
- **Modo Resident / timer de uso**: testar a **lógica do contador** (limite diário, reset) em
  hook/lib. Se estiver presa na tela, extrair (refactor mínimo citado no PR).
- **Sub-split por grupo de features**, catraca de `coverageThreshold` sobe a cada PR.

## Desenho — sub-fases (cada uma um PR; camadas lib → hooks → componentes)

- **81a** — `residents` + `activities` (núcleo operacional).
- **81b** — `incidents` (não deletável) + `storeroom` + `supply-room` (sem estorno; alinhar a
  BUSINESS_RULES).
- **81c** — `street-sales` + `wishlist` + `ministries`.
- **81d** — `census` + `messages` + `notifications`.
- **81e** — `support-groups` + `house-settings` + `profile` + `dashboard` (fecham o piso).

Cada PR: telas/rotas fora; assert real em cada caminho. Meta agregada **80% statements**.

## Fora de escopo

- E2E Maestro (stories próprias).
- `app.fonte` (story **84**), `resident.fonte` (não scaffoldado).
- Refactor grande de telas além do mínimo p/ extrair lógica testável.

## Validação

- `pnpm --filter ops.fonte test:unit -- --coverage` ≥ piso vigente a cada PR; **80%** ao final.
- Maestro existente não regredir.
- Sem `skip/only` sem justificativa.
