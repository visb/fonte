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

_(sem rodada em andamento)_
