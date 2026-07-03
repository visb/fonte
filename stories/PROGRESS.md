# PROGRESS — ledger da rodada AUTORUN corrente

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive em
`stories/done/PROGRESS-NN-MM.md` (uma por rodada) + `git log`.

## Legenda

`[OK]` implementada, suíte tocada verde, commitada e mergeada · `[PARCIAL]` código completo mas
parte depende de serviço externo sem credencial (mock nos testes) · `[BLOQUEADO]` impedida ·
`[PENDENTE-MANUAL]` exige ação humana/operacional fora do run · `[ ]` pendente

---

# PROGRESS — stories 99–106 (curso: sugerir matrícula + import em lote de filhos)

Ordem: 99 → 101 → 102 → 103 → 104 → 105 → 106. Fonte de verdade: esta seção + git log.

Config da rodada:
- **Branch base:** `main`. Uma branch por story, merge `--no-ff` na main ao ficar verde. Sem push, sem PR.
- **Deps rígidas:** 102←101 · 104←101+102 · 105←103+104 · 106←105. Se A bloquear, a cadeia à frente também.
- **100 é EPIC (mapa), não gera código** — não spawnar implementer; só confirmar que as filhas 101–105 cobrem o epic e marcar `[OK]` documental ao fechar todas.
- **106 é PENDENTE-MANUAL** — reescrita de história git + `force-push` coordenado é **proibido pelo AUTORUN** (push/PR/reescrita coordenada). Não executar no run; registrar o runbook e deixar para janela manual.

Cuidados:
- **Contratos:** 99, 101, 102, 103 tocam `packages/types` + `packages/api-client`. Rebuildar `pnpm build:types && pnpm build:api-client` antes de subir API/adm e sempre que o contrato mudar.
- **Postman:** cada endpoint novo entra em `fonte-api.postman_collection.json` (99: eligible-residents + enrollments/bulk; 101: parse-spreadsheet; 102: parse-docx-with-spreadsheet; 103: check-conflict + commit).
- **Dep externa (Anthropic):** `DocxParserService.parseDocx` usa Anthropic SDK (`ANTHROPIC_API_KEY`). Unit tests **mockam** `parseDocx`. E2E que exija parse real de `.docx` sem chave → mockar/stubar ou marcar `PENDENTE-MANUAL` a parte que depende da API real; nunca inventar chave nem chamar API real.
- **xlsx (101):** confirmar se `xlsx`/`exceljs` já é dependência antes de adicionar; preferir `exceljs`. Criar fixture `.xlsx` **anonimizada** em `services/api/test/fixtures/` (não usar `stories/lista-filhos.xlsx` nos testes).
- **Migrations:** stories reusam modelos existentes (bible_course_*, residents, relatives, contribuições). Se surgir migration nova, `migration:run:test` após criar e timestamps crescentes; nunca editar migration aplicada.
- **Gate:** suíte da área tocada verde (novos + sem regressão) **e** cobertura ≥90 do escopo antes de qualquer merge.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 99 — sugerir matrícula de elegíveis (curso) | [OK] | api 1053 · e2e 408 · cov≥90 | 289823b | bff28f9 |
| — | 100 — EPIC import em lote (mapa) | [ ] | n/a | | |
| 2 | 101 — parse da planilha `.xlsx` (backend) | [ ] | | | |
| 3 | 102 — cross-match planilha × ficha (backend) | [ ] | | | |
| 4 | 103 — conflito + commit atômico (backend) | [ ] | | | |
| 5 | 104 — tela de import em lote, fila e cards (front) | [ ] | | | |
| 6 | 105 — modal da ficha editável + aprovação (front) | [ ] | | | |
| 7 | 106 — remover planilha + purgar história git | [PENDENTE-MANUAL] | n/a | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

- [OK] 99 — testes: api 1053/1053, e2e 408/408 (bible-courses 35/35), cov escopo ≥90 (front 97.6% / back módulo 93.3%) — commit 289823b — merge bff28f9 — 2026-07-03

## Resumo final

<preencher ao encerrar>
