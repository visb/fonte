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
    e2e; 134 é docs). Última migration aplicada: `1783037200000-UserPreferences`. Se alguma
    investigação revelar necessidade de schema, **parar e registrar** — não improvisar migration.
  - **Contratos** (`packages/types`/`api-client`): não devem mudar. 131 corrige uso de tipos já
    existentes (`Resident.houseId: string | null`), não os altera. Se precisar mudar contrato,
    rebuildar (`pnpm build:types && pnpm build:api-client`) e refletir no Postman.
  - **Postman:** nenhuma das 4 adiciona/altera endpoint. Só tocar se a investigação do e2e (131)
    revelar bug de API que exija endpoint novo (improvável).
  - **Baseline honesto (131):** medir `residents.spec.ts` ANTES (6 failed / 22 passed) e DEPOIS
    (0 failed); os 4 erros `tsc` são reais e reproduzíveis (`ContributionsTab` 34/77, `useBulkImport`
    388, `residentSchema` 102). Comparar com a main via `git stash -u` continua sendo a régua.
  - **Seed compartilhado (132):** adicionar filho elegível NÃO pode regredir contagens que outros
    specs assumem (listagens por casa, dashboard, ordenação da 129). Preferir filho dedicado +
    conferir specs de contagem. Datas retrodatadas relativas ao "agora", não fixas.
  - **Isolamento (133):** cada spec que salva preferência limpa em `afterEach`
    (`DELETE /preferences/residents.filters`) — senão vaza no DB de teste compartilhado. Rodar 2×/ordem
    embaralhada pra provar determinismo. Preferir `e2e/preferences.spec.ts` próprio.
  - **134 é docs-only + REVISÃO HUMANA:** a base legal LGPD é decisão de compliance, não mecânica. O
    implementer PROPÕE o texto (inventário + gap no roadmap); marcar **PENDENTE-REVISÃO-HUMANA** no
    ledger ao mergear — o texto entra, mas a assinatura jurídica fica pendente do usuário. Sem gate de
    cobertura (não há código).
  - **Gate de cobertura ≥ 90** no pacote tocado (131/132/133 quando tocarem código), sem
    `skip`/`only`/`xfail` injustificado. 132 REMOVE skips (não adiciona). 134 sem gate de teste.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 131 — sanear tsc + e2e de `features/residents` | [OK] | tsc 0 err · adm unit 1293/1293 · Playwright residents 29/0 (era 5 failed) · cov escopo ≥90 | 37e5cc1 | 33f4482 |
| 2 | 132 — corrigir seed de teste dos elegíveis (remover 2 skips) | [OK] | bible-courses e2e 16/16 (2 reativados) · api e2e 485/485 · eligible=3 | 7d5ab12 | 87bd1cc |
| 3 | 133 — e2e Playwright de preferências / filtros persistidos | [ ] | | | |
| 4 | 134 — LGPD: inventariar `staff.signature_url` (docs) | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

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
série e testes anteriores matriculam elegíveis. Zero regressão (nenhum spec faz hard-count do total;
Casa Teste sob capacidade 10). **Descoberta:** 2 falhas e2e novas fora de `residents` (activities/payables)
— candidatas a nova dívida, não bloqueiam a rodada.

## Resumo final

<pendente — rodada em andamento>
