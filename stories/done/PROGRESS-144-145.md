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
| 1 | 144 — `{{` abre drawer + autocomplete inline de variáveis | [OK] | unit 1359/1359, e2e 14/14 (2×) | c2c9d91 | 0fd7464 |
| 2 | 145 — descrição da variável sempre visível no drawer | [OK] | unit 1360/1360, e2e 14/14 (2×) | 57deb12 | cfa067a |

## Log

[OK] 144 — @tiptap/suggestion@3.22.5; extension VariableSuggestion + popup; VARIABLES extraída p/ templateVariables.ts; guarda `allow` fecha gatilho ao surgir `}` (evita re-trigger do token inserido). unit 1359/1359, e2e document-templates 14/14 (2×), cobertura adm 92.64% (ramo novo 100%; extension excluída, coberta por e2e) — commit c2c9d91 — merge 0fd7464 — 2026-07-22

[OK] 145 — 3ª linha `{description}` (text-[10px] muted) por item no VariablesPanel; removido `title` redundante; clique/arraste/feedback/modo controlado intactos. unit 1360/1360 (VariablesPanel 11/11), e2e document-templates 14/14 (2×), cobertura adm 92.64% — commit 57deb12 — merge cfa067a — 2026-07-22

## Resumo final

**Rodada 144–145 encerrada 2026-07-22. Ambas [OK] e mergeadas na main. Nenhum bloqueio, nada PENDENTE-MANUAL.**

Bloco "Editor de templates" (adm.fonte, `features/settings`), frontend-only:

- **144** — digitar `{{` no editor de template agora abre o drawer de variáveis E mostra um popup de
  autocomplete inline no cursor (filtra label+key accent/case-insensitive; Enter/setas/clique
  substituem o `{{parcial` por `{{key}}`). Dep nova `@tiptap/suggestion@3.22.5`; `VARIABLES` extraída
  p/ `templateVariables.ts`; guarda `allow` fecha o gatilho ao surgir `}` (evita re-trigger do token
  recém-inserido). Extension/popup dependente de ProseMirror real fica na exclusão de cobertura,
  provada pelo e2e (padrão story 143).
- **145** — cada variável no drawer volta a exibir a descrição sempre visível (3ª linha do item);
  removido o tooltip `title` redundante.

**Gates (serviços de pé: docker + `pnpm dev:api:test` 3001 + `pnpm --filter adm.fonte dev:test` 5174):**
```
pnpm test:setup
pnpm --filter adm.fonte exec vitest run              # unit — 1360/1360
pnpm --filter adm.fonte exec vitest run --coverage   # cobertura adm 92.64% (≥90)
pnpm test:adm -- document-templates.spec.ts          # e2e 14/14 (determinístico, 2×)
```

**Branches** (preservadas, sem push): `feat/story-144-autocomplete-variaveis`,
`feat/story-145-descricao-variaveis-visivel`. **Sem push, sem PR.**
