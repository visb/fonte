# PROGRESS — ledger ativo

Rodada autorun **144–145** — bloco "Editor de templates" (adm.fonte, `features/settings`):
autocomplete inline de variáveis ao digitar `{{` (144) e descrição da variável sempre visível no
drawer (145). Aberta 2026-07-22.

## Config da rodada

- **Tema:** editor de templates de documento — melhorar a descoberta/inserção de variáveis.
  144 = `{{` abre o drawer + popup de autocomplete inline; 145 = descrição visível por item no drawer.
- **Ordem:** 144 → 145. Ambas tocam `VariablesPanel.tsx`; 144 primeiro para 145 rebasear/mergear
  sobre a lista/estado já mexidos e evitar conflito.
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma dura. Ordem 144→145 é preferência (mesmo arquivo), não bloqueio.
- **Cuidados da rodada:**
  - **Frontend-only adm.fonte.** Sem migration. Sem mudança de contrato (`packages/types`/
    `api-client`) → sem rebuild de contrato. **Postman inalterado** (nenhum endpoint tocado).
  - **144 adiciona dependência** `@tiptap/suggestion@3.22.5` (pin exata da família `@tiptap/*`).
    Atualiza `package.json` + lockfile do adm.fonte.
  - Ambas tocam produção (`src/features/settings/...`) → precisam **unit (Vitest) + e2e
    (Playwright)**, cobertura ≥90 do ramo tocado. O arquivo da extension/popup que depende de
    ProseMirror real pode entrar na exclusão de cobertura SE o e2e cobrir o fim-a-fim (padrão story
    143).
  - Suíte **e2e adm** (`pnpm test:adm`) exige `test:setup` + `dev:api:test` (3001) + `adm dev:test`
    (5174) de pé. Não commitar com e2e vermelho. `document-templates.spec.ts` é o spec afetado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 144 — `{{` abre drawer + autocomplete inline de variáveis | [ ] | — | — | — |
| 2 | 145 — descrição da variável sempre visível no drawer | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
