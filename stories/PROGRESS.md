# PROGRESS — ledger da rodada AUTORUN corrente

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive em
`stories/done/PROGRESS-NN-MM.md` (uma por rodada) + `git log` (stories arquivadas em
`stories/done/`) — não acumular logs antigos aqui.

**Nenhuma rodada ativa no momento.** Rodadas encerradas:

- `done/PROGRESS-64-75.md`
- `done/PROGRESS-77-84.md` — cobertura de testes (piso 80%)
- `done/PROGRESS-85-91.md` — cobertura de testes (piso 90%)
- `done/PROGRESS-92-98.md` — features (curso bíblico, bucket, eventos, perfil servo)
- `done/PROGRESS-99-106.md` — curso: sugerir matrícula + import em lote de filhos (106 purga de histórico PENDENTE-MANUAL)

Ao abrir uma rodada nova, copiar o modelo abaixo aqui e preencher fila + config. Ao encerrar,
mover a seção da rodada para `stories/done/PROGRESS-NN-MM.md` e restaurar este stub.

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada (e mergeada, se a rodada usar merge) ·
`[PARCIAL]` código completo mas parte depende de serviço externo sem credencial (mock nos testes) ·
`[BLOQUEADO]` impedida (registrar o motivo) · `[ ]` pendente

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
