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
| 1 | 173 — botão "ver senha" em todos os campos de senha | [OK] | adm 1610 / ops 948 / app 137 · e2e-web 14+4 | ba1e9cf | 98bf58c |
| 2 | 174 — header do ops.fonte cortado pela status bar | [ ] | — | — | — |

## Log

[OK] 173 — testes: adm:unit 1610 ✓, ops:unit 948 ✓, app:unit 137 ✓, e2e-web ops 14/14 e app 4/4 sem
edição; cobertura 93.19/93.43/92.56 (PasswordInput 100% nos 3 apps). Playwright adm 176 pass / 3 fail
pré-existentes (`resident-attachments.spec.ts`, falha 4 na main limpa). — commit: ba1e9cf —
merge: 98bf58c — 2026-08-10 — PENDENTE-MANUAL: Maestro (`adb devices` vazio, sem emulador) e
verificação visual do toggle em device Android.

## Resumo final

<vazio>
