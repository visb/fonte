# PROGRESS — stories 131–134 (dívidas da rodada 125–130: saneamento de teste + LGPD)

Ordem: 131 → 132 → 133 → 134. Fonte de verdade: esta seção + git log.

**Config da rodada**

- **Branch base:** `main` (cada branch parte da main ATUAL, já com o merge da anterior).
- **Prefixo de branch:** `feat/story-NN-<slug>`.
- **Deps rígidas** (se a de cima bloquear, a de baixo bloqueia junto — não pular):
  - **133 → 131** (o e2e de preferências precisa de `residents`/suíte e2e verde; sobre suíte instável
    o sinal do novo spec fica ambíguo). Se 131 bloquear, 133 bloqueia junto.
  - 132 e 134 são independentes das demais.
- **Cuidados da rodada:**
  - **Sem migration nova** em nenhuma das 4 (131 conserta tipos; 132 mexe só no seed de teste; 133 é
    e2e; 134 é docs). Última migration aplicada: `1783037200000-UserPreferences`.
  - **Contratos** (`packages/types`/`api-client`): não devem mudar.
  - **Postman:** nenhuma das 4 adiciona/altera endpoint.
  - **Gate de cobertura ≥ 90** no pacote tocado (131/132/133 quando tocarem código). 134 sem gate.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 131 — sanear tsc + e2e de `features/residents` | [OK] | tsc 0 err · adm unit 1293/1293 · Playwright residents 29/0 (era 5 failed) · cov escopo ≥90 | 37e5cc1 | 33f4482 |
| 2 | 132 — corrigir seed de teste dos elegíveis (remover 2 skips) | [OK] | bible-courses e2e 16/16 (2 reativados) · api e2e 485/485 · eligible=3 | 7d5ab12 | 87bd1cc |
| 3 | 133 — e2e Playwright de preferências / filtros persistidos | [DEFERIDA] | | | |
| 4 | 134 — LGPD: inventariar `staff.signature_url` (docs) | [DEFERIDA] | | | |

## Log

[OK] 131 — testes: tsc adm 0 erros (os 4 sumiram) · adm unit 1293/1293 · Playwright `residents.spec.ts`
29 passed/0 failed (baseline main em DB limpo: 5 failed) · cov escopo ≥90 — commit: 37e5cc1 — merge:
33f4482 — 2026-07-18. **Causa raiz dos 4 tsc:** `houseId` virou `string | null` (migration
`AllowNullResidentHouse`) e o consumidor assumia `string` → tratado com guard (`enabled: ...&&!!houseId`
+ estado vazio "Sem carnê", `queryKey`/`queryFn` aceitam null, `residentToFormValues` normaliza p/ '');
`buildCommitPayloadFromPreview` tinha aridade 2 → removida a 3ª arg `fileName` da chamada. **Causa raiz
dos 5 e2e:** listagem passou a abrir filtrada por "Ativo" (default da story 130) e escondia o residente
`PRE_ADMISSION` recém-criado pelo wizard → helper `openResidentFromList` seleciona "Todos os status"
antes de buscar. **Aviso operacional:** DB de teste poluído (residentes ACTIVE acumulados) soterra o
seed João Testador na paginação "recentes primeiro" e gera falhas fantasma — reseedar (`seed:test`)
antes de medir e2e. Implementer deixou o DB de teste limpo.

[OK] 132 — testes: bible-courses e2e 16/16 (2 `test.skip` das stories 99 e 125 removidos, passam de
verdade) · adm e2e 157/159 (2 falhas PRÉ-EXISTENTES: `activities` WYSIWYG + `payables` status, provadas
via stash, fora de escopo) · api e2e 485/485 · `eligible-residents`=3 — commit: 7d5ab12 — merge: 87bd1cc
— 2026-07-18. Semeados 3 filhos ACTIVE na Casa Teste com `entry_date = CURRENT_DATE - (6|5|4) meses`
(relativo, nunca expira), sem user_id/matrícula/"já fez" → elegíveis; 3 (buffer) porque a suíte roda em
série e testes anteriores matriculam elegíveis. Zero regressão. **Descoberta:** 2 falhas e2e novas fora
de `residents` (activities/payables) — candidatas a nova dívida, não bloqueiam a rodada.

## Resumo final

Rodada **encerrada parcialmente**: 131 e 132 [OK] e mergeadas/arquivadas. **133 e 134 DEFERIDAS** por
decisão do usuário (2026-07-21) ao abrir a rodada 135–141 — os arquivos `stories/133-*.md` e
`stories/134-*.md` permanecem em `stories/` (não arquivados) para retomada numa rodada futura. Dívida
aberta descoberta na 132: 2 falhas e2e adm em `activities` (WYSIWYG) e `payables` (status), pré-existentes.
