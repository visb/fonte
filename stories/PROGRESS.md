# PROGRESS — ledger da rodada AUTORUN corrente

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive em
`stories/done/PROGRESS-NN-MM.md` (uma por rodada) + `git log` (stories arquivadas em
`stories/done/`) — não acumular logs antigos aqui.

Rodadas encerradas:

- `done/PROGRESS-64-75.md`
- `done/PROGRESS-77-84.md` — cobertura de testes (piso 80%)
- `done/PROGRESS-85-91.md` — cobertura de testes (piso 90%)
- `done/PROGRESS-92-98.md` — features (curso bíblico, bucket, eventos, perfil servo)
- `done/PROGRESS-99-106.md` — curso: sugerir matrícula + import em lote de filhos (106 purga de histórico PENDENTE-MANUAL)

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada (e mergeada, se a rodada usar merge) ·
`[PARCIAL]` código completo mas parte depende de serviço externo sem credencial (mock nos testes) ·
`[BLOQUEADO]` impedida (registrar o motivo) · `[ ]` pendente

---

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
| 4 | 110 — EPIC contribuição valor+produtos (meta, sem código) | [ ] | | | |
| 5 | 111 — unificar almoxarifado+dispensa (catálogo inventário) | [OK] | 1098 unit + 440 e2e | 4f40af3 | (main) |
| 6 | 112 — backend contribuição-produtos (entity+mov IN+endpoints) | [OK] | 1116 unit + 451 e2e | 6cbe722 | (main) |
| 7 | 113 — adm: declarar valor + produtos | [ ] | | | |
| 8 | 114 — ops: declarar contribuição de produtos | [ ] | | | |
| 9 | 115 — squash migrations numa InitialSchema v1 | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas.
[OK] 107 — testes: 1093/1093 unit adm + e2e bulk-import 3/3, cobertura escopo ≥90 — commit: bbf0d53 — merge: 2bdf1ef — 2026-07-07 — (bônus: reexport de tipos faltantes no barrel do api-client, necessário p/ tsc do adm)
[OK] 108 — testes: 1098/1098 unit adm + e2e bulk-import 3/3, novo ImportContributionHistory 100% — commit: b8d3281 — 2026-07-07 — (nota: contributionMonths é string[] ISO, sem valor R$; exibe só competência. Agent 1 morreu por session limit; agent 2 finalizou o WIP)
[OK] 109 — testes: 1108/1108 unit adm + e2e bulk-import 4/4, escopo import ≥90 (tabs/queue 100%) — commit: 27575e0 — 2026-07-07 — (novo status cancelled + restaurar; abas fila/processadas/aprovadas/canceladas)
[OK] 111 — testes: api 1098/1098 unit + 440/440 e2e, escopo 100% stmt/fn/ln br 90.5, migration+backfill ids preservados (md5 idêntico) — commit: 4f40af3 — 2026-07-08 — (STI TypeORM: inventory_items/inventory_movements + kind; tabelas antigas ficam. Test API :3001 precisa rebuild+restart pós-schema)
[OK] 112 — testes: api 1116/1116 unit + 451/451 e2e, service 98.76% stmt/100% ln, migration ReceivableProductContributions aplicada, Postman +3 rotas — commit: 6cbe722 — 2026-07-08 — (item XOR descrição via CHECK; catálogo gera mov IN atômico; SERVANT+ p/ produtos, valor segue ADMIN/COORD)

## Resumo final

<pendente>

---

<!--
Modelo de seção por rodada — copiar abaixo ao iniciar:

# PROGRESS — stories NN–MM (<feature/epic>)

Ordem: <NN → ... → MM>. Fonte de verdade: esta seção + git log.
Config da rodada: branch base, deps rígidas, cuidados (migrations/contratos/postman/externo).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | NN — <título> | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

## Resumo final

<o que passou, o que ficou pendente/bloqueado e por quê, comandos para reproduzir>
-->
