# PROGRESS — ledger ativo

Rodada aberta: **158 — sidebar do adm.fonte com scroll próprio**.

## Config da rodada

- **Tema:** layout do `adm.fonte` — sidebar com scroll interno, header/footer fixos.
- **Ordem:** 158.
- **Branch base:** `main` (`022f249`).
- **Deps rígidas:** nenhuma (story única).
- **Cuidados:**
  - Escopo é arquivo único: `apps/adm.fonte/src/components/layout/AppLayout.tsx` (só classes
    utilitárias Tailwind — `min-h-0 overflow-y-auto` na `<nav>`, `shrink-0` em header/footer).
  - Sem migration, sem mudança de contrato (`packages/types` / `api-client`) → **sem alteração
    no Postman**.
  - Testes novos: unit `AppLayout.test.tsx` (Vitest + RTL) e e2e `e2e/layout.spec.ts` (Playwright).
  - Gate de cobertura ≥ 90 no escopo tocado. Sem `skip`/`only`/`xfail` sem justificativa.
  - Pré-requisitos do e2e: `pnpm test:setup` + `pnpm dev:api:test` (3001) + `adm dev:test` (5174).
  - Sem dependência externa/credencial nesta rodada.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 158 — sidebar do adm.fonte com scroll próprio | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
