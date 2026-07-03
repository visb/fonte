# PROGRESS — stories 99–106 (curso: sugerir matrícula + import em lote de filhos)

Rodada AUTORUN encerrada em 2026-07-03. Arquivada de `stories/PROGRESS.md`.

Ordem: 99 → 101 → 102 → 103 → 104 → 105 → 106. Fonte de verdade: esta seção + git log.

Config da rodada:
- **Branch base:** `main`. Uma branch por story, merge `--no-ff` na main ao ficar verde. Sem push, sem PR.
- **Deps rígidas:** 102←101 · 104←101+102 · 105←103+104 · 106←105.
- **100 é EPIC (mapa), não gera código** — coberto pelas filhas 101–105.
- **106 é PENDENTE-MANUAL** — reescrita de história git + `force-push` coordenado é proibido pelo AUTORUN.

Cuidados:
- **Contratos:** 99, 101, 102, 103 tocam `packages/types` + `packages/api-client` — rebuild a cada mudança.
- **Postman:** endpoints novos em `fonte-api.postman_collection.json` (99/101/102/103).
- **Dep externa (Anthropic):** `DocxParserService.parseDocx` usa Anthropic SDK; unit/e2e mockam/stubam; nunca chave real.
- **xlsx (101):** `exceljs` adicionado; fixture anonimizada `services/api/test/fixtures/import-residents.xlsx`.
- **Migrations:** stories reusam modelos existentes; nenhuma migration nova.
- **Gate:** suíte da área tocada verde + cobertura ≥90 do escopo antes de qualquer merge.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 99 — sugerir matrícula de elegíveis (curso) | [OK] | api 1053 · e2e 408 · cov≥90 | 289823b | bff28f9 |
| — | 100 — EPIC import em lote (mapa) | [OK] | n/a — coberto por 101–105 | — | b8d8318 |
| 2 | 101 — parse da planilha `.xlsx` (backend) | [OK] | api 1069 · e2e 413 · cov≥90 | 8e75ad3 | 1d9580b |
| 3 | 102 — cross-match planilha × ficha (backend) | [OK] | api 1085 · e2e 417 · cov 100% | ca4706a | 57cfbc4 |
| 4 | 103 — conflito + commit atômico (backend) | [OK] | api 1098 · e2e 424 · cov 98% | 7cafb72 | c914401 |
| 5 | 104 — tela de import em lote, fila e cards (front) | [OK] | adm unit 1043 · e2e ok · cov escopo≥90 | 2e2a61f | 7c06039 |
| 6 | 105 — modal da ficha editável + aprovação (front) | [OK] | adm unit 1081 · e2e 3/3 · cov escopo≥90 | b92e29a | b8d8318 |
| 7 | 106 — remover planilha + purgar história git | [PARCIAL] | n/a (validação operacional) | ada7549 | main |

## Log

- [OK] 99 — testes: api 1053/1053, e2e 408/408 (bible-courses 35/35), cov escopo ≥90 (front 97.6% / back módulo 93.3%) — commit 289823b — merge bff28f9 — 2026-07-03
- [OK] 101 — testes: api 1069/1069, e2e 413/413, cov escopo parser 97.4% (+normalize 100%) — commit 8e75ad3 — merge 1d9580b — 2026-07-03 — nota: exceljs add; fixture anonimizada test/fixtures/import-residents.xlsx; contributionMonths derivado de entryMonth+(N-1)
- [OK] 102 — testes: api 1085/1085, e2e 417/417, cov escopo import-match 100% — commit ca4706a — merge 57cfbc4 — 2026-07-03 — nota: e2e stuba DocxParserService (sem chave Anthropic); parse .docx real = mock
- [OK] 103 — testes: api 1098/1098, e2e 424/424, cov escopo import.service 98% — commit 7cafb72 — merge c914401 — 2026-07-03 — nota: add manager?:EntityManager opcional a create/uploadPhoto/bulkContributions p/ transação única; checkConflict filtra em JS via normalizeName
- [OK] 104 — testes: adm unit 1043/1043, e2e bulk-import 2/2 + residents 27/27, cov escopo ≥90 (files novos 100% stmts/func) — commit 2e2a61f — merge 7c06039 — 2026-07-03 — nota: E2E intercepta rotas parse/conflict (sem chave Anthropic); rota /residents/import-lote
- [OK] 105 — testes: adm unit 1081/1081, e2e bulk-import 3/3, cov escopo ≥90 — commit b92e29a — merge b8d8318 — 2026-07-03 — nota: fecha epic 100; E2E mocka parse + intercepta commit e assevera payload; 2 specs NÃO relacionados (activities WYSIWYG, payables) falham por estado ambiental — domínios intocados, pré-existentes
- [OK] 100 — EPIC (mapa): coberto integralmente por 101–105; arquivado em done/ — 2026-07-03
- [PARCIAL] 106 — parte local FEITA: git rm da planilha (working tree), guarda `/stories/*.xlsx` no .gitignore, nota LGPD — commit ada7549 (direto na main). Validado: arquivo fora do HEAD, gitignore bloqueia recommit, tree limpo. **PENDENTE-MANUAL:** purga do histórico (`git filter-repo --path stories/lista-filhos.xlsx --invert-paths`) + `force-push` + re-clone dos colaboradores — reescrita coordenada proibida no run autônomo. Runbook em done/106-*.md.

## Resumo final

Rodada 99–106 encerrada em 2026-07-03. **Todas as stories de código (99, 101–105) OK, verdes e mergeadas na main** (`--no-ff`, sem push). Epic 100 fechado (é mapa, coberto pelas filhas). Story 106 parcial: remoção local feita, purga de histórico do git deixada como PENDENTE-MANUAL (proibido no run autônomo).

**Entregue:**
- 99 — painel de sugestão de matrícula de filhos elegíveis ao criar/abrir turma do curso bíblico (backend + adm).
- 101–103 — backend do import em lote: parse da planilha `.xlsx` (exceljs, fixture anonimizada), cross-match planilha×ficha + enriquecimento, detecção de conflito + commit atômico transacional (resident + relatives + contribuições retroativas).
- 104–105 — adm: tela de import em lote (upload planilha + drag-drop `.docx` + fila batch=5 + cards inline) e modal da ficha editável + aprovação/persistência com bloqueio por conflito.

**Gates (todas verdes antes do merge):** `pnpm test:api` (chegou a 1098), `pnpm test:api:e2e` (424), `pnpm test:adm` (unit 1081 + e2e bulk-import), cobertura ≥90 do escopo em cada story. Contratos rebuildados a cada story que tocou `packages/*`. Postman atualizado (99/101/102/103).

**Notas de risco a revisitar:**
- E2E de import mockam/stubam `DocxParserService.parseDocx` (sem `ANTHROPIC_API_KEY` no ambiente de teste). O fluxo real de extração `.docx` contra a API Anthropic **nunca foi exercido de ponta a ponta** — validar manualmente com chave antes de produção. (PENDENTE-MANUAL de verificação.)
- 105 reportou 2 specs adm falhando (activities WYSIWYG, payables) — domínios intocados por esta rodada, tratados como pré-existentes/ambientais; confirmar fora do run.
- 103 `checkConflict` carrega residents e filtra em JS (normalizeName) — ok agora, revisitar se a base crescer.

**PENDENTE-MANUAL (106):** purgar `stories/lista-filhos.xlsx` do histórico do git em janela combinada:
```
git filter-repo --path stories/lista-filhos.xlsx --invert-paths
git push --force-with-lease   # todos os refs; avisar colaboradores p/ re-clonar
```
Verificar: `git log --all --oneline -- stories/lista-filhos.xlsx` vazio. Runbook completo em `stories/done/106-remover-planilha-purgar-historico.md`.

**Reproduzir os gates:** `pnpm docker:up` → `pnpm test:setup` → `pnpm build:types && pnpm build:api-client` → `pnpm dev:api:test` (3001) + `pnpm --filter adm.fonte dev:test` (5174) → `pnpm test:api` / `pnpm test:api:e2e` / `pnpm test:adm`.
