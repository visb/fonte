# Plan: Convite via WhatsApp para servos nos eventos

## Context

Item do BACKLOG (bloco "Eventos"): *"Adicionar funcionalidade de enviar convite
via whatsapp para servos em todos os eventos."*

Vale para **todo** evento (público ou interno — ver story 94), não só os
internos. A infra de WhatsApp já existe: `MetaWhatsAppClient`
(`services/api/src/modules/associate/whatsapp/whatsapp.client.ts`), template-based
(Meta Cloud API), **best-effort** (sem credencial/erro → loga e devolve
`{ sent: false }`, nunca derruba o fluxo). Já suporta `urlLink` para link
completo (story 70). Reusar.

### Decisões travadas

- **Destinatários: seleção de servos.** Quem dispara escolhe quais Staff recebem
  (multi-select; conveniência: filtrar por casa / "todos"). Evita spam. Não é
  "todos sempre".
- **Disparo: botão manual no adm.** Ação "Convidar servos" na tela do evento, sob
  demanda. Sem envio automático ao criar.
- **Link do convite: sempre a página pública de detalhe do evento.**
  - ⚠️ Tensão com story 94 (evento interno **não** vai ao portal público).
    Resolução: o link aponta para uma **página pública de detalhe por
    id/slug-token** (`<APP_ASSOCIADOS_URL>/eventos/<id>` ou rota equivalente) que
    renderiza info do evento e funciona por **link direto** — sem que o evento
    interno apareça na **listagem** pública (a listagem segue filtrando
    `audience = PUBLIC`, conforme story 94). Convite = link compartilhável
    direto; portal = vitrine. São coisas distintas.
- **Telefone do servo**: usar o campo de telefone/WhatsApp do `Staff`,
  normalizado para E164. **Depende da story 96** (que troca `telefone`→`whatsapp`
  e torna o whatsapp o identificador): se 96 já entrou, usar `staff.whatsapp`;
  senão, usar `staff.phone`. Servo sem número válido → pulado e reportado no
  resultado (não falha o lote).
- **Template Meta dedicado**: novo template aprovado para convite de evento
  (env `META_WA_TEMPLATE_NAME_EVENT_INVITE`); corpo com título/data/local, botão
  de URL com o link de detalhe. Best-effort (sem credencial → nada é enviado,
  como nos demais fluxos). Sem credencial nos testes → mock via `WHATSAPP_CLIENT`.
- **Permissão de disparo**: ADMIN + COORDINATOR (mesma gestão de eventos).

## Desenho

### Backend (`services/api/src/modules/event/`)

- Endpoint `POST /events/:id/invite-staff` (guard JWT + `@Roles(ADMIN,
  COORDINATOR)`), body `{ staffIds: string[] }` validado por DTO +
  `class-validator` (não-vazio, uuids).
- Service `inviteStaff(eventId, staffIds, sender)`:
  - carrega evento (404 se não existe); monta link público de detalhe via base
    `APP_ASSOCIADOS_URL`.
  - carrega os Staff selecionados; para cada um com número válido (E164), chama
    `whatsAppClient.sendTemplate` com `templateName =
    META_WA_TEMPLATE_NAME_EVENT_INVITE`, variáveis (título/data/local) e
    `urlLink` = link de detalhe.
  - retorna resumo `{ sent: [...], skipped: [{ staffId, reason }] }` (sem
    número / falha de envio). Best-effort: falha individual não aborta o lote.
- Página pública de detalhe por id: garantir rota pública
  `GET /public/events/:id` (ou reusar a existente do `public-event.controller`)
  que resolve **qualquer** evento por id para o link direto, sem incluí-lo na
  **listagem** pública. (Se já existir detalhe público por id, só confirmar que
  resolve evento interno por link direto; a listagem continua filtrando PUBLIC.)
- Atualizar `fonte-api.postman_collection.json` (endpoint de convite + a env nova
  documentada).

### adm.fonte (`features/events/`)

- Componente `InviteStaffDialog` autossuficiente (busca os servos elegíveis via
  hook próprio — multi-select com filtro por casa / "todos"; **sem** prop
  drilling). Hook de mutation `useInviteEventStaff(eventId)` →
  `queryKeys.events...`. Botão "Convidar servos" na tela do evento.
- Após envio, exibir resumo (quantos enviados / pulados e motivo) via toast/área
  de feedback; erros via `getErrorMessage`. Estados loading/empty/error com os
  componentes compartilhados.

### `@fonte/api-client`

- Método `events.inviteStaff(eventId, staffIds)`. Não duplicar HTTP.

### Página pública de detalhe (apps/associados)

- Se ainda não existir página de detalhe por id, adicionar rota
  `/eventos/:id` que renderiza info do evento (título, data, local, descrição) a
  partir do endpoint público de detalhe. Reusar layout de evento existente.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:api:e2e`.)

- **Backend** (WhatsApp client **mockado** — sem credencial real, sem chamar
  Meta):
  - service: convida N servos → chama `sendTemplate` por servo com número válido,
    com template/variáveis/`urlLink` corretos; servo sem número → entra em
    `skipped` (não chama envio); falha de um envio não aborta os demais
    (best-effort) e entra em `skipped`; evento inexistente → 404.
  - controller/e2e: `POST /events/:id/invite-staff` exige ADMIN/COORDINATOR
    (SERVANT e não-auth bloqueados); DTO inválido → 400; resposta traz o resumo.
  - link de detalhe montado a partir de `APP_ASSOCIADOS_URL` corretamente.
- **adm.fonte** (`pnpm test:adm` + runner de cobertura): `InviteStaffDialog`
  (seleção, filtro, submit chama a mutation); render do resumo enviados/pulados.
  E2E: abrir evento → convidar servos → ver feedback.
- **associados** (se a página nova for criada): unit/render da página de detalhe
  por id + cobertura conforme runner do app.
- **Contratos**: `pnpm build:api-client` verde.

## Fora de escopo

- Convite por e-mail/push (só WhatsApp aqui).
- Rastreio de leitura/confirmação de presença a partir do convite.
- Envio automático ao criar evento (decisão: manual).
- Aprovação do template na Meta (operacional/credencial — fora do código; ver
  `PROGRESS.md`/`fonte-backup` padrão de credenciais externas).
- Troca `telefone`→`whatsapp` no cadastro de Staff — é a **story 96** (esta só
  consome o número existente).
