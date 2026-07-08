# PROGRESS — rodada 107–115 (arquivada)

Rodada AUTORUN encerrada em 2026-07-08. Seção movida de `stories/PROGRESS.md`. Stories arquivadas em `stories/done/` + `git log`.

# PROGRESS — stories 107–115 (import em lote UX + contribuição valor/produtos + squash migrations)

Ordem: 107 → 108 → 109 → 110(epic/meta) → 111 → 112 → 113 → 114 → 115. Fonte de verdade: esta seção + git log.

**Config da rodada:**
- Branch base: `main`. Merge `--no-ff` por story, sem push, sem PR.
- **Deps rígidas:** 111 → 112 → {113, 114}. **115 é a ÚLTIMA** — o squash tem de incluir as migrations criadas por 111 e 112; nunca rodar 115 antes delas mergeadas.
- **110 é o epic umbrella (doc, sem código)** — não implementa; arquivar em `done/` como meta quando 111–114 fecharem.
- **Cuidados:**
  - **Migrations:** 111 (`UnifyInventoryCatalog` + backfill sem perda), 112 (`ReceivableProductContributions`), 115 (squash de TODAS numa `InitialSchema`). Rodar `migration:run:test` após cada. Nunca editar migration aplicada. 115 apaga migrations antigas → schema resultante DEVE bater com o das 85-em-sequência (dump --schema-only == , zero diff).
  - **Contratos:** 112 adiciona tipos em `packages/types` + métodos no `@fonte/api-client`. Rebuild `build:types && build:api-client` antes de 113/114 e antes de subir adm.
  - **Postman:** 112 obriga atualizar `fonte-api.postman_collection.json`.
  - **Cobertura ≥90** do escopo tocado. Sem `skip/only/xfail` injustificado.
  - **114 (ops):** unit (Vitest/RTL RN) roda; `test:ops` (Maestro) exige emulador/dispositivo → marcar **PENDENTE-MANUAL** se ambiente ausente, seguir.
  - 107/108/109 tocam os mesmos arquivos (`ImportItemCard`, `ImportFichaModal`) — merge em ordem evita conflito.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 107 — import: visualizar detalhe dos alertas (popover+modal) | [OK] | 1093 unit + e2e 3/3 | bbf0d53 | 2bdf1ef |
| 2 | 108 — import: histórico de contribuição no modal ver-ficha | [OK] | 1098 unit + e2e 3/3 | b8d3281 | (main) |
| 3 | 109 — import: dividir fila em abas + status cancelled | [OK] | 1108 unit + e2e 4/4 | 27575e0 | (main) |
| 4 | 110 — EPIC contribuição valor+produtos (meta, sem código) | [OK] | n/a (meta) | — | (arquivado) |
| 5 | 111 — unificar almoxarifado+dispensa (catálogo inventário) | [OK] | 1098 unit + 440 e2e | 4f40af3 | (main) |
| 6 | 112 — backend contribuição-produtos (entity+mov IN+endpoints) | [OK] | 1116 unit + 451 e2e | 6cbe722 | (main) |
| 7 | 113 — adm: declarar valor + produtos | [OK] | 1138 unit + e2e 3/3 | 7f96fd0 | (main) |
| 8 | 114 — ops: declarar contribuição de produtos | [OK] | 579 unit (Maestro PEND-MANUAL) | 51dbe56 | (main) |
| 9 | 115 — squash migrations numa InitialSchema v1 | [OK] | 1116 unit + 451 e2e | 11b1c2f | (main) |

## Log

Entrada curta — máx. ~3 linhas.
[OK] 107 — testes: 1093/1093 unit adm + e2e bulk-import 3/3, cobertura escopo ≥90 — commit: bbf0d53 — merge: 2bdf1ef — 2026-07-07 — (bônus: reexport de tipos faltantes no barrel do api-client, necessário p/ tsc do adm)
[OK] 108 — testes: 1098/1098 unit adm + e2e bulk-import 3/3, novo ImportContributionHistory 100% — commit: b8d3281 — 2026-07-07 — (nota: contributionMonths é string[] ISO, sem valor R$; exibe só competência. Agent 1 morreu por session limit; agent 2 finalizou o WIP)
[OK] 109 — testes: 1108/1108 unit adm + e2e bulk-import 4/4, escopo import ≥90 (tabs/queue 100%) — commit: 27575e0 — 2026-07-07 — (novo status cancelled + restaurar; abas fila/processadas/aprovadas/canceladas)
[OK] 111 — testes: api 1098/1098 unit + 440/440 e2e, escopo 100% stmt/fn/ln br 90.5, migration+backfill ids preservados (md5 idêntico) — commit: 4f40af3 — 2026-07-08 — (STI TypeORM: inventory_items/inventory_movements + kind; tabelas antigas ficam. Test API :3001 precisa rebuild+restart pós-schema)
[OK] 112 — testes: api 1116/1116 unit + 451/451 e2e, service 98.76% stmt/100% ln, migration ReceivableProductContributions aplicada, Postman +3 rotas — commit: 6cbe722 — 2026-07-08 — (item XOR descrição via CHECK; catálogo gera mov IN atômico; SERVANT+ p/ produtos, valor segue ADMIN/COORD)
[OK] 113 — testes: adm 1138/1138 unit + e2e 3/3, novos 100%/tocados ≥98% — commit: 7f96fd0 — 2026-07-08 — (seção Produtos no RegisterPaymentDialog, useFieldArray, catálogo=storeroom+supply; checkbox "pagamento em dinheiro" p/ só-produtos)
[OK] 114 — testes: ops 579/579 unit, escopo 95-100%; Maestro PENDENTE-MANUAL (sem emulador, yaml e2e/product-contributions.yaml p/ rodar manual) — commit: 51dbe56 — 2026-07-08 — (RN Controller+useFieldArray; tela declare-products no detalhe do filho, só produtos)
[OK] 110 — EPIC meta (sem código), arquivado em done/ após 111-114 fecharem — 2026-07-08
[OK] 115 — testes: api 1116/1116 unit + 451/451 e2e, ZERO diff de schema (dump InitialSchema == dump das 87 antigas), revert coerente, 86 migrations removidas + 1 InitialSchema1777743139019 — commit: 11b1c2f — 2026-07-08 — (InitialSchema derivada do schema REAL, não do generate cru; drift entities↔schema anotado p/ story futura)

## Resumo final

**Rodada 107–115 CONCLUÍDA — 9/9 stories [OK], sem BLOQUEADOS.** Uma pendência manual não-bloqueante (Maestro da 114).

**O que passou:**
- **107/108/109** (adm, import em lote UX): popover+seção de alertas; histórico de contribuição no modal ver-ficha; fila em 4 abas (fila/processadas/aprovadas/canceladas) + status `cancelled` com restaurar. Suíte adm subiu a 1108 unit + e2e bulk-import 4/4.
- **110** epic umbrella (meta, sem código) — arquivado em `done/` após as filhas fecharem.
- **111** (backend): unificação almoxarifado+dispensa num catálogo (`inventory_items`/`inventory_movements` + `kind`, STI TypeORM); migration com backfill sem perda (ids preservados, md5 idêntico); tabelas antigas mantidas (drop p/ migration futura).
- **112** (backend): entity `ReceivableProductContribution` (item XOR descrição via CHECK), modo catálogo gera movimento IN atômico, modo avulso `pending_detailing`; endpoints SERVANT+ (valor segue ADMIN/COORD); +3 rotas no Postman; tipos no `@fonte/api-client`.
- **113** (adm): seção Produtos no `RegisterPaymentDialog` (`useFieldArray`, catálogo=storeroom+supply, checkbox p/ só-produtos).
- **114** (ops RN): tela declare-products no detalhe do filho, só produtos (Controller+useFieldArray).
- **115** (infra): squash das 87 migrations numa `InitialSchema1777743139019` — **ZERO diff de schema** provado (dump == dump das 87 antigas), revert coerente.

**PENDENTE-MANUAL:** `pnpm test:ops` (Maestro, story 114) não rodou — ambiente autônomo sem emulador/dispositivo. Yaml `apps/ops.fonte/e2e/product-contributions.yaml` escrito p/ execução manual. Unit do ops verde (579/579).

**Achado registrado (fora de escopo):** entities acumularam drift cosmético vs. schema (nomes de enum/índice/constraint que `migration:generate` renomearia). Não afeta runtime (`synchronize=false`). Candidato a story futura de reconciliação.

**Consequência do 115:** todo ambiente com banco antigo precisa ser recriado do zero — `pnpm docker:reset` + migrate. `fonte_test` já recriado+seedado; `fonte_dev` será recriado no próximo reset.

**Reproduzir os gates:**
```
pnpm docker:up && pnpm test:setup
pnpm migration:run:test          # banco do zero só com InitialSchema
pnpm test:api                    # 1116/1116
pnpm test:api:e2e                # 451/451
pnpm --filter adm.fonte test     # unit adm (1138); e2e: pnpm test:adm (adm :5174 + API :3001)
pnpm --filter ops.fonte test     # unit ops (579); e2e Maestro = manual c/ emulador
```

Branches preservadas: `feat/story-{107,108,109,111,112,113,114,115}-*`. Sem push, sem PR.
