# Plan: Campo "Investimento Familiar" — Enum + Valor + Visibilidade na Listagem

## Context

`familyInvestment` é um campo varchar livre atualmente exibido como `<Textarea>`. Representa a **modalidade de contribuição mensal** da família. Além das 3 modalidades fixas, algumas famílias negociam um valor personalizado. O campo `SOCIAL` = R$0.

Futuramente: relatório que soma total de contribuições → precisamos armazenar o valor monetário.

### Objetivos

1. Converter para enum estruturado com 4 modalidades (incluindo `NEGOTIATED`)
2. Armazenar o valor monetário em campo separado `familyInvestmentAmount`
3. Trocar Textarea por Select + input condicional nos formulários
4. Exibir badge na listagem (`ResidentCard`)

> Rastreamento mês-a-mês é feature separada (Story 09, via `FollowUpType.MONTHLY_CONTRIBUTION`).

---

## Enum e Valores Canônicos

| Enum          | Label           | Valor (R$)            |
| ------------- | --------------- | --------------------- |
| `BASKET_500`  | R$ 500 + cestas | 500                   |
| `PAYMENT_700` | R$ 700          | 700                   |
| `SOCIAL`      | Social          | 0                     |
| `NEGOTIATED`  | Negociado       | definido pelo usuário |

---

## Arquivos Críticos

| Arquivo                                                                     | Mudança                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/types/src/index.ts`                                               | Novo enum `FamilyInvestment`                                      |
| `packages/api-client/src/types.ts`                                          | Atualizar tipos com `familyInvestment` + `familyInvestmentAmount` |
| `services/api/src/modules/resident/resident.entity.ts`                      | Coluna enum + coluna `family_investment_amount`                   |
| `services/api/src/modules/resident/admission.entity.ts`                     | idem                                                              |
| `services/api/src/modules/resident/dto/create-resident.dto.ts`              | `@IsEnum` + `@IsInt` + validação condicional                      |
| `services/api/src/modules/resident/dto/update-resident.dto.ts`              | idem                                                              |
| `services/api/src/modules/resident/dto/readmit-resident.dto.ts`             | idem                                                              |
| `services/api/src/database/migrations/<ts>-FamilyInvestmentEnum.ts`         | Nova migration                                                    |
| `apps/adm.fonte/src/features/residents/constants.ts`                        | Labels, variants e valores canônicos                              |
| `apps/adm.fonte/src/features/residents/lib/residentSchema.ts`               | Enum + amount + validação condicional                             |
| `apps/adm.fonte/src/features/residents/components/ResidentFormSections.tsx` | Select + input condicional                                        |
| `apps/adm.fonte/src/features/residents/components/ReadmissionForm.tsx`      | idem                                                              |
| `apps/adm.fonte/src/features/residents/components/tabs/OverviewTab.tsx`     | Label + valor formatado                                           |
| `apps/adm.fonte/src/features/residents/components/ResidentCard.tsx`         | Badge de investimento                                             |

---

## Implementação

### 1. Enum em `packages/types/src/index.ts`

```typescript
export enum FamilyInvestment {
  BASKET_500 = "BASKET_500",
  PAYMENT_700 = "PAYMENT_700",
  SOCIAL = "SOCIAL",
  NEGOTIATED = "NEGOTIATED",
}
```

### 2. Backend — Entities

Em `resident.entity.ts` e `admission.entity.ts`:

```typescript
@Column({ name: 'family_investment', type: 'enum', enum: FamilyInvestment, nullable: true })
familyInvestment: FamilyInvestment | null;

@Column({ name: 'family_investment_amount', type: 'integer', nullable: true })
familyInvestmentAmount: number | null;
```

`familyInvestmentAmount` guarda:

- Valor canônico (500, 700, 0) para as modalidades fixas — preenchido pelo service
- Valor negociado — preenchido pelo usuário quando `NEGOTIATED`

### 3. Backend — Service

Em `resident.service.ts`, ao salvar/criar, derivar o amount automático para modalidades fixas:

```typescript
const CANONICAL_AMOUNTS: Partial<Record<FamilyInvestment, number>> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
};

if (
  dto.familyInvestment &&
  dto.familyInvestment !== FamilyInvestment.NEGOTIATED
) {
  dto.familyInvestmentAmount = CANONICAL_AMOUNTS[dto.familyInvestment];
}
```

Adicionar `familyInvestmentAmount` ao set `ADMISSION_FIELDS`.

### 4. Backend — DTOs

```typescript
@IsOptional()
@IsEnum(FamilyInvestment)
familyInvestment?: FamilyInvestment | null;

@IsOptional()
@IsInt()
@Min(0)
familyInvestmentAmount?: number | null;
```

Validação cruzada opcional: se `familyInvestment === NEGOTIATED`, `familyInvestmentAmount` deve estar presente. Pode usar `@ValidateIf`.

### 5. Migration

```sql
-- up
UPDATE residents SET family_investment = NULL, family_investment_amount = NULL
  WHERE family_investment IS NOT NULL;
UPDATE admissions SET family_investment = NULL, family_investment_amount = NULL
  WHERE family_investment IS NOT NULL;

CREATE TYPE family_investment_enum AS ENUM
  ('BASKET_500', 'PAYMENT_700', 'SOCIAL', 'NEGOTIATED');

ALTER TABLE residents
  ALTER COLUMN family_investment TYPE family_investment_enum
    USING family_investment::family_investment_enum,
  ADD COLUMN family_investment_amount integer NULL;

ALTER TABLE admissions
  ALTER COLUMN family_investment TYPE family_investment_enum
    USING family_investment::family_investment_enum,
  ADD COLUMN family_investment_amount integer NULL;

-- down
ALTER TABLE residents
  ALTER COLUMN family_investment TYPE varchar
    USING family_investment::varchar,
  DROP COLUMN family_investment_amount;
ALTER TABLE admissions
  ALTER COLUMN family_investment TYPE varchar
    USING family_investment::varchar,
  DROP COLUMN family_investment_amount;
DROP TYPE family_investment_enum;
```

### 6. `packages/api-client/src/types.ts`

Adicionar `FamilyInvestment` ao export. Nos interfaces `Resident`, `Admission`, `CreateResidentInput`, `ReadmitResidentInput`:

```typescript
familyInvestment: FamilyInvestment | null;
familyInvestmentAmount: number | null;
```

### 7. Frontend — `constants.ts`

```typescript
import { FamilyInvestment } from "@fonte/types";

export const FAMILY_INVESTMENT_LABELS: Record<FamilyInvestment, string> = {
  [FamilyInvestment.BASKET_500]: "R$ 500 + cestas",
  [FamilyInvestment.PAYMENT_700]: "R$ 700",
  [FamilyInvestment.SOCIAL]: "Social",
  [FamilyInvestment.NEGOTIATED]: "Negociado",
};

export const FAMILY_INVESTMENT_VARIANT: Record<FamilyInvestment, BadgeVariant> =
  {
    [FamilyInvestment.BASKET_500]: "info",
    [FamilyInvestment.PAYMENT_700]: "success",
    [FamilyInvestment.SOCIAL]: "secondary",
    [FamilyInvestment.NEGOTIATED]: "warning",
  };

/** Valor canônico para modalidades fixas; NEGOTIATED usa familyInvestmentAmount */
export const FAMILY_INVESTMENT_CANONICAL: Partial<
  Record<FamilyInvestment, number>
> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
};
```

### 8. Frontend — Schema (`residentSchema.ts`)

```typescript
familyInvestment: z.nativeEnum(FamilyInvestment).optional().nullable(),
familyInvestmentAmount: z.coerce.number().int().min(0).optional().nullable(),
```

Validação condicional com `.superRefine` ou `.refine`:

- Se `familyInvestment === NEGOTIATED`, `familyInvestmentAmount` é obrigatório.

### 9. Frontend — Formulários

Em `ResidentFormSections.tsx` e `ReadmissionForm.tsx`:

```tsx
<FormField label="Investimento familiar">
  <Select
    onValueChange={(v) => setValue("familyInvestment", v as FamilyInvestment)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecione a modalidade" />
    </SelectTrigger>
    <SelectContent>
      {Object.values(FamilyInvestment).map((v) => (
        <SelectItem key={v} value={v}>
          {FAMILY_INVESTMENT_LABELS[v]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</FormField>;

{
  watch("familyInvestment") === FamilyInvestment.NEGOTIATED && (
    <FormField label="Valor negociado (R$)">
      <Input
        type="number"
        min={0}
        {...register("familyInvestmentAmount", { valueAsNumber: true })}
      />
    </FormField>
  );
}
```

### 10. Frontend — `OverviewTab.tsx`

```tsx
<SectionTitle>Família</SectionTitle>
<InfoGrid>
  <InfoRow
    label="Investimento familiar"
    value={resident.familyInvestment
      ? `${FAMILY_INVESTMENT_LABELS[resident.familyInvestment]}${
          resident.familyInvestment === FamilyInvestment.NEGOTIATED && resident.familyInvestmentAmount != null
            ? ` — R$ ${resident.familyInvestmentAmount}`
            : ''
        }`
      : '—'}
    full
  />
</InfoGrid>
```

### 11. Frontend — `ResidentCard.tsx`

Adicionar badge de investimento após o badge de status:

```tsx
{
  resident.familyInvestment && (
    <Badge variant={FAMILY_INVESTMENT_VARIANT[resident.familyInvestment]}>
      {FAMILY_INVESTMENT_LABELS[resident.familyInvestment]}
      {resident.familyInvestment === FamilyInvestment.NEGOTIATED &&
      resident.familyInvestmentAmount != null
        ? ` R$ ${resident.familyInvestmentAmount}`
        : ""}
    </Badge>
  );
}
```

---

## Verificação

1. `pnpm build:types` — enum compila sem erro
2. `pnpm build:api-client` — tipos atualizados sem erro
3. `pnpm dev:api` — migration roda, API sobe
4. `PATCH /residents/:id` com `{ familyInvestment: 'BASKET_500' }` → `familyInvestmentAmount` auto-preenchido como 500
5. `PATCH /residents/:id` com `{ familyInvestment: 'NEGOTIATED', familyInvestmentAmount: 350 }` → salva 350
6. `pnpm dev:adm` — Select exibe 4 opções; NEGOTIATED exibe input de valor; ResidentCard exibe badge; OverviewTab exibe label
7. `pnpm test:api` — unit tests passam
