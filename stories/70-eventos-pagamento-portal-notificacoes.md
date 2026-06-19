# Plan: Eventos — página de pagamento no portal + envio do link (email + WhatsApp)

> Estende a feature Eventos. Terceira fatia do refino, parte 2/2: [[67]] (toggle), [[68]] (campos
> custom), [[69]] (backend do pagamento), **[[70]] (este — portal + notificações)**. Depende de
> [[69]] (endpoints `public/event-payments`, `payment_token`, gateway avulso) e do portal de
> [[58]]. Fecha o refino de eventos.

## Context

Com o backend de [[69]] pronto (cobrança avulsa, token por inscrição, webhook), falta a ponta do
usuário: a **página de pagamento** no portal público e o **envio do link** por email e WhatsApp
para o inscrito pagar na hora ou depois — exatamente o pedido: "ao se cadastrar pelo link, mostrar
página de pagamento, enviar por email e whatsapp link para acessar essa página e fazer pagamento
posteriormente".

### Decisões travadas (do usuário — 2026-06-19)

- **Página por token reabrível**: `/pagamento/:token` no `portal.fonte`, acessível até pagar
  (mesmo padrão `/p/:token` dos associados, [[40]]/[[41]]).
- **Cartão + PIX** na página (métodos definidos em [[69]]). Cartão via tokenização client-side
  (`tokenizecard.js`, reuso de [[41]]); PIX exibe QR + copia-e-cola.
- **Envio do link por email E WhatsApp** ao concluir a inscrição de evento pago.
- **MailService novo e simples** (não existe email no repo): transporte por env (SMTP via
  nodemailer **ou** Resend — escolher o mais simples de operar), **best-effort** igual ao WhatsApp
  (falha logada, nunca derruba a inscrição). Sem engine de template elaborada — corpo simples com
  o link.

## Desenho

### Backend — notificações do pagamento de evento

- **MailService** novo, módulo compartilhado (ex.: `src/modules/mail/` ou `common/mail/`):
  - interface `MailSender` + impl (SMTP/Resend), env (`MAIL_*` / `RESEND_API_KEY`,
    `MAIL_FROM`). Best-effort: sem credencial → loga e devolve `{ sent: false }`, NUNCA lança.
  - injetável por token DI (mock nos testes, padrão do `WHATSAPP_CLIENT`).
- **WhatsApp**: reaproveitar `MetaWhatsAppClient` ([[39]]). Hoje está sob `associate/whatsapp` e o
  link é hardcoded `/p/<token>` com `APP_ASSOCIADOS_URL`. Para eventos:
  - generalizar o cliente p/ aceitar o link/template por parâmetro (ou extrair p/ módulo
    compartilhado), sem quebrar o fluxo de associados.
  - **template novo** de WhatsApp p/ evento (`META_WA_TEMPLATE_EVENT_PAYMENT` ou similar) com botão
    de URL apontando p/ `<PORTAL_URL>/pagamento/<token>`. Documentar a env e que o template precisa
    ser aprovado na Meta (TODO operacional, não bloqueia o código).
- **Disparo**: ao registrar inscrição em evento **pago** ([[69]] gera `payment_token`), enviar o
  link por email (se houver `email` na inscrição) e por WhatsApp (se o `contact`/telefone for
  E.164 válido). Best-effort — a inscrição é criada mesmo se os envios falharem. Reenvio manual:
  endpoint admin `POST /events/:id/registrations/:regId/resend-payment-link` (ADMIN+COORDINATOR),
  útil quando o inscrito não recebeu.
- Env de URL do portal: reusar/renomear `APP_ASSOCIADOS_URL` p/ algo coerente com o `portal.fonte`
  (o app foi renomeado em [[58]]); manter compat com os links de associado existentes.
- Atualizar `fonte-api.postman_collection.json` (endpoint de reenvio).

### Frontend `portal.fonte` — página de pagamento

- Feature `events` (vertical slice, padrão do app), reusando o fluxo de pagamento de associado de
  [[40]]/[[41]] como referência:
  - `pages/EventPaymentPage.tsx` (rota `/pagamento/:token`) — orquestra; sem fetch direto.
  - `features/events/hooks/useEventPayment.ts` — `useEventPaymentByToken(token)`,
    `usePayEvent(token)`. Query keys em `lib/queryKeys.ts`.
  - Estados: `PENDING` (mostra escolha de método), `PAID` (confirmação), `FAILED` (erro + tentar de
    novo). Loading/Error compartilhados; erros via `getErrorMessage`.
  - **Cartão**: reusar a integração `tokenizecard.js` ([[41]], `VITE_PAGARME_PUBLIC_KEY`); PAN não
    transita pelo nosso app; envia `{ method:'credit_card', cardToken }`.
  - **PIX**: envia `{ method:'pix' }`, exibe QR code + botão copia-e-cola; faz polling/refetch do
    status até `PAID` (webhook confirma no backend).
  - Valor read-only (preço + gross-up, snapshot de [[69]]).
- Confirmação pós-inscrição (`EventRegistrationForm`, [[58]]/[[68]]): para evento pago, ao sucesso
  mostrar o link `/pagamento/:token` na tela (copiar) e avisar que o link também foi enviado por
  email/WhatsApp.
- Mobile-first, padrão visual do portal.

### Tipos / api-client

- `@fonte/api-client`: recurso `eventPayments` (público) já criado em [[69]] — consumir aqui.
  Endpoint admin de reenvio no recurso `events`. `pnpm build:types`/`build:api-client` se mudar
  contrato.

## Validação

- `pnpm test:api` — unit: MailService best-effort (sem credencial → `{sent:false}`, não lança);
  disparo de email+WhatsApp ao inscrever em evento pago (clients mockados; chamados com o link
  correto); evento grátis não dispara; reenvio admin chama os dois canais. Associados seguem
  verdes (WhatsApp não quebrou).
- `pnpm test:api:e2e` — reenvio do link (ADMIN ok / não-ADMIN 403); inscrição paga dispara envio
  (mock). 
- `pnpm test:portal` — unit `EventPaymentPage`/hook: renderiza por status (PENDING/PAID/FAILED);
  PIX mostra QR; cartão envia cardToken. e2e Playwright: abrir `/pagamento/:token`, pagar (mock dos
  endpoints), ver confirmação.
- `pnpm --filter portal.fonte build` verde. Regressão: fluxo de pagamento de associado intacto
  (rodar `pnpm test:portal` do fluxo `/p/:token` existente — não pode quebrar com a generalização
  do WhatsApp client / rename da env de URL).
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Cobrir `MailService` (com e sem credencial), disparo nos 2
  canais, reenvio admin, e a página por status (PENDING/PAID/FAILED, PIX QR, cartão). Rodar
  `pnpm test:api:cov` + runner de cobertura do `portal.fonte`; **não reduzir** a cobertura dos
  módulos tocados. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Reembolso/estorno; conciliação financeira/relatórios.
- Cobrança recorrente de evento (decidido avulso, [[69]]).
- Lembretes agendados de pagamento de evento (associados têm scheduler [[39]]; p/ evento fica
  fora — só envio na inscrição + reenvio manual).
- Renomear projeto/DSN do Sentry (TODO herdado de [[58]]).
- Telas de eventos no `ops.fonte`/`app.fonte`.
