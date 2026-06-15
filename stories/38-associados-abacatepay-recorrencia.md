# Plan: Associados — integração AbacatePay (cartão recorrente + gross-up + webhook)

> Filha do epic [[36]]. Depende de [[37]]. Consumida por [[40]] (checkout) e [[39]] (status).

## ⚠️ Premissa bloqueante — confirmar ANTES de codar

Confirmar na doc oficial do AbacatePay (e registrar o resultado nesta story):

- [ ] Tokenização de cartão de crédito (client-side; PAN nunca no nosso backend/app).
- [ ] Criação de **assinatura/recorrência mensal** via API.
- [ ] Webhook de eventos: cobrança paga / cobrança falhou / assinatura cancelada.
- [ ] Tabela de **taxas de cartão** (percentual + fixo) para o gross-up.

Se não houver recorrência de cartão → **parar** e reabrir levantamento com o usuário (ver [[36]]).

## Context

Fatia de pagamento do epic [[36]]. O associado adere uma vez com cartão; o AbacatePay passa a
cobrar **mensalmente sozinho**. Aqui entra: criar customer/assinatura no gateway, **calcular o
valor cobrado com gross-up** das taxas, expor endpoints públicos que a página [[40]] consome, e o
**webhook** que mantém `associate_charges`/`associate_subscriptions`/`associates.status` em dia.

### Decisões travadas (do epic)

- **Gross-up:** associado escolhe o valor que quer *contribuir* (líquido p/ a Fonte). O cobrado no
  cartão = contribuição + taxas, de forma que a Fonte receba o valor cheio.
- **Recorrência mensal** no dia de vencimento (`due_day`), gerida pelo gateway.
- **Cartão nunca toca nosso backend** — tokenização no AbacatePay; guardamos só ids/tokens.

## Desenho

### Cálculo de gross-up (taxas configuráveis por env)

Taxas de cartão = percentual `p` + fixo `f` (valores reais da conta AbacatePay, em env —
`ABACATEPAY_CARD_FEE_PCT`, `ABACATEPAY_CARD_FEE_FIXED`). Para a Fonte receber o líquido `net`:

```
gross = round2( (net + f) / (1 - p) )
fee   = gross - net
```

Guardar `net_amount`, `fee_amount`, `gross_amount` em `associate_subscriptions` e em cada
`associate_charges`. Função pura testável (`computeGrossUp(net, p, f)`).

### Cliente AbacatePay — `services/api/src/modules/associate/abacatepay/`

- `AbacatePayClient` (HTTP) atrás de interface clara; chave via env (`ABACATEPAY_API_KEY`,
  `ABACATEPAY_BASE_URL`, sandbox vs prod). Não acessar fora do módulo.
- Métodos: `createCustomer`, `createSubscription({ customer, cardToken, grossAmount, dueDay })`,
  `cancelSubscription`. Ajustar à API real após confirmar a premissa.

### Endpoints públicos (sem JWT — acesso por `payment_token`)

Para a página [[40]]:
- `GET  /public/associates/:token` — dados p/ pré-preencher (nome, valor sugerido, status). Não
  vazar dados sensíveis; só o necessário ao checkout.
- `POST /public/associates/:token/subscribe` — body: `{ contributionAmount, cardToken }`.
  Calcula gross-up, cria customer+assinatura no AbacatePay, persiste
  `associate_subscriptions` + primeira `associate_charges` (PENDING até webhook), retorna estado.
- Rate-limit/throttle nesses endpoints públicos.

### Webhook AbacatePay

- `POST /webhooks/abacatepay` — **validar assinatura/secret** (`ABACATEPAY_WEBHOOK_SECRET`).
- Eventos → efeito:
  - cobrança paga → `associate_charges.status=PAID`, `paid_at`, `subscriptions.status=ACTIVE`,
    `associates.status=ACTIVE`.
  - cobrança falhou → `charges.status=FAILED`, `subscriptions.status=PAST_DUE`,
    `associates.status=PAST_DUE` (gatilho de reativação na [[39]]).
  - assinatura cancelada → `subscriptions.status=CANCELED`, `associates.status=CANCELED`.
- Idempotente por `abacatepay_charge_id` (webhook pode repetir).

### Tipos / api-client / postman

- Tipos dos payloads públicos em `packages/types`. Recurso público no `@fonte/api-client` p/ [[40]].
- Atualizar `fonte-api.postman_collection.json` (endpoints públicos + webhook).

## Validação

- `pnpm test:api` — unit: `computeGrossUp` (casos de borda, arredondamento); service de subscribe
  (gross-up correto, cria charge PENDING) com `AbacatePayClient` mockado; webhook idempotente e
  transições de status. Verde.
- `pnpm test:api:e2e` — e2e: `GET /public/associates/:token` (token válido/ inválido), `subscribe`
  com client mock, webhook muda status. Verde.
- Teste manual em **sandbox AbacatePay** (cartão de teste) registrado na story.
- Postman atualizado.

## Fora de escopo

- UI do checkout → [[40]] (aqui só os endpoints/serviços).
- Envio de WhatsApp / scheduler → [[39]].
- PIX, troca de cartão pelo associado, retry custom de cobrança (deixar o gateway gerir).
