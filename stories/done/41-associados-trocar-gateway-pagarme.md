# Plan: Associados — trocar gateway AbacatePay → Pagar.me + cancelamento no admin

> Pertence ao epic [[36]]. **Substitui** a integração AbacatePay entregue em [[38]] e o stub de
> tokenização de [[40]]. As stories 38/40 já estão mergeadas na main; esta story refatora a camada
> de gateway sem reabrir o que não muda (cadastro [[37]], WhatsApp/scheduler [[39]]).

## Context

Durante a integração descobrimos que o **AbacatePay não atende**: assinatura recorrente de cartão
exige produto de preço fixo pré-cadastrado no painel (sem `amount` arbitrário via API) e usa
checkout hospedado por redirect, sem SDK de tokenização. Trocamos para **Pagar.me**, que encaixa
no desenho original.

### Decisões do usuário (travadas — 2026-06-16)

- **Gateway = Pagar.me** (API v5).
- **Valor da assinatura é FIXO** para todas as cobranças, = `contribution_amount` do cadastro
  (admin define). A página de adesão mostra o valor **read-only** + gross-up; o associado só
  preenche o cartão. (Cai o requisito de valor editável pelo associado.)
- **Cancelamento da recorrência = botão no admin** (adm.fonte, ADMIN). Não há login de associado,
  então o admin cancela por ele.
- **Gross-up mantido**: valor cobrado = contribuição + taxa do gateway (env), p/ a Fonte receber o
  líquido.
- **Colunas do gateway genéricas** no banco (`gateway_*`), não atreladas ao nome do gateway.

### Por que Pagar.me resolve

- **Tokenização real client-side** (`tokenizecard.js` + public key): token de cartão de 60s,
  single-use; o PAN vai direto pra Pagar.me, nunca ao nosso backend (PCI ok). Substitui o stub de
  [[40]].
- **Assinatura com valor inline**: `POST /subscriptions` aceita `items[].pricing_scheme
  {scheme_type:'unit', price}` + `interval:'month'`, `interval_count:1`,
  `payment_method:'credit_card'`, `card_token`, `customer` — valor fixo arbitrário, sem plano
  pré-cadastrado.
- **Cancelar**: `DELETE /subscriptions/{id}`.
- **Webhooks**: `charge.paid`, `charge.payment_failed`, `subscription.canceled`.

## Desenho

### Banco — migration de renomeação (nova, nunca editar a existente)

Renomear em `associates` / `associate_subscriptions` / `associate_charges`:
`abacatepay_customer_id` → `gateway_customer_id`, `abacatepay_subscription_id` →
`gateway_subscription_id`, `abacatepay_charge_id` → `gateway_charge_id` (e o índice único
parcial de idempotência criado em [[38]]). Atualizar entities.

### Backend — substituir AbacatePay por Pagar.me

- Renomear a camada `abacatepay/` → `gateway/` com interface `PaymentGateway` (token DI) e impl
  `PagarmeGateway` (HTTP v5, `Authorization: Basic <secret_key base64>`):
  - `createCustomer`, `createSubscription({ customerId, cardToken, amountCents, interval })`
    (monta `items.pricing_scheme.price` = gross-up em centavos), `cancelSubscription(id)`.
  - Env: `PAGARME_SECRET_KEY`, `PAGARME_BASE_URL`, `PAGARME_CARD_FEE_PCT`, `PAGARME_CARD_FEE_FIXED`,
    `PAGARME_WEBHOOK_*` (auth do webhook). `computeGrossUp` puro mantido.
- `POST /public/associates/:token/subscribe` agora recebe **apenas `{ cardToken }`** (valor é fixo
  = `contribution_amount`); calcula gross-up, cria customer + assinatura, persiste subscription
  ACTIVE + 1ª charge PENDING.
- **Cancelamento**: `POST /associates/:id/cancel-subscription` (ADMIN) → `cancelSubscription` no
  gateway + status `CANCELED`.
- **Webhook** `POST /webhooks/pagarme`: validar auth do Pagar.me, idempotente por
  `gateway_charge_id`, mapear eventos: `charge.paid`→PAID+ACTIVE; `charge.payment_failed`→
  FAILED+PAST_DUE; `subscription.canceled`→CANCELED.
- Remover o webhook/cliente AbacatePay e referências. Atualizar `fonte-api.postman_collection.json`.

### Frontend adm.fonte

- Botão **"Cancelar recorrência"** (ADMIN) no `AssociateRow`/detalhe quando `status=ACTIVE|PAST_DUE`
  → dialog de confirmação → `useCancelAssociateSubscription` → endpoint de cancelamento. Erros via
  `getErrorMessage`; invalida a query.

### App público `associados`

- Substituir `cardTokenizer` stub pela **integração real `tokenizecard.js`** (env
  `VITE_PAGARME_PUBLIC_KEY`): carregar o script, capturar cartão, gerar `card_token`. PAN não
  transita pelo nosso app. Em DEV sem chave, manter um fallback claramente sinalizado.
- Página: valor **read-only** (contribuição + gross-up) + aviso de recorrência mensal; só campos do
  cartão. Submit envia `{ cardToken }`.

### Tipos / api-client

- Renomear campos `abacatepay*`→`gateway*`/genérico nos tipos públicos e recurso `associates`.
  Rodar `build:types` + `build:api-client`.

## Validação

- `pnpm test:api` — unit: `computeGrossUp` (mantido); subscribe com `PaymentGateway` **mockado**
  (cria assinatura com valor fixo, charge PENDING); cancel (chama gateway + seta CANCELED); webhook
  Pagar.me idempotente + transições. Verde.
- `pnpm test:api:e2e` — subscribe (mock), cancel (ADMIN ok / não-ADMIN 403), webhook muda status.
  Verde.
- `pnpm --filter associados build` + `pnpm --filter adm.fonte build` verdes.
- Postman atualizado. Sem skip/only/xfail sem justificativa.
- Gateway nunca chamado de verdade nos testes (sem secret key) — mock. Validação em sandbox
  Pagar.me (secret + public key) fica como teste manual quando as chaves chegarem.

## Fora de escopo

- PIX (segue só cartão recorrente).
- Troca de cartão / alteração de valor pelo associado (admin recria se precisar).
- Portal/login do associado.
- Reconciliação financeira/relatórios consolidados.
