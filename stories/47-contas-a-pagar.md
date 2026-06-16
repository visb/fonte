# Plan: Contas a Pagar (accounts payable) no adm.fonte

## Context

Hoje o adm tem só o lado de **receita** (submenu *Faturamento*: Filhos, Pizza, Pão,
Associados). Não existe nenhum lugar para registrar e acompanhar **despesas / contas a
pagar** da comunidade. Não há módulo backend de despesa (`grep` por
payable/despesa/expense vazio) — é greenfield full-stack.

Decisões travadas com o usuário (`/issue`):

- **Escopo = MVP cadastro + baixa.** CRUD de conta a pagar (descrição, valor, vencimento,
  categoria, fornecedor texto livre), listagem com filtros, marcar como paga, excluir.
  **Sem** recorrência, **sem** anexo de comprovante, **sem** CRUD de categorias nesta
  versão. (categorias = enum fixo por enquanto.)
- **Navegação = novo grupo "Financeiro"** na sidebar, separado de *Faturamento* (que é
  receita). Primeiro item do grupo: *Contas a Pagar* (`/financeiro/contas-a-pagar`).
  Submenu colapsável no mesmo padrão de `FaturamentoSubmenu`.
- **Acesso = só ADMIN** (financeiro sensível, igual a Associados/Backup). COORDINATOR e
  SERVANT não veem.

Trade-offs aceitos: status "vencida" **não é persistido** — é derivado em runtime
(`dueDate < hoje && status === OPEN`). Banco guarda só `OPEN`/`PAID`. Categoria como enum
evita uma tabela extra agora; vira CRUD próprio se o usuário pedir depois.

## Desenho

### Backend — novo módulo `payable` (`services/api/src/modules/payable/`)

Espelha o padrão de `street-sale` (entity + controller fino + service + DTOs + module + spec).

**Entity `payables`** (tabela `payables`, snake_case, UUID, soft delete):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `description` | varchar | obrigatório |
| `amount` | integer | **centavos** (padrão do repo, ex. street_sale) |
| `due_date` | date | vencimento |
| `category` | enum `PayableCategory` | UTILITIES, SUPPLIES, MAINTENANCE, PAYROLL, TAXES, OTHER |
| `supplier` | varchar nullable | fornecedor texto livre |
| `status` | enum `PayableStatus` | OPEN \| PAID (default OPEN) |
| `paid_at` | date nullable | preenchido na baixa |
| `notes` | text nullable | observação opcional |
| `created_by` | uuid nullable | FK staff/user que registrou |
| `created_at` / `updated_at` | timestamps | |
| `deleted_at` | timestamp nullable | soft delete |

**Enums** em `packages/types/src/index.ts`: `PayableStatus`, `PayableCategory` (+ exportar
o tipo `Payable` se houver tipos compartilhados de entidade — seguir o que street-sale faz).

**Endpoints** (`@Controller('payables')`, todos `@Roles(Role.ADMIN)`):

- `POST /payables` — cria (CreatePayableDto)
- `GET /payables?status=&category=&from=&to=` — lista com filtros (status, categoria, período de vencimento)
- `GET /payables/summary?from=&to=` — totais a pagar / pagos / vencidos (cards)
- `GET /payables/:id` — detalhe
- `PATCH /payables/:id` — edita (UpdatePayableDto, partial)
- `PATCH /payables/:id/pay` — baixa: seta status=PAID, paid_at (body opcional `{ paidAt }`)
- `DELETE /payables/:id` — soft delete

DTOs com `class-validator` (`@IsString`, `@IsInt @Min(0)` para amount, `@IsDateString`,
`@IsEnum`). Regras de negócio (transição OPEN→PAID, cálculo de summary) no **service**, não
no controller.

**Migration** `services/api/src/database/migrations/1782800000000-Payables.ts` — cria a
tabela + enums. Nunca editar migrations existentes.

### api-client — `packages/api-client/src/modules/payables.ts`

Métodos `list(params)`, `getById(id)`, `summary(params)`, `create(dto)`, `update(id, dto)`,
`pay(id, body)`, `remove(id)`. Registrar no `index.ts` igual aos demais módulos.

### Frontend — feature `apps/adm.fonte/src/features/payables/`

```
payables/
  hooks/usePayables.ts        ← usePayables(filters), usePayableSummary(filters),
                                 useCreatePayable, useUpdatePayable, usePayPayable, useDeletePayable
  lib/payableSchema.ts        ← zod (react-hook-form)
  constants.ts                ← labels de categoria/status, variantes de badge
  components/
    PayablesPage…             (page orquestra; sem fetch direto)
    PayablesSummaryCards.tsx
    PayablesFilters.tsx
    PayableRow.tsx            ← item da tabela extraído
    PayableTable.tsx
    PayableDialog.tsx         ← criar/editar (autossuficiente)
    PayPayableDialog.tsx      ← baixa
  pages/PayablesPage.tsx
```

- Query keys novas em `apps/adm.fonte/src/lib/queryKeys.ts` (`payables.all`, `.list(filters)`,
  `.summary(filters)`, `.detail(id)`). **Nunca** string literal inline.
- Estados via `LoadingState` / `EmptyState` / `ErrorState` compartilhados.
- Erros via `getErrorMessage`. Formulário com `react-hook-form` + `zod`.
- Valor exibido/editado em reais, convertido para centavos no submit (seguir helper de
  money já usado no billing, se existir).

### Navegação — `AppLayout.tsx` + `App.tsx`

- Novo `FinanceiroSubmenu` (padrão do `FaturamentoSubmenu`), ícone `Wallet`/`Landmark` do
  lucide, visível só para `isAdmin`. Item: *Contas a Pagar* → `/financeiro/contas-a-pagar`.
- Rota em `App.tsx` sob `ProtectedRoute allowedRoles={[Role.ADMIN]}`.

### Postman

Atualizar `fonte-api.postman_collection.json` com os 7 endpoints novos (pasta "Payables").

## Validação

- `pnpm build:types` (novos enums).
- `pnpm build:api-client`.
- Backend: `pnpm test:api` verde, incluindo `payable.service.spec.ts` novo (create, list
  com filtro, summary, pay transição OPEN→PAID, soft delete).
- `pnpm dev:api` sobe sem erro de migration; rodar a migration.
- adm: compila (`pnpm --filter adm.fonte build` ou typecheck). Smoke manual: criar conta,
  filtrar, marcar paga, excluir, checar cards de summary. Login ADMIN não-admin não vê o menu.

## Fora de escopo

- Recorrência / parcelas automáticas.
- Anexo de comprovante (storage/bucket).
- CRUD de categorias (enum fixo nesta versão).
- Aprovação/workflow de pagamento, integração com gateway, conciliação bancária.
- Relatórios avançados / exportação.
- Acesso de COORDINATOR.
