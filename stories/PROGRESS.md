# PROGRESS — ledger ativo

Rodada aberta: **173 + 174** (UX de senha e safe area dos apps mobile).

## Config da rodada

- **Tema:** UX de entrada de dados nos apps — toggle "ver senha" em todo campo de senha (173) e
  correção do header cortado pela status bar no `ops.fonte` (174).
- **Ordem:** 173 → 174.
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma dep de conteúdo, mas a **ordem é obrigatória**: a 173 reescreve
  `apps/ops.fonte/app/(auth)/login.tsx` e `change-password.tsx` (migração p/ react-hook-form) e a 174
  toca `app/(auth)/_layout.tsx` e `app/(app)/_layout.tsx`. Rodar em paralelo conflita na mesma pasta.
- **Escopo técnico:** frontend-only nas duas. **Sem** migration, **sem** mudança em
  `packages/types`/`api-client`, **sem** alteração no `fonte-api.postman_collection.json`.
- **Cuidados da rodada:**
  - `accessibilityLabel` `input-senha` / `input-email` (ops e app) **não pode mudar** — Maestro e
    Playwright web dependem deles. `fill-test-credentials` (`__DEV__`) do `app.fonte` preservado.
  - E2E web (`apps/ops.fonte/e2e-web/`, `apps/app.fonte/e2e-web/`) devem ficar verdes **sem edição**;
    edição necessária = sinal de label/layout alterado indevidamente.
  - 174: o inset passa a ser pago **uma vez** no wrapper de `(app)/_layout.tsx`; `OfflineBanner` e
    `ResidentDetailHeader` perdem o `insets.top` próprio (senão vira gap duplo offline).
  - Maestro (`test:ops`/`test:app`) exige emulador + Metro; se indisponível, marcar
    PENDENTE-MANUAL e não travar a fila (unit + e2e-web são o gate automatizável).
  - Verificação visual em device Android é **PENDENTE-MANUAL** nas duas (jsdom/web têm `insets.top: 0`).
  - Gate de cobertura ≥ 90 no escopo tocado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 173 — botão "ver senha" em todos os campos de senha | [ ] | — | — | — |
| 2 | 174 — header do ops.fonte cortado pela status bar | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
