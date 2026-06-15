# Plan: Associados — backend (módulo `associate`) + CRUD no adm.fonte

> Filha do epic [[36]]. Base para [[38]], [[39]], [[40]]. Implementar primeiro.

## Context

Primeira fatia do epic [[36]]: o **cadastro manual de associados** pelo admin, com persistência e
tela de gestão no `adm.fonte`. Sem pagamento/WhatsApp ainda — só o domínio e a CRUD. As entidades
de assinatura/cobrança são criadas aqui (schema), mas só ganham comportamento na [[38]].

### Decisões travadas (do epic)

- Domínio **novo e independente** de `resident`/`resident-receivable`. Módulo NestJS próprio.
- Campos do associado: `name`, `whatsapp` (E.164), `email?`, `contribution_amount`, `due_day` (1–31).
- Permissão: **ADMIN** gerencia associados.
- `status` derivado da assinatura (`PENDING` ao cadastrar; muda na [[38]]/[[39]]).

## Desenho

### Backend — `services/api/src/modules/associate/`

- **Migration** criando as 4 tabelas do epic ([[36]]): `associates`, `associate_subscriptions`,
  `associate_charges`, `associate_charge_notifications`. snake_case, UUID v4, `deleted_at`.
  (As 3 últimas entram aqui no schema; comportamento de pagamento na [[38]]/[[39]].)
- **Entities** TypeORM correspondentes.
- **DTOs** + `class-validator`:
  - `CreateAssociateDto`: `name` (string, min 1), `whatsapp` (E.164 — validar formato),
    `email?` (IsEmail opcional), `contributionAmount` (number > 0), `dueDay` (int 1–31).
  - `UpdateAssociateDto` (partial).
- **Endpoints** (ADMIN, guard JWT existente):
  - `POST   /associates` — cria (gera `payment_token` uuid, `status=PENDING`).
  - `GET    /associates` — lista (com status da assinatura + última cobrança, p/ a tela).
  - `GET    /associates/:id` — detalhe (inclui assinatura + histórico de cobranças).
  - `PATCH  /associates/:id` — edita cadastro.
  - `DELETE /associates/:id` — soft delete.
- **Service** com a lógica; controller fino só valida/roteia (regra do CLAUDE.md).
- Atualizar `fonte-api.postman_collection.json` com os novos endpoints.

### Tipos compartilhados — `packages/types`

- `Associate`, `AssociateStatus`, `AssociateSubscription`, `AssociateCharge`,
  `SubscriptionStatus`, `ChargeStatus`. Reexportar no `index.ts`. Rodar `pnpm build:types`.

### api-client — `packages/api-client`

- Recurso `associates` com `list`, `getById`, `create`, `update`, `remove`. Não duplicar em apps.

### Frontend adm.fonte — feature `associates`

Seguir vertical slice + MVVM (skill `fonte-frontend`):
- `features/associates/hooks/useAssociates.ts` — `useAssociates`, `useAssociateById`,
  `useCreateAssociate`, `useUpdateAssociate`, `useDeleteAssociate`. Query keys em
  `lib/queryKeys.ts` (`queryKeys.associates.*`) — nunca string literal.
- `pages/AssociatesPage.tsx` — orquestra lista (sem fetch direto); usa `LoadingState`/`EmptyState`/
  `ErrorState`.
- `components/AssociateRow.tsx` (item da tabela), `AssociateForm.tsx` (react-hook-form + zod),
  `CreateAssociateDialog.tsx` / `EditAssociateDialog.tsx` (autossuficientes), badge de `status`.
- Rota + item de menu em "Faturamento → Associados" (ADMIN).
- Erros via `getErrorMessage`.

## Validação

- `pnpm test:api` — unit do `associate.service` (create gera token/PENDING; validações de DTO;
  soft delete). Verde.
- `pnpm test:api:e2e` — e2e CRUD `/associates` (ADMIN autoriza; não-ADMIN 403). Verde.
- `pnpm build:types` e `pnpm build:api-client` sem erro.
- `pnpm test:adm` — spec da tela de associados (criar/editar/listar) se houver tempo; mínimo
  garantir build do adm.
- Postman atualizado.

## Fora de escopo (fica nas outras filhas)

- Qualquer chamada ao AbacatePay, cálculo de taxa, webhook → [[38]].
- Página pública de pagamento → [[40]].
- WhatsApp e scheduler 9h → [[39]].
- Mudança de `status` por evento de pagamento (aqui só `PENDING` inicial + edição manual).
