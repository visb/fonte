# Plan: [EPIC] Faturamento/Associados — cobrança recorrente (WhatsApp + AbacatePay cartão)

> **Status: PLANEJAMENTO.** Story-pai (epic). Não implementar este arquivo diretamente —
> coordena as stories-filhas [[37]], [[38]], [[39]] e [[40]]. Implementar só após o usuário aprovar.

## Context

A Fonte capta doações recorrentes de **associados** (pessoas físicas que contribuem mensalmente).
Hoje não existe nada disso no sistema — é controle manual fora da plataforma. Queremos:

1. Cadastrar associados manualmente (admin).
2. Cobrar a **adesão** via WhatsApp com link de pagamento.
3. Uma vez que o associado adere com cartão, a contribuição vira **assinatura recorrente mensal
   automática** no gateway — **sem reenviar cobrança todo mês**.
4. Re-notificar via WhatsApp só quem ainda não aderiu ou cuja cobrança recorrente falhou
   (cartão recusado), respeitando um teto de frequência.

Este é um domínio **novo e independente** dos `residents`/`resident-receivable` (carnê de
acolhidos). Não reusar aquele modelo — associado não tem casa, não tem acolhido vinculado.

### Decisões do usuário (travadas — respostas do levantamento)

- **WhatsApp via Meta Cloud API (oficial).** Exige template aprovado para iniciar conversa.
  Não usar gateway não-oficial.
- **Contribuição mensal recorrente, dia de vencimento fixo.** `due_day` (1–31); a recorrência roda
  no dia fixo todo mês.
- **Página de pagamento = novo app `associados`** (frontend público, sem login). Link enviado no
  WhatsApp aponta para lá. Valor vem pré-preenchido com o valor cadastrado, mas é **editável** pelo
  associado.
- **Pagamento por cartão de crédito com assinatura recorrente no AbacatePay.** Tokeniza o cartão
  uma vez; AbacatePay cobra mensalmente sozinho. Sem cobrança manual mensal.
- **Taxas do gateway acrescidas ao valor final (gross-up).** O associado escolhe quanto quer
  *contribuir* (líquido para a Fonte); o valor **cobrado no cartão** = contribuição + taxas, de
  forma que a Fonte receba o valor cheio.
- **Cobrança via WhatsApp no máximo 1× a cada 5 dias** por associado (dedupe).
- **Job diário às 9h** (America/Sao_Paulo) identifica vencendo-hoje / em atraso e dispara.

### Por que adesão única + recorrência no gateway (e não cobrança mensal por WhatsApp)

O usuário pediu explicitamente recorrência **sem** reenviar cobrança todo mês. Com cartão
tokenizado + assinatura no AbacatePay, o gateway cobra automaticamente — reduz fricção e
inadimplência. O WhatsApp passa a ter dois únicos gatilhos: **adesão inicial** (associado ainda
sem assinatura ativa) e **reativação** (assinatura ficou `PAST_DUE` por cartão recusado/expirado).

## ⚠️ Premissa bloqueante a confirmar antes de implementar [[38]]

**O AbacatePay precisa suportar cartão de crédito + assinatura recorrente (tokenização +
billing recorrente) via API.** Historicamente o AbacatePay é focado em PIX. Antes de codar a
[[38]], confirmar na doc oficial:

- Tokenização de cartão (PCI — nunca trafegar/armazenar PAN no nosso backend/app).
- Criação de assinatura/recorrência mensal.
- Webhook de eventos de cobrança (paga / falhou / assinatura cancelada).
- Tabela de taxas de cartão (para o cálculo de gross-up).

Se o AbacatePay **não** suportar recorrência de cartão, parar e reabrir o levantamento com o
usuário (alternativas: PIX recorrente / outro gateway). Registrar a confirmação na [[38]].

## Desenho geral (modelo de dados)

```
associates                         (cadastro manual pelo admin)
  id, name, whatsapp (E.164), email? ,
  contribution_amount numeric(10,2),     -- valor líquido pretendido (default editável)
  due_day smallint,                      -- 1..31; clamp ao último dia do mês
  status: PENDING | ACTIVE | PAST_DUE | CANCELED,
  abacatepay_customer_id? ,
  payment_token uuid,                    -- acesso à página pública (revogável)
  created_at, updated_at, deleted_at

associate_subscriptions            (assinatura recorrente no gateway)
  id, associate_id → associates,
  abacatepay_subscription_id,
  net_amount, fee_amount, gross_amount numeric(10,2),
  status: ACTIVE | PAST_DUE | CANCELED,
  started_at, canceled_at? , created_at, updated_at

associate_charges                  (cada cobrança — adesão + recorrentes)
  id, associate_id, subscription_id? ,
  abacatepay_charge_id,
  net_amount, fee_amount, gross_amount numeric(10,2),
  status: PENDING | PAID | FAILED,
  due_date date, paid_at? , created_at, updated_at

associate_charge_notifications     (log p/ dedupe 5 dias)
  id, associate_id, channel: WHATSAPP, type: ADHESION | REACTIVATION,
  sent_at, created_at
```

- **Cartão nunca toca nosso backend.** Tokenização client-side direto no AbacatePay; guardamos só
  ids/tokens do gateway. (PCI + LGPD.)
- `payment_token` dá acesso à página pública sem login; revogável regenerando o token.
- `status` do associado é derivado da assinatura: `PENDING` (nunca aderiu), `ACTIVE` (assinatura
  ativa), `PAST_DUE` (recorrente falhou), `CANCELED`.

## Stories-filhas

1. **[[37]] — Backend `associate` + CRUD no adm.fonte.** Entity/migrations/DTO/endpoints ADMIN do
   cadastro de associados + tela de gestão (lista, criar, editar, ver status). Base de tudo.
2. **[[38]] — Integração AbacatePay (cartão recorrente + gross-up + webhook).** Confirmar premissa
   bloqueante; criar customer/assinatura, cálculo de taxa (gross-up), endpoints públicos do
   checkout, webhook que atualiza `associate_charges`/`subscriptions`/status.
3. **[[40]] — App público `associados` (página de pagamento).** Novo frontend React/Vite público;
   rota por `payment_token`; valor pré-preenchido editável; tokenização do cartão e adesão à
   recorrência via [[38]].
4. **[[39]] — WhatsApp (Meta Cloud API) + scheduler 9h.** Cliente Meta Cloud API, template de
   cobrança com botão/link, job diário 9h que seleciona adesão/reativação e respeita dedupe 5 dias.

Ordem: **37 → 38 → 40 → 39.** (38 depende de 37; 40 consome o checkout de 38; 39 envia o link da
página de 40 e só dispara para quem [38] marcou sem assinatura/`PAST_DUE`.)

## Validação (do epic)

Cada filha tem sua validação. Epic fecha quando 37–40 estiverem verdes e o fluxo end-to-end rodar:
cadastrar associado → job 9h envia WhatsApp → abrir link → pagar com cartão (sandbox AbacatePay) →
assinatura recorrente criada → webhook marca cobrança paga e associado `ACTIVE` → próximo ciclo
cobra sozinho sem novo WhatsApp.

## Fora de escopo (desta fase)

- PIX (avulso ou recorrente) — só cartão recorrente agora.
- Recibo/comprovante fiscal, emissão de NF, integração contábil.
- Portal de autogestão do associado (cancelar/alterar valor sozinho) além da página de adesão.
- Importação em massa de associados (cadastro é manual nesta fase).
- Relatórios financeiros consolidados de associados (dashboard) — só o status por associado.
- Reuso pelo carnê de acolhidos (`resident-receivable`) — domínio separado, não tocar.

## LGPD

Associado é um **novo titular de dados pessoais** (nome, WhatsApp, e-mail, histórico de
pagamento). Atualizar `docs/lgpd/DIAGNOSTICO_LGPD.md` com o novo inventário. Base legal:
execução de contrato/legítimo interesse para a relação de doação recorrente. Dados de cartão
**não** são tratados por nós (tokenização no gateway PCI). Detalhar na [[38]]/[[40]].
