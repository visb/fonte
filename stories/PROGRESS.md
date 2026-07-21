# PROGRESS — ledger ativo

Rodada autorun **142–143** — correção das duas falhas e2e pré-existentes do adm.fonte
(descobertas na story 132, reconfirmadas na retomada 133/134 em 2026-07-21).

## Config da rodada

- **Tema:** consertar as duas falhas e2e crônicas do adm.fonte — drift de data (142) e bug de
  foco do editor WYSIWYG (143).
- **Ordem:** 142 → 143 (independentes; sem dep rígida).
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma. Stories tocam arquivos disjuntos (`payables.spec.ts` vs
  `ActivityDescriptionEditor.tsx`/`activities.spec.ts`).
- **Cuidados da rodada:**
  - Sem migrations. Sem mudança de contrato (`packages/types`/`api-client`) esperada → não precisa
    rebuild de contrato salvo se o implementer tocar esses pacotes.
  - Sem alteração de endpoint → **Postman não muda**.
  - **142 é e2e-only** (nenhum arquivo em `src/`) → sem gate de cobertura unit; gate = e2e verde e
    determinístico, datas relativas ao `now` (nunca literais).
  - **143 toca produção** (`src/features/activities/.../ActivityDescriptionEditor.tsx`, talvez
    `TemplateEditor.tsx`) → precisa unit + e2e, cobertura ≥90 do ramo tocado.
  - Ambos exigem suíte **e2e adm** (`pnpm test:adm`): requer `test:setup` + `dev:api:test` (3001) +
    `adm dev:test` (5174) de pé. Não commitar com e2e vermelho.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 142 — e2e payables drift de vencimento | [ ] | — | — | — |
| 2 | 143 — negrito não pega no 1º char (editor atividade) | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
