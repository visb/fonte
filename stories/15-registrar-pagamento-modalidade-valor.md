# Plan: Registrar pagamento com modalidade e valor pago customizáveis

## Context

Na aba **Contribuições** (`ContributionsTab`) da página de detalhes do filho, o `RegisterPaymentDialog` registra pagamento de uma parcela (`ResidentReceivable`). Hoje só captura: data, forma de pagamento (`PaymentMethod`) e comprovante. O **valor** é fixo (`receivable.amount`, congelado na geração) e a **modalidade** (`familyInvestment`) também é fixa.

Requisito: ao registrar pagamento, permitir informar **modalidade** e **valor pago**, mesmo que o filho tenha valor/modalidade pré-definidos — a contribuição pode ser fora desses parâmetros.

> Distinção importante: `paymentMethod` (PIX/dinheiro/...) já existe e é "forma de pagamento". "Modalidade" aqui = `familyInvestment` (R$500+cestas / R$700 / Social / Negociado) — ver story `09-contribuicao-acolhido.md`. "Valor pago" = quantia efetivamente recebida, que pode divergir de `receivable.amount`.

---

## Backend

### 1. Entity — `resident-receivable.entity.ts`

Adicionar colunas para o valor efetivamente pago e a modalidade efetiva (sem sobrescrever o snapshot `amount`/`familyInvestment` da geração):

```typescript
@Column({ name: 'paid_amount', type: 'integer', nullable: true })
paidAmount: number | null;

@Column({ name: 'paid_family_investment', type: 'enum', enum: FamilyInvestment, enumName: 'family_investment_enum', nullable: true })
paidFamilyInvestment: FamilyInvestment | null;
```

### 2. Migration

Nova migration `services/api/src/database/migrations/<ts>-ReceivablePaidAmountModality.ts`:

```sql
-- up
ALTER TABLE resident_receivables
  ADD COLUMN paid_amount integer NULL,
  ADD COLUMN paid_family_investment family_investment_enum NULL;
-- down
ALTER TABLE resident_receivables
  DROP COLUMN paid_amount,
  DROP COLUMN paid_family_investment;
```

### 3. DTO — `register-payment.dto.ts`

```typescript
@IsOptional()
@IsInt()
@Min(0)
paidAmount?: number;

@IsOptional()
@IsEnum(FamilyInvestment)
paidFamilyInvestment?: FamilyInvestment;
```

### 4. Service — `registerPayment` em `resident-receivable.service.ts`

Persistir os novos campos; default = snapshot quando não informados:

```typescript
paidAmount: dto.paidAmount ?? existing.amount,
paidFamilyInvestment: dto.paidFamilyInvestment ?? existing.familyInvestment,
```

Atualizar `ResidentReceivableView` (campos `paidAmount`, `paidFamilyInvestment`) no map de saída.

### 5. Postman

Atualizar `fonte-api.postman_collection.json` no endpoint de registrar pagamento (novo body).

---

## api-client

`packages/api-client/src/types.ts` — adicionar `paidAmount` / `paidFamilyInvestment` em `ResidentReceivable` e no input do `registerPayment`.

---

## Frontend

### 6. Hook — `useResidentReceivables.ts`

`useRegisterReceivablePayment`: incluir `paidAmount` e `paidFamilyInvestment` no `FormData`/payload enviado.

### 7. Dialog — `RegisterPaymentDialog.tsx`

Schema:

```typescript
const schema = z.object({
  paidAt: z.string().min(1, 'Informe a data'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidFamilyInvestment: z.nativeEnum(FamilyInvestment),
  paidAmount: z.coerce.number().int().min(0, 'Valor inválido'),
  notes: z.string().optional(),
});
```

`defaultValues`: pré-preencher com o esperado da parcela —
`paidFamilyInvestment: receivable?.familyInvestment`, `paidAmount: receivable?.amount`. Reaplicar via `reset` quando `receivable` mudar (o dialog hoje não reseta ao trocar de parcela — adicionar `useEffect`).

Campos novos no form (após "Forma de pagamento"):

```tsx
<FormField label="Modalidade" error={errors.paidFamilyInvestment?.message}>
  <Select {...register('paidFamilyInvestment')}>
    {Object.values(FamilyInvestment).map((m) => (
      <option key={m} value={m}>{FAMILY_INVESTMENT_LABELS[m]}</option>
    ))}
  </Select>
</FormField>

<FormField label="Valor pago (R$)" error={errors.paidAmount?.message}>
  <Input type="number" min={0} {...register('paidAmount', { valueAsNumber: true })} />
</FormField>
```

(`FAMILY_INVESTMENT_LABELS` de `features/residents/constants.ts` — depende da story 09.)

### 8. Exibição — `ReceivableRow.tsx`

Quando `paidAmount`/`paidFamilyInvestment` divergirem do snapshot, exibir o valor efetivamente pago (e badge da modalidade) ao invés de só `amount`.

### 9. Relatório de contribuições — somar valor pago real (decisão do usuário)

O relatório (`Valor Arrecadado` / `totalCollectedAmount`) deve refletir o **valor efetivamente pago**, não o do plano. Hoje em `services/api/src/modules/resident/resident.service.ts` (~L590-629):

- Query: adicionar `rcv.paid_amount AS "collectedAmount"` ao `SELECT`.
- Agregação: trocar
  ```ts
  const totalCollectedAmount = items.filter((i) => i.paid)
    .reduce((sum, i) => sum + (i.expectedAmount ?? 0), 0);
  ```
  por somar o valor pago real com fallback ao snapshot:
  ```ts
  const totalCollectedAmount = items.filter((i) => i.paid)
    .reduce((sum, i) => sum + (i.collectedAmount ?? i.expectedAmount ?? 0), 0);
  ```

`totalExpectedAmount` continua somando `expectedAmount` (plano). Conferir se há outras agregações/relatórios que somam `amount` de parcelas pagas e ajustar para `paid_amount` quando existir.

---

## Dependências

- Story `09-contribuicao-acolhido.md` — **já implementada** no código (`FamilyInvestment` enum + `familyInvestmentAmount` existem em `packages/types` e backend). Esta story só **acrescenta** `paidAmount`/`paidFamilyInvestment` na parcela; reusa o enum e `FAMILY_INVESTMENT_LABELS` existentes.

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com testes automatizados verdes em backend e frontend.

| Arquivo | Caso |
| --- | --- |
| `services/api/src/modules/resident-receivable/resident-receivable.service.spec.ts` | `registerPayment` com `paidAmount`/`paidFamilyInvestment` divergentes → persiste os valores informados; sem eles → default = snapshot (`amount`/`familyInvestment`) |
| `services/api/test/resident-receivable.e2e-spec.ts` | `PATCH` registrar pagamento com modalidade/valor fora do padrão do plano → 200 e valores persistidos no `GET` subsequente |
| `services/api/src/modules/resident/resident.service.spec.ts` (ou e2e do relatório) | Relatório: `totalCollectedAmount` soma `paid_amount` real quando presente (fallback p/ `amount`); parcela paga com valor divergente reflete no total arrecadado |
| `apps/adm.fonte/e2e/residents.spec.ts` (ou `billing.spec.ts`) | Abrir `RegisterPaymentDialog`: modalidade/valor pré-preenchidos com o plano; alterar para valor fora do padrão e salvar; `ReceivableRow` reflete o valor pago |

Rodar: `pnpm test:api`, `pnpm test:api:e2e`, `pnpm test:adm`. Verdes.

## Verificação manual

1. `pnpm build:types` / `pnpm build:api-client` — compilam.
2. `pnpm dev:api` — migration roda.
3. `PATCH` registrar pagamento com `paidAmount`/`paidFamilyInvestment` divergentes → persistidos.
4. `pnpm dev:adm` — dialog mostra modalidade + valor pré-preenchidos com o plano, editáveis; salvar com valor fora do padrão funciona; `ReceivableRow` reflete o valor pago.
