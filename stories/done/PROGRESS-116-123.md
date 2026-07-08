# PROGRESS — rodada 116–123 (arquivada)

Rodada AUTORUN encerrada em 2026-07-08. Seção movida de `stories/PROGRESS.md`. Stories arquivadas em `stories/done/` + `git log`.

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
| 2 | 117 — adm: remover superfície "eventos internos" (navbar+página) | [OK] | 1136 vitest + e2e 10/10 | ea162e2 | 33c71c0 |
| 3 | 118 — adm: máscara telefone familiares no import + DDD 41 | [OK] | 1147 vitest + e2e 4/4 | 02c9659 | e704fde |
| 4 | 119 — import: UF padrão "PR" quando vazia | [OK] | 1155 vitest (38 scoped) | 3fa544c | f941a40 |
| 5 | 120 — import: aprovar filho que já saiu → ALTA/EVASÃO + exitDate | [OK] | api 1129 + e2e 14 + adm 1164 | d5d138d | a570dba |
| 6 | 121 — import: múltiplos acolhimentos (histórico) [dep 120] | [OK] | api 1143 + e2e 454 + adm 1170 | 0320155 | a4f9b3a |
| 7 | 122 — import: não exibir conflito falso pós-aprovação | [OK] | adm 1173 (ItemCard 19) | 6d6fd08 | 77c51bd |
| 8 | 123 — script para esvaziar o bucket principal (Railway) | [OK] | api 1156 (storage/clear-bucket 39) | 4869409 | 076fafd |

## Log

[OK] 116 — testes: 1141/1141 vitest adm + dashboard scoped 6/6 (100% cov) + playwright dashboard 3/3 — commit: 8bccab5 — merge: 54db2a5 — 2026-07-08 — layout puro grid auto-fill, backend intocado
[OK] 117 — testes: 1136/1136 vitest adm + playwright events 10/10, cov adm 91.81% — commit: ea162e2 — merge: 33c71c0 — 2026-07-08 — remoção (backend/api-client/ops intactos; audience=INTERNAL preservado)
[OK] 118 — testes: 1147/1147 vitest adm + e2e bulk-import 4/4, arquivos alterados 100% stmts — commit: 02c9659 — merge: e704fde — 2026-07-08 — helper normalizePhoneWithDefaultDDD no boundary do import; manual intocado
[OK] 119 — testes: 1155/1155 vitest adm (importCommit/ReviewStep/FichaModal), cov touched 95.3% — commit: 3fa544c — merge: f941a40 — 2026-07-08 — DEFAULT_IMPORT_STATE='PR' nos 2 caminhos; backend intocado
[OK] 120 — testes: api 1129/1129 unit + resident-import e2e 14/14 + adm 1164/1164, escopo import.util/service 100% — commit: d5d138d — merge: a570dba — 2026-07-08 — applyExitStatus + monthsBetween no commit; sem migration/postman
[OK] 121 — testes: api 1143/1143 + e2e 454/454 + adm 1170/1170, escopo import.service/match 100% — commit: 0320155 — merge: a4f9b3a — 2026-07-08 — N acolhimentos via colunas repetidas; types+api-client rebuild; Postman atualizado
[OK] 122 — testes: adm 1173/1173 (ImportItemCard 19/19, 100% stmts) — commit: 6d6fd08 — merge: 77c51bd — 2026-07-08 — badge de conflito só em status ready; backend intocado
[OK] 123 — testes: api 1156/1156 (storage.service + clear-bucket 39, clearBucket 100%) — commit: 4869409 — merge: 076fafd — 2026-07-08 — agent fonte-implementer bateu session limit ANTES de commitar; orquestrador validou verde (full test:api) e commitou/mergeou o WIP

## Resumo final

**8/8 OK.** Rodada 116–123 concluída sem bloqueios nem PENDENTE-MANUAL.

- 116, 117, 118, 119, 122 — frontend-only (adm.fonte); backend/contrato intocados.
- 120, 121, 123 — backend (+ frontend em 120/121). 121 alterou `packages/types`/`api-client` (rebuild feito) e atualizou o Postman; nenhuma story criou migration.
- Dep rígida 121→120 respeitada (120 mergeada antes).
- **Nota operacional:** o agent da 123 bateu o session limit antes de commitar; o orquestrador rodou `pnpm test:api` completo (1156/1156 verde, clearBucket 100%) e commitou/mergeou o WIP manualmente — dentro do DoD (verde antes do merge).

**Reproduzir os gates:** `pnpm docker:up && pnpm test:setup` → `pnpm test:api` (backend, 1156/1156) · `pnpm --filter adm.fonte test -- --coverage` (adm, 1173/1173) · e2e adm com `dev:api:test` + `dev:test` de pé.

Branches por story preservadas (`feat/story-1NN-*`), sem push, sem PR. Serviços de teste seguem de pé.
