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
| 1 | 131 — sanear tsc + e2e de `features/residents` | [ ] | | | |
| 2 | 132 — corrigir seed de teste dos elegíveis (remover 2 skips) | [ ] | | | |
| 3 | 133 — e2e Playwright de preferências / filtros persistidos | [ ] | | | |
| 4 | 134 — LGPD: inventariar `staff.signature_url` (docs) | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

## Resumo final

<pendente — rodada em andamento>
