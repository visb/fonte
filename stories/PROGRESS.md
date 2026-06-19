# PROGRESS — execução autônoma de stories

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive no `git log`
(stories arquivadas em `stories/done/`) — não acumular logs antigos aqui.

> Ao iniciar uma nova rodada autônoma, comece uma seção nova abaixo (`# PROGRESS — stories NN–MM`)
> e registre fila + log dela. Ao encerrar e arquivar as stories, esta seção pode ser limpa
> (o git log preserva tudo).

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada (e mergeada, se a rodada usar merge) ·
`[PARCIAL]` código completo mas parte depende de serviço externo sem credencial (mock nos testes) ·
`[BLOQUEADO]` impedida (registrar o motivo) · `[ ]` pendente

---

<!--
Modelo de seção por rodada — copiar abaixo ao iniciar:

# PROGRESS — stories NN–MM (<feature/epic>)

Ordem: <NN → ... → MM>. Fonte de verdade: esta seção + git log.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | NN — <título> | [ ] | | | |

## Log

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

## Resumo final

<o que passou, o que ficou pendente/bloqueado e por quê, comandos para reproduzir>
-->

# PROGRESS — stories 60–66

Rodada autônoma (AUTORUN). Story 60 = cache do `GET /houses` (Redis). Stories 61–66 = follow-ups
do módulo Atividades (story 48, já mergeada): quick-add inline, modal de detalhes, drag-and-drop,
visual de responsável, comentários, histórico.

Ordem: `60 → 61 → 62 → 63 → 64 → 65 → 66` (a ordem numérica respeita as deps: 62 é base de
63/65/66; 65 antes de 66; 60/61/64 independentes). Fonte de verdade: esta seção + git log.

## Dependências
- 63, 65, 66 dependem da 62 (modal de detalhes `ActivityDetailsDialog`).
- 66 depende também da 65 (aba Comentários + evento `COMMENTED`).
- 60, 61, 64 independentes entre si.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 60 — cache resposta completa GET /houses (Redis) | [OK] | api 497✓ + e2e 276✓ | 4b4f962 | 4ad25ed |
| 2 | 61 — atividades quick-add inline por coluna | [ ] | | | |
| 3 | 62 — atividades modal de detalhes + descrição editável | [ ] | | | |
| 4 | 63 — atividades drag-and-drop entre colunas | [ ] | | | |
| 5 | 64 — atividades visual do responsável no card | [ ] | | | |
| 6 | 65 — atividades comentários no modal | [ ] | | | |
| 7 | 66 — atividades histórico de eventos + abas | [ ] | | | |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

[OK] 60 — testes: api unit 497 passed (42 suites) + api e2e 276 passed (24 suites). Cache `house:list` no HouseService (hit não toca o banco, miss monta+grava, TTL 3600 reusado); novo evento `HOUSE_STAFF_CHANGED_EVENT` (StaffService emite em create/update/remove via EventEmitter2 global; não em updateMe/removePermission); handler de RESIDENT_COUNTS_CHANGED apaga as duas chaves. Sem mudança de contrato (Postman intacto). — commit: 4b4f962 — merge: 4ad25ed — 2026-06-19

