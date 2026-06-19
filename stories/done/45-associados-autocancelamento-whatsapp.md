# Plan: Associados — link de autocancelamento da assinatura no lembrete WhatsApp

> Pertence ao epic [[36]]. Estende o scheduler/WhatsApp de [[39]] e o cancelamento de assinatura
> de [[41]] (hoje só no admin). Não mexe em gateway, cobrança recorrente ([[38]]) nem no overview
> ([[44]]).

## Context

Hoje o associado não tem como cancelar a própria assinatura — só o ADMIN cancela por ele
([[41]]). Quem está inadimplente e não quer mais contribuir continua recebendo lembrete de
cobrança via WhatsApp indefinidamente (job diário de [[39]], teto de 1 envio/5 dias).

Queremos oferecer **saída ao associado**: a partir do **3º lembrete consecutivo** de vencimento,
o WhatsApp inclui um link para **cancelar a assinatura**. Mostrar o link cedo demais incentivaria
cancelamento; por isso só após insistência (3º+).

### Decisões do usuário (travadas — 2026-06-16)

- **Gatilho**: a partir do **3º lembrete consecutivo** (3º, 4º, 5º... incluem o link de cancelar).
- **Contagem reseta no último pagamento**: conta lembretes enviados **desde a última cobrança
  `PAID`** (ou desde o cadastro, se nunca pagou). Pagou e voltou a atrasar → zera o streak.
- **UX = página de confirmação**: o link abre `/cancelar/:token` no app `associados`, mostra o nome
  do associado + botão "Confirmar cancelamento". Sem cancelamento por 1 clique (evita acidente).
- **Token = `payment_token` existente**: o cancelamento público resolve o associado pelo mesmo
  `payment_token` da página de pagamento. Sem novo token.
- Permanece tudo best-effort no WhatsApp (sem credencial Meta → loga e segue).

## Desenho

### Backend

**1. Contagem do streak (scheduler).**
- No `AssociateChargeScheduler`, antes de montar o envio, calcular `reminderStreak` do associado =
  nº de registros em `associate_charge_notifications` com `sent_at` **após** o `paid_at` da
  cobrança `PAID` mais recente (se não houver PAID, desde sempre).
- Injetar `Repository<AssociateCharge>` no scheduler p/ achar o último `paid_at`.
- O envio atual será o `(reminderStreak + 1)`-ésimo. Quando `reminderStreak >= 2` (ou seja, já
  houve 2 envios no streak; este é o 3º+), usar o template **com** link de cancelamento.

**2. WhatsApp client — segundo botão de URL.**
- `SendTemplateInput` ganha `cancelUrlButtonParam?: string` (opcional).
- `MetaWhatsAppClient`: quando presente, adiciona um 2º `button`/`sub_type: url` (`index: '1'`) com
  o link `buildCancelLink(token)` = `<APP_ASSOCIADOS_URL>/cancelar/:token`.
- Novo template Meta (config): `META_WA_TEMPLATE_NAME_CANCELABLE` (default
  `cobranca_associado_cancelavel`), com 2 botões de URL (pagar + cancelar). O scheduler escolhe
  esse nome quando o streak atinge o gatilho; senão usa o `META_WA_TEMPLATE_NAME` atual.
- `.env.example`: documentar `META_WA_TEMPLATE_NAME_CANCELABLE`.

**3. Cancelamento público (sem JWT).**
- `AssociatePaymentService` (ou service do módulo) ganha `cancelByToken(token)`:
  resolve associado por `payment_token`, reusa a lógica de cancelamento de [[41]]
  (cancela assinatura no gateway via `DELETE /subscriptions/{id}` + marca
  `subscription.status=CANCELED`, `associate.status=CANCELED`). Idempotente: já cancelado → ok.
- `PublicAssociateController`:
  - `GET :token/cancel-view` → nome do associado + se há assinatura ativa (para a tela).
  - `POST :token/cancel` (throttle estrito, ex. 5/min) → executa o cancelamento.
- Atualizar `fonte-api.postman_collection.json` (endpoints novos + variação de template).

### Frontend — app `associados`

- Nova rota pública `/cancelar/:token`:
  - Busca `cancel-view` (hook em `features/.../hooks`, query key dedicada).
  - Mostra nome + texto explicativo + botão "Confirmar cancelamento" (mutation → `POST cancel`).
  - Sucesso → tela "Assinatura cancelada"; já cancelada → mesma tela (idempotente).
  - Erros via `getErrorMessage`; estados de loading/erro com os componentes do app.
- Seguir padrões do app (a página de pagamento `/p/:token` como referência de estrutura).

## Validação

- `pnpm build:api` compila; `pnpm test:api` verde.
- Specs novos/atualizados em `associate-charge.scheduler.spec.ts`:
  - streak < 2 → template padrão (sem cancelar).
  - streak >= 2 → template cancelável + `cancelUrlButtonParam` setado.
  - reset: pagamento `PAID` recente zera o streak.
- Spec do cancelamento público (service): cancela por token, idempotência, token inválido → 404.
- Mock do `WhatsAppClient` confere o template escolhido e os parâmetros dos 2 botões.
- Frontend: `tsc -b`/`build:associados` compila; smoke manual da página `/cancelar/:token`.

## Fora de escopo

- Mudança de schema/migration (usa colunas e tabelas existentes).
- Reenvio/observabilidade do template no painel Meta (config externa).
- Login de associado (cancelamento segue por token público, sem conta).
- Cancelar via app adm muda — já existe ([[41]]), permanece igual.
- Texto/aprovação do template na Meta (operacional; o código só referencia o nome via env).
