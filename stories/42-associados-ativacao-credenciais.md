# Plan: Associados — ativação (credenciais Pagar.me + Meta WhatsApp) e validação em sandbox

> Pendências do epic [[36]] (cobrança recorrente de associados). Todo o **código** está entregue e
> verde nas stories [[37]], [[38]], [[39]], [[40]] e [[41]] — falta só o que depende de ambiente
> externo (chaves, template aprovado, validação em sandbox). Esta story rastreia esses gaps até a
> feature ir pra produção.

## Context

As stories do epic 36 foram implementadas com os serviços externos **sempre mockados** nos testes
(não há credenciais no ambiente de dev). A [[41]] trocou o gateway para **Pagar.me** e tornou a
tokenização de cartão real (deixa de ser stub quando a chave pública existir). Nada aqui é bug de
código: é configuração + validação manual contra os provedores reais.

> Importante: as pendências de **AbacatePay** da [[38]]/[[40]] estão **obsoletas** — o gateway
> agora é Pagar.me ([[41]]). Ignorar referências a `ABACATEPAY_*` em históricos.

## Pendências (checklist de ativação)

### 1. Pagar.me — gateway de pagamento ([[41]])

- [ ] Criar conta/checar contrato Pagar.me; obter **secret key** e **public key** (`pk_...`).
- [ ] Backend (`services/api/.env`): preencher `PAGARME_SECRET_KEY`, `PAGARME_BASE_URL`
      (default `https://api.pagar.me/core/v5`).
- [ ] App público (`apps/associados/.env`): preencher `VITE_PAGARME_PUBLIC_KEY` (liga a tokenização
      real `tokenizecard.js`/`/tokens?appId=`) e `VITE_PAGARME_API_URL`.
- [ ] Confirmar as **taxas reais** de cartão da conta e setar `PAGARME_CARD_FEE_PCT`/
      `PAGARME_CARD_FEE_FIXED` (backend) e `VITE_PAGARME_CARD_FEE_PCT`/`_FIXED` (app, só preview do
      gross-up). Hoje default genérico 3,99% + R$ 0,39.
- [ ] **Validar em sandbox** com cartão de teste: abrir link `/p/:token` → tokenizar → `subscribe`
      → assinatura criada na Pagar.me → 1ª cobrança. Conferir o **contrato exato** de
      `POST /subscriptions` (campos `customer_id`/`card_token`/`items.pricing_scheme.price`/
      `interval`/`billing_type`) contra a resposta real e ajustar `HttpPagarmeGateway` se divergir.
- [ ] Testar **cancelamento**: botão "Cancelar recorrência" (adm, ADMIN) → `DELETE /subscriptions/{id}`
      → status CANCELED.

### 2. Pagar.me — webhook ([[41]])

- [ ] Configurar no painel Pagar.me o endpoint `POST {API}/webhooks/pagarme` com **HTTP Basic**
      (usuário/senha); replicar em `PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD` no backend.
- [ ] Confirmar o **payload real** dos eventos `charge.paid` / `charge.payment_failed` /
      `subscription.canceled` (nomes de campos `data.id`, `data.subscription_id`,
      `data.metadata.associate_id`) e ajustar `PagarmeWebhookService` se necessário.
- [ ] Validar fim-a-fim: pagar na sandbox → webhook → associado vira ACTIVE; simular falha →
      PAST_DUE; cancelar → CANCELED.

### 3. Meta WhatsApp Cloud API — cobrança ([[39]])

- [ ] Criar/aprovar na Meta um **template** de cobrança com **botão de URL dinâmica** que recebe o
      `payment_token` (link `<APP_ASSOCIADOS_URL>/p/<token>`). Anotar o nome aprovado em
      `META_WA_TEMPLATE_NAME`.
- [ ] Preencher `META_WA_PHONE_NUMBER_ID`, `META_WA_TOKEN`, `META_WA_API_VERSION` e
      `APP_ASSOCIADOS_URL` no backend.
- [ ] Validar envio real num número de teste/sandbox da Meta; conferir o formato exato dos
      `components` (body params × botão url) contra o template aprovado e ajustar o
      `MetaWhatsAppClient` se preciso.
- [ ] Confirmar o **cron das 9h** (America/Sao_Paulo) dispara em produção e respeita o dedupe de
      5 dias (gatilhos ADHESION p/ PENDING vencido, REACTIVATION p/ PAST_DUE).

### 4. Deploy do app público `associados` ([[40]])

- [ ] Publicar `apps/associados` (build Vite) num host público e apontar `APP_ASSOCIADOS_URL` p/ ele.
- [ ] Garantir que a API expõe os endpoints públicos (`/public/associates/...`) e o webhook ao
      tráfego externo (CORS/rota/proxy).

### 5. LGPD ([[36]])

- [ ] Atualizar `docs/lgpd/DIAGNOSTICO_LGPD.md` com o novo titular **associado** (nome, WhatsApp,
      e-mail, histórico de pagamento; cartão tokenizado na Pagar.me, fora do nosso escopo PCI).

## Validação

Esta story fecha quando: assinatura recorrente criada e cobrada de verdade na Pagar.me (sandbox→prod),
webhook movendo status corretamente, WhatsApp de cobrança chegando com o link certo, cancelamento
pelo admin funcionando, e o app público no ar. Sem mudança de código esperada além de ajustes finos
de contrato (gateway/webhook/template) revelados na validação real.

## Fora de escopo

- Qualquer nova feature (PIX, troca de cartão pelo associado, portal do associado, relatórios) —
  ver "Fora de escopo" do epic [[36]] e da [[41]].
