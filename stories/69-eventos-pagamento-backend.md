# Plan: Eventos — pagamento avulso da inscrição (backend + gateway)

> Estende a feature Eventos. Terceira fatia do refino, parte 1/2: [[67]] (toggle), [[68]] (campos
> custom), **[[69]] (este — backend do pagamento)**, [[70]] (portal: página de pagamento + envio
> do link por email/WhatsApp). Depende de [[58]] (inscrição pública) e [[67]] (toggle). Reusa a
> camada de gateway dos associados ([[41]]), mas para cobrança **avulsa**, não recorrente.

## Context

A inscrição em eventos pode ser **paga**. Ao se inscrever pelo link, o inscrito vê uma página de
pagamento e pode pagar na hora ou depois (link reabrível — parte [[70]]). O pedido do usuário:
"pagamento inspirado na implementação que temos hoje para os associados".

Diferença-chave dos associados: associados é **assinatura recorrente mensal** (Pagar.me
`subscriptions`, [[41]]); evento é **pagamento único** (Pagar.me `orders`/charge avulsa). Esta
fatia entrega só o **backend**: configuração de cobrança no evento, criação da cobrança no gateway
(cartão + PIX), token de pagamento por inscrição e webhook que confirma o pagamento.

### Decisões travadas (do usuário — 2026-06-19)

- **Cobrança avulsa (1x)**, não recorrente. Pagar.me `POST /orders` (uma charge), não
  `subscriptions`.
- **Configurável por evento**: campo de cobrança no evento. Evento **grátis** segue o fluxo atual
  da [[58]] (inscreveu, pronto); evento **pago** gera cobrança. `payment_enabled` + `price_cents`.
- **Métodos: cartão + PIX.** Pagar.me order aceita ambos. Cartão reusa a tokenização client-side
  dos associados ([[41]], `tokenizecard.js`); PIX gera QR/copia-e-cola (sem dados de cartão).
- **Pagar depois via token**: a inscrição gera um `payment_token` e a página `/pagamento/:token`
  (parte [[70]]) é reabrível até pagar — mesmo padrão `/p/:token` dos associados.
- **Gross-up mantido** (igual associados): valor cobrado = preço + taxa do gateway (env), p/ a
  Fonte receber o líquido. `computeGrossUp` já existe e é reusado.
- Colunas de gateway **genéricas** (`gateway_*`), como em [[41]].

## Desenho

### Banco — migration nova (nunca editar existentes)

- `events`: `payment_enabled` boolean not null default `false`, `price_cents` int null
  (obrigatório quando `payment_enabled = true`, validado no service).
- `event_registrations`:
  - `payment_token` varchar null unique (gerado quando o evento é pago; índice único),
  - `payment_status` enum/varchar not null default `NONE`
    (`NONE` p/ inscrição grátis | `PENDING` | `PAID` | `FAILED`),
  - `amount_cents` int null (valor gross-up cobrado, snapshot no momento da inscrição),
  - `gateway_order_id` varchar null, `gateway_charge_id` varchar null (genéricos),
  - `payment_method` varchar null (`credit_card` | `pix`).
  - Índice único parcial de idempotência por `gateway_charge_id` (padrão [[38]]/[[41]]).

### Backend — gateway: estender p/ cobrança avulsa

- `associate/gateway/` hoje expõe `PaymentGateway` (subscription). **Promover a camada de gateway
  para um módulo compartilhado** (ex.: `src/modules/gateway/` ou `src/common/gateway/`) ou estender
  a interface com cobrança avulsa, sem quebrar associados:
  - `createOrder({ customerId?, cardToken?, amountCents, method, item })` →
    Pagar.me `POST /orders` com uma charge:
    - cartão: `payments[].credit_card.card_token`;
    - PIX: `payments[].pix` (expiração configurável) → retorna `qr_code`/`qr_code_url`.
  - Reusar env Pagar.me de [[41]] (`PAGARME_SECRET_KEY`, `PAGARME_BASE_URL`, taxas p/ gross-up).
  - `computeGrossUp` reaproveitado.
- Manter `PaymentGateway` (subscription) dos associados intacto; testes de associados seguem verdes.

### Backend — módulo `event`

- **Validação** em `Create/UpdateEventDto`: se `paymentEnabled = true` exigir `priceCents > 0`.
- Ao inscrever (`POST /public/events/:id/register`, módulo de inscrição [[58]]/[[68]]):
  - evento grátis (`payment_enabled = false`) → `payment_status = NONE`, fim (como hoje).
  - evento pago → gerar `payment_token`, calcular gross-up (`amount_cents`), criar a inscrição
    `PENDING`. **Não** cobra ainda — a cobrança nasce quando o inscrito escolhe método na página
    de pagamento ([[70]]).
- **Endpoint público de pagamento por token** (sem JWT, `ThrottlerGuard`/`@Throttle`, padrão
  `PublicAssociateController`):
  - `GET  /public/event-payments/:token` — dados da inscrição p/ a página: nome do evento, valor,
    status, método já escolhido. 404 token inválido.
  - `POST /public/event-payments/:token/pay` — body `{ method: 'credit_card', cardToken }` ou
    `{ method: 'pix' }`. Cria a order no gateway, persiste `gateway_order_id`/`gateway_charge_id`/
    `payment_method`, `PENDING`. Cartão → confirma via webhook; PIX → devolve QR/copia-e-cola.
    Idempotente: se já `PAID` → 409/no-op.
- **Webhook** `POST /webhooks/pagarme` (já existe p/ associados, [[41]]): mapear eventos de **order/
  charge avulsa** além das de subscription — `charge.paid` → `payment_status = PAID`;
  `charge.payment_failed` → `FAILED`. Idempotente por `gateway_charge_id`. Roteia por
  origem (associate vs event registration) pelo id da charge/metadata.
- **Endpoint admin**: `GET /events/:id/registrations` ([[58]]/[[68]]) inclui `payment_status` e
  `amount_cents`. Útil p/ a gestão ver quem pagou.
- Atualizar `fonte-api.postman_collection.json` (event-payments + campos novos).

### Tipos / api-client

- `@fonte/types`: `Event` ganha `paymentEnabled`/`priceCents`; `EventRegistration` ganha
  `paymentStatus`/`amountCents`; tipos públicos `EventPaymentInfo`, `PayEventInput`,
  `PixPaymentResult` (qr code). `pnpm build:types`.
- `@fonte/api-client`: recurso público `eventPayments.getByToken/pay`; `events` (admin) propaga
  `paymentEnabled`/`priceCents`. `pnpm build:api-client`.

### Frontend adm.fonte (mínimo desta fatia)

- Seção de inscrição do `EventForm` ([[67]]) ganha toggle **"inscrição paga"** + campo de valor
  (`priceCents`), só habilitado quando ligado. Validação zod: pago exige valor > 0.
- `GET /events/:id/registrations` mostra coluna/badge de `payment_status`.

## Validação

- `pnpm test:api` — unit: `paymentEnabled` sem `priceCents` → 400; register de evento pago cria
  `PENDING` + `payment_token` + gross-up correto; `pay` com gateway **mockado** cria order (cartão
  e PIX); webhook `charge.paid` → `PAID` idempotente; `pay` em inscrição já `PAID` → 409. Gateway
  nunca chamado de verdade (sem secret key) — mock. Associados (subscription) seguem verdes.
- `pnpm test:api:e2e` — `public/event-payments`: GET por token (404 inválido), pay cartão/pix,
  webhook muda status; register grátis não gera token; admin vê `payment_status`.
- `pnpm --filter adm.fonte build` verde. `build:types`/`build:api-client` ok. Postman atualizado.
  Sem skip/only/xfail sem justificativa.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Cobrir explicitamente os ramos de pagamento (cartão, PIX,
  webhook `paid`/`failed`, idempotência, 409 já-pago, gross-up). Rodar `pnpm test:api:cov`; **não
  reduzir** a cobertura do módulo `event` nem da camada de gateway. Regressão: cobertura de
  associados (subscription) não cai.

## Fora de escopo (vai p/ [[70]])

- Página `/pagamento/:token` no `portal.fonte` (UI de cartão/PIX, exibição do QR).
- Envio do link de pagamento por **email** (MailService novo) e **WhatsApp** (template novo).
- Reembolso/estorno; conciliação financeira.
- Cobrança recorrente de evento (decidido avulso).
- Telas de eventos no `ops.fonte`/`app.fonte`.
