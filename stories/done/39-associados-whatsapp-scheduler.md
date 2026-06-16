# Plan: Associados — WhatsApp (Meta Cloud API) + scheduler diário 9h

> Filha do epic [[36]]. Depende de [[37]] (cadastro), [[38]] (status de assinatura) e [[40]]
> (URL da página de pagamento). Implementar por último.

## Context

Fatia de cobrança ativa do epic [[36]]. Um job diário às **9h (America/Sao_Paulo)** identifica
associados que precisam ser cobrados e envia uma mensagem de WhatsApp **oficial (Meta Cloud API)**
com o link da página de pagamento [[40]]. Como a contribuição vira assinatura recorrente após a
adesão ([[38]]), o WhatsApp só dispara em dois casos.

### Decisões travadas (do epic)

- **Meta Cloud API (oficial).** Iniciar conversa exige **template aprovado**. Sem gateway
  não-oficial.
- **Dedupe: no máximo 1 cobrança a cada 5 dias** por associado.
- **Cron 9h** America/Sao_Paulo (já há `@nestjs/schedule` no projeto — ver
  `notification.scheduler.ts` como referência de `@Cron` com `timeZone`).

### Quem é cobrado (gatilhos)

1. **Adesão:** associado `PENDING` (nunca aderiu) cujo vencimento é **hoje ou já passou**.
2. **Reativação:** associado `PAST_DUE` (cobrança recorrente do cartão falhou em [[38]]).

Associados `ACTIVE` (assinatura em dia) **não** recebem WhatsApp — o gateway cobra sozinho.
`CANCELED` também não.

## Desenho

### Cliente Meta Cloud API — `services/api/src/modules/associate/whatsapp/`

- `WhatsAppClient` atrás de interface clara. Env: `META_WA_PHONE_NUMBER_ID`, `META_WA_TOKEN`,
  `META_WA_TEMPLATE_NAME`, `META_WA_API_VERSION`. Não acessar fora do módulo.
- `sendTemplate({ toE164, templateName, variables, urlButtonParam })` — envia template com o link
  da página de pagamento (`APP_ASSOCIADOS_URL/:payment_token`).
- Best-effort: falha de envio loga e não derruba o job (padrão do `notification.scheduler`).

### Template (configuração externa, fora do código)

Documentar no story/README: criar e submeter à Meta um template de cobrança com botão de URL
dinâmica (o `payment_token`). Anotar o nome do template aprovado em env.

### Scheduler — `associate-charge.scheduler.ts`

- `@Cron('0 9 * * *', { name: 'associate-charge', timeZone: 'America/Sao_Paulo' })`.
- Seleciona associados nos gatilhos (adesão/reativação) com vencimento ≤ hoje.
- **Dedupe 5 dias:** consultar `associate_charge_notifications` — pular quem recebeu nos últimos
  5 dias (espelhar `existsForResidentSince` do notification module). Após enviar, gravar log com
  `type` (`ADHESION`/`REACTIVATION`) e `sent_at`.
- Retorna `{ sent, skipped }` e loga (igual ao scheduler de receivables).
- Também criar uma **notificação in-app** (módulo `notification` existente, `recipientRole=ADMIN`)
  resumindo a rodada? Opcional — decidir na implementação; manter simples.

### Endpoint manual (ADMIN) — opcional

- `POST /associates/:id/charge` — dispara a cobrança WhatsApp avulsa (respeitando dedupe), p/ o
  admin forçar reenvio pela tela. Útil e barato; incluir se couber. Atualizar postman.

## Validação

- `pnpm test:api` — unit do scheduler com `WhatsAppClient` mockado: seleciona só PENDING
  vencido + PAST_DUE; ignora ACTIVE/CANCELED; respeita dedupe de 5 dias; grava log. Verde.
- `pnpm test:api:e2e` — se houver endpoint manual de cobrança, e2e ADMIN/403. Verde.
- Teste manual de envio em número de teste da Meta (sandbox) registrado na story.
- Postman atualizado (se houver endpoint manual).

## Fora de escopo

- Conversa bidirecional / respostas do associado no WhatsApp (só envio de template).
- Outros canais (SMS, e-mail) — só WhatsApp nesta fase.
- Lógica de cobrança recorrente em si (é do gateway, [[38]]).
- Criação/submissão do template na Meta (processo externo; só documentado aqui).
