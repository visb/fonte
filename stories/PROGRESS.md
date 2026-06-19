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

# PROGRESS — stories 64–75

Rodada autônoma (AUTORUN). Dois tracks independentes:
- **Atividades** (follow-ups da story 48/62): 64 visual responsável, 65 comentários, 66 histórico,
  71 descrição fora do board, 72 WYSIWYG markdown, 73 anexos, 74 áudio, 75 devolver p/ rascunho.
- **Eventos** (refino 56/57/58): 67 toggle inscrição, 68 campos custom, 69 pagamento avulso
  (backend + gateway), 70 página de pagamento no portal + notificações.

Ordem: `64 → 65 → 66 → 67 → 68 → 69 → 70 → 71 → 72 → 73 → 74 → 75` (numérica respeita todas as
deps). Fonte de verdade: esta seção + git log. Base já mergeada: 62 (modal `ActivityDetailsDialog`),
63 (drag-and-drop), 58 (inscrição pública), 41 (gateway associados).

## Dependências (sub-chains rígidas; os dois tracks são independentes entre si)
- **Atividades**: 65 e 71 dependem só da 62 (feita). 66 depende da 65. 72 depende da 71. 73 depende
  da 65. 74 depende da 73. 64 e 75 independentes.
- **Eventos** (fila rígida 67→68→69→70, não pular): 68 dep 67; 69 dep 67+58; 70 dep 69+portal 58.
- Se uma story travar, suas filhas na sub-chain travam junto (registrar e parar **aquela**
  sub-chain). Tracks/sub-chains independentes seguem normalmente — não parar a fila inteira.

## Externos sem credencial (mock nos testes, PENDENTE-MANUAL — não inventar chave, não chamar real)
- **69/70**: Pagar.me `POST /orders` (cartão/PIX) + webhook; MailService (SMTP/Resend) + WhatsApp
  template Meta. Mock do gateway/notificação nos testes; template Meta = TODO operacional.
- **73/74**: storage/bucket de anexos + áudio. Mockar upload nos testes se faltar credencial.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 64 — atividades: visual do responsável no card | [ ] | | | |
| 2 | 65 — atividades: comentários no modal de detalhes | [ ] | | | |
| 3 | 66 — atividades: histórico de eventos do card + abas | [ ] | | | |
| 4 | 67 — eventos: toggle de inscrição por evento | [ ] | | | |
| 5 | 68 — eventos: campos de formulário customizáveis | [ ] | | | |
| 6 | 69 — eventos: pagamento avulso da inscrição (backend + gateway) | [ ] | | | |
| 7 | 70 — eventos: página de pagamento no portal + notificações | [ ] | | | |
| 8 | 71 — atividades: descrição fora do board (só nos detalhes) | [ ] | | | |
| 9 | 72 — atividades: editor WYSIWYG na descrição (markdown) | [ ] | | | |
| 10 | 73 — atividades: anexos na atividade e nos comentários | [ ] | | | |
| 11 | 74 — atividades: áudio (upload + gravação) com player | [ ] | | | |
| 12 | 75 — atividades: devolver solicitação para rascunho (REQUESTED → DRAFT) | [ ] | | | |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

## Resumo final

<pendente>
