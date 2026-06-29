# Plan: Eventos internos (foco servos)

## Context

Item do BACKLOG (bloco "Eventos"): *"Nos eventos, precisamos ter a possibilidade
de criar 'eventos internos', geralmente focados para servos."*

Hoje o `Event` (`services/api/src/modules/event/event.entity.ts`) tem
`registrationEnabled` (story 67) controlando se aparece no **portal público** e
aceita inscrição. Não há noção de audiência: todo evento é, por natureza,
voltado ao público externo (famílias/comunidade). Falta um tipo de evento
**interno**, voltado aos servos (Staff), que **não** vai ao portal público e é
visível só para a equipe.

Gestão de eventos hoje (`event.controller.ts`) é restrita a **ADMIN +
COORDINATOR**. O portal público é servido por `public-event.controller.ts`. Não
existe endpoint de leitura de eventos acessível aos demais Staff (SERVANT), nem
feature de eventos no `ops.fonte`.

### Decisões travadas

- **Modelo: coluna `audience` enum** `PUBLIC | INTERNAL` (default `PUBLIC`).
  Escolhido sobre boolean por extensibilidade (futuro: `FAMILY` etc). Tipo em
  `@fonte/types`.
- **`INTERNAL` é só divulgação**: **sem inscrição e sem cobrança**. Ao marcar
  `audience = INTERNAL`, forçar `registrationEnabled = false` e
  `paymentEnabled = false` (validar no service; rejeitar combinação
  incoerente). Evento interno = aviso/agenda para servos.
- **Nunca no portal público**: `public-event.controller` filtra
  `audience = PUBLIC` (eventos internos jamais aparecem nem aceitam inscrição
  pública), independente de outras flags.
- **Onde os servos veem: adm.fonte E ops.fonte.** Precisa de endpoint de leitura
  de eventos internos acessível a **todos os papéis de Staff** (ADMIN,
  COORDINATOR, SERVANT) — não só gestão.
- **Criação/edição continua ADMIN + COORDINATOR** (controller atual). SERVANT só
  **lê** os internos.

## Desenho

### Backend (`services/api/src/modules/event/`)

- Migration nova adicionando coluna `audience varchar default 'PUBLIC'` em
  `events` (snake_case). Backfill: todos os existentes → `PUBLIC`. **Nunca editar
  migration existente.**
- Entity: campo `audience: EventAudience`. `@fonte/types`: enum `EventAudience`.
- DTOs de criar/atualizar evento aceitam `audience` (validado com
  `class-validator`, default `PUBLIC`).
- Service: ao criar/atualizar, se `audience === INTERNAL` → forçar
  `registrationEnabled = false`, `paymentEnabled = false`, `priceCents = null`;
  rejeitar (`BadRequest`) se o cliente tentar combinar interno + inscrição/paga.
- `public-event.service`/controller: filtrar `audience = PUBLIC` em todas as
  listagens/detalhe públicos.
- **Novo endpoint staff-facing** `GET /events/internal` (ou `GET /events/feed`)
  em um controller/rota com guard JWT + **todos os Staff** (sem `@Roles`
  restritivo, ou `@Roles(ADMIN, COORDINATOR, SERVANT)`): lista eventos
  `audience = INTERNAL` futuros/ordenados. Mantém `/events` (CRUD) restrito a
  ADMIN+COORDINATOR.
- Atualizar `fonte-api.postman_collection.json` (novo endpoint + campo
  `audience` nos bodies de evento).

### adm.fonte (`features/events/`)

- Form de criar/editar evento: toggle/seletor **Público / Interno**. Ao escolher
  Interno, ocultar/desabilitar os blocos de inscrição e cobrança (coerência com a
  regra do backend). `react-hook-form` + `zod`.
- Lista/seção de **eventos internos** visível aos servos logados (hook
  `useInternalEvents` → `queryKeys.events.internal`). Badge "Interno" nos cards.

### ops.fonte (`features/events/` — novo)

- Nova feature de eventos: hook `useInternalEvents` (api-client compartilhado) +
  tela de lista dos eventos internos (card extraído `EventCard`), estados
  loading/empty/error com os componentes equivalentes do app. Entrada no menu/nav
  do ops. Sem criação — só leitura.

### `@fonte/api-client`

- Método `events.listInternal()` (e `audience` nos DTOs de create/update). Não
  duplicar HTTP entre adm e ops.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:api:e2e`.)

- **Backend**:
  - service: criar evento `INTERNAL` força inscrição/cobrança off; tentar
    `INTERNAL` + `registrationEnabled`/pago → `BadRequest`; default `PUBLIC`.
  - `public-event`: listagem/detalhe público **exclui** `INTERNAL`.
  - `GET /events/internal`: retorna só internos; acessível a SERVANT; e2e com os
    três papéis de Staff (todos leem) e não-Staff bloqueado.
  - regressão: criar/listar evento público segue funcionando.
- **adm.fonte** (`pnpm test:adm` + runner de cobertura): form esconde
  inscrição/cobrança quando Interno; hook `useInternalEvents`; render da lista
  interna. E2E criar evento interno e vê-lo na lista interna (não no público).
- **ops.fonte**: cobrir hook + tela de lista de eventos internos conforme runner
  do app.
- **Contratos**: `pnpm build:types` e `pnpm build:api-client` verdes.

## Fora de escopo

- Convite via WhatsApp para servos — é a **story 95** (vale para todo evento,
  não só interno).
- Inscrição/cobrança em evento interno (decisão: interno é só divulgação).
- Outras audiências além de PUBLIC/INTERNAL (ex: FAMILY) — enum fica extensível,
  mas não entregamos novos valores aqui.
- Notificação/push automática de novo evento interno.
