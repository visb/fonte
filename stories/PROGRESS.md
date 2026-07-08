# PROGRESS — ledger da rodada AUTORUN corrente

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive em
`stories/done/PROGRESS-NN-MM.md` (uma por rodada) + `git log` (stories arquivadas em
`stories/done/`) — não acumular logs antigos aqui.

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada e mergeada ·
`[PARCIAL]` código completo mas parte depende de serviço externo sem credencial (mock nos testes) ·
`[BLOQUEADO]` impedida (registrar o motivo) · `[ ]` pendente

---

# PROGRESS — stories 116–123 (dashboard/navbar adm + melhorias no import de filhos + wipe bucket)

Ordem: 116 → 117 → 118 → 119 → 120 → 121 → 122 → 123. Fonte de verdade: esta seção + git log.

**Config da rodada:**
- Branch base: `main`. Merge `--no-ff` por story, sem push, sem PR.
- **Deps rígidas:** **121 → depende de 120** (reusa `monthsBetween` + regra dos 6 meses ALTA/EVASÃO). Nunca rodar 121 antes de 120 mergeada. 118/119 e 120/121/122 tocam a mesma vizinhança de import (`importCommit.ts`, `ImportFichaModal`, `ImportItemCard`, `ResidentFormSections`) — implementar em ordem numérica evita conflito.
- **Cuidados:**
  - **Migrations:** NENHUMA story cria migration (120/121 reusam a entity `admissions` existente; sem mudança de schema). Não inventar migration.
  - **Contratos:** **121** altera `packages/types` (`SpreadsheetImportRow.admissions`, `ImportAdmissionDto`, `CommitImportDto`) → `pnpm build:types && pnpm build:api-client` obrigatório antes de subir adm e antes de 122. Demais stories não tocam contrato.
  - **Postman:** **121** obriga atualizar `fonte-api.postman_collection.json` (novo campo `admissions` no body do commit). 120/122/123 não mudam endpoint → Postman inalterado.
  - **Backend tocado:** 120 (`import.service` deriva status + helper `monthsBetween`), 121 (`spreadsheet-parser` + `import-match` + `import.service`), 123 (`StorageService.clearBucket` + script `clear-bucket.ts`). Rodar `test:api` + `test:api:cov` nessas.
  - **Frontend-only:** 116, 117, 118, 119, 122 (adm.fonte vitest/RTL + e2e Playwright quando spec existir). `test:api:cov` não se aplica.
  - **Sem credencial:** 123 (wipe bucket Railway) — testar `clearBucket` com `S3Client.send` mockado; NÃO chamar S3 real, NÃO commitar segredo. Não bloqueia (unit com mock cobre).
  - **Cobertura ≥90** do escopo tocado. Sem `skip/only/xfail` injustificado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 116 — dashboard: cards de casas em grid responsivo | [OK] | 1141 vitest + e2e 3/3 | 8bccab5 | 54db2a5 |
| 2 | 117 — adm: remover superfície "eventos internos" (navbar+página) | [ ] | | | |
| 3 | 118 — adm: máscara telefone familiares no import + DDD 41 | [ ] | | | |
| 4 | 119 — import: UF padrão "PR" quando vazia | [ ] | | | |
| 5 | 120 — import: aprovar filho que já saiu → ALTA/EVASÃO + exitDate | [ ] | | | |
| 6 | 121 — import: múltiplos acolhimentos (histórico) [dep 120] | [ ] | | | |
| 7 | 122 — import: não exibir conflito falso pós-aprovação | [ ] | | | |
| 8 | 123 — script para esvaziar o bucket principal (Railway) | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>
[OK] 116 — testes: 1141/1141 vitest adm + dashboard scoped 6/6 (100% cov) + playwright dashboard 3/3 — commit: 8bccab5 — merge: 54db2a5 — 2026-07-08 — layout puro grid auto-fill, backend intocado

## Resumo final

<preencher ao encerrar a rodada>
