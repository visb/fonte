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
| 2 | 61 — atividades quick-add inline por coluna | [OK] | adm build✓ + PW 7✓ + ops tsc✓ | fc15be5 | c91e3a6 |
| 3 | 62 — atividades modal de detalhes + descrição editável | [OK] | api 500✓ + e2e 278✓ + adm build/PW 8✓ + ops tsc✓ | 982866b | 5a4f4ff |
| 4 | 63 — atividades drag-and-drop entre colunas | [OK] | adm unit 64✓ + PW 12✓ + tsc✓ | 9bbcbee | 5805db6 |
| 5 | 64 — atividades visual do responsável no card | [ ] | | | |
| 6 | 65 — atividades comentários no modal | [ ] | | | |
| 7 | 66 — atividades histórico de eventos + abas | [ ] | | | |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

[OK] 60 — testes: api unit 497 passed (42 suites) + api e2e 276 passed (24 suites). Cache `house:list` no HouseService (hit não toca o banco, miss monta+grava, TTL 3600 reusado); novo evento `HOUSE_STAFF_CHANGED_EVENT` (StaffService emite em create/update/remove via EventEmitter2 global; não em updateMe/removePermission); handler de RESIDENT_COUNTS_CHANGED apaga as duas chaves. Sem mudança de contrato (Postman intacto). — commit: 4b4f962 — merge: 4ad25ed — 2026-06-19

[OK] 61 — testes: adm build (tsc -b + vite) limpo + adm e2e Playwright activities.spec 7 passed (5 pré + 2 novos: cria inline só título na coluna Rascunho aparece; "A fazer" não mostra quick-add) + ops tsc --noEmit limpo. Frontend puro: QuickAddCard adm (rhf+zod só title, Enter cria, mantém modo de adição) no rodapé da ActivityColumn quando `canQuickAddInStatus` (só DRAFT; TODO fora por exigir responsável); QuickAddCard ops (RN Controller) só na seção rascunho. ActivitiesPage adm/ops renderizam board/seção mesmo vazios p/ permitir 1ª criação. Sem backend (Postman/migrations intactos). — commit: fc15be5 — merge: c91e3a6 — 2026-06-19

[OK] 62 — testes: api unit 500 passed (42 suites) + api e2e 278 passed (24 suites) + adm build (tsc -b + vite) + adm Playwright activities.spec 8 passed + ops tsc --noEmit limpo. Backend: helper `canEditDescription` (ADMIN qualquer status; criador só DRAFT/REQUESTED/TODO, 403 em DOING+); `update()` separa janela de title/houseId (regra 48 intacta) da descrição; `findOne`/`findAll` resolvem `createdBy` via Staff. Tipo `Activity.createdBy: ActivityStaffRef|null` (aditivo). adm: `ActivityDetailsDialog` autossuficiente (clique no card abre, stopPropagation nos botões), edição inline da descrição quando permitido, placeholder p/ abas (65/66); `AuthContext` expõe `userId`. ops: `ActivityDetailPage` + rota `[id]`. Postman: descrição do Update Activity atualizada (rota/DTO inalterados). — commit: 982866b — merge: 5a4f4ff — 2026-06-19

[OK] 63 — testes: adm vitest 64 passed (24 novos; resolveDrop.ts 100% cov, transitions.ts 96%) + adm Playwright activities.spec 12 passed (8 pré + 4 novos: move válido / inválido c/ erro sem API / aprovação via drag / clique-não-arrasta) + adm tsc -b limpo. Frontend puro (adm), backend é autoridade — `test:api`/postman intocados. @dnd-kit/core+sortable+utilities: `DndContext`+`DragOverlay`+PointerSensor(6px) no `ActivityBoard`; `ActivityColumn` vira `useDroppable` (destaca alvo válido/esmaece inválido); `ActivityCard` ganha alça `useDraggable` (clique ainda abre detalhes). Libs puras novas: `lib/transitions.ts` (espelha matriz+permissão do activity.service) e `lib/resolveDrop.ts` (noop/invalid/approve/move). Drop válido → PATCH /activities/:id/status; inválido → volta sozinho + erro; REQUESTED→TODO (ADMIN) → abre ApproveActivityDialog. — commit: 9bbcbee — merge: 5805db6 — 2026-06-19

## Rodada PAUSADA (2026-06-19) a pedido do usuário

Concluídas e mergeadas na main: **60, 61, 62**. PENDENTES: **63 (drag-and-drop), 64 (visual
responsável), 65 (comentários), 66 (histórico)**. Para retomar: rodar o AUTORUN a partir da 63
(63/65/66 dependem da 62, já feita; 64 independente). Serviços podem ter sido encerrados —
reexecutar o bootstrap (docker:up, test:setup, build:types+api-client, dev:api:test, dev:adm dev:test).

# PROGRESS — stories 67–70 (refino de Eventos)

Rodada autônoma (AUTORUN). Refino da feature Eventos (56/57/58): 67 toggle de inscrição, 68 campos
de formulário customizáveis, 69 pagamento avulso (backend + gateway Pagar.me orders), 70 página de
pagamento no portal + envio do link por email/WhatsApp.

Ordem: `67 → 68 → 69 → 70` (**dependência rígida — fila sequencial**, não pular). Fonte de verdade:
esta seção + git log.

## Dependências
- 68 depende de 67 (só evento com inscrição ligada tem form custom).
- 69 depende de 67 (toggle) + 58 (inscrição pública). Reusa gateway dos associados (41).
- 70 depende de 69 (endpoints `public/event-payments`, `payment_token`, gateway avulso) + portal 58.
- Se uma travar, a fila PARA (não pular) — deps rígidas.

## Externos sem credencial (mock nos testes, PENDENTE-MANUAL)
- 69: Pagar.me `POST /orders` (cartão/PIX) + webhook — mock do gateway, sem secret key real.
- 70: MailService (SMTP/Resend) + WhatsApp template Meta — best-effort, mock nos testes; template
  precisa aprovação na Meta (TODO operacional, não bloqueia código).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 67 — eventos: toggle de inscrição por evento | [ ] | | | |
| 2 | 68 — eventos: campos de formulário customizáveis | [ ] | | | |
| 3 | 69 — eventos: pagamento avulso (backend + gateway) | [ ] | | | |
| 4 | 70 — eventos: página de pagamento no portal + notificações | [ ] | | | |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

## Resumo final

<pendente>

