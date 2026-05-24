# Plano: Módulo Faturamento

## Contexto

Necessidade de um módulo de faturamento com relatório mensal de contribuições dos filhos (familiares) e páginas placeholder para outros tipos (pizza, pão, associados). "Faturamento" é item de topo na sidebar. Submenus: Filhos, Pizza, Pão, Associados — padrão expansível já estabelecido pelo SettingsSubmenu.

---

## Escopo

**5 camadas** precisam ser tocadas:

1. Backend — novo endpoint de relatório
2. `packages/types` — novos tipos compartilhados
3. `packages/api-client` — método HTTP
4. `apps/adm.fonte` — sidebar, rotas, feature folder
5. `fonte-api.postman_collection.json` — documentação viva

---

## 1 · Backend — `services/api/src/modules/resident/`

### Novo DTO

`dto/get-contributions-report.dto.ts`

```ts
export class GetContributionsReportDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month: string; // formato YYYY-MM

  @IsUUID()
  @IsOptional()
  houseId?: string;
}
```

### Novo método em `ResidentService`

```ts
async getContributionsReport(dto: GetContributionsReportDto): Promise<ContributionsReportResponse>
```

SQL (via QueryBuilder ou raw):

```sql
SELECT
  r.id            AS "residentId",
  r.name          AS "residentName",
  r.house_id      AS "houseId",
  h.name          AS "houseName",
  r.family_investment             AS "familyInvestment",
  r.family_investment_amount      AS "expectedAmount",
  (rfu.id IS NOT NULL)            AS paid,
  rfu.date                        AS "paidAt"
FROM residents r
INNER JOIN houses h ON h.id = r.house_id
LEFT JOIN resident_follow_ups rfu
  ON  rfu.resident_id = r.id
  AND rfu.type = 'MONTHLY_CONTRIBUTION'
  AND DATE_TRUNC('month', rfu.date) = DATE_TRUNC('month', :monthDate::date)
  AND rfu.deleted_at IS NULL
WHERE r.family_investment IS NOT NULL
  AND r.family_investment != 'SOCIAL'
  AND r.status IN ('PRE_ADMISSION','ACTIVE','DISCIPLINE','TEMP_LEAVE')
  AND r.deleted_at IS NULL
  [AND r.house_id = :houseId]   -- apenas se houseId fornecido
ORDER BY r.name ASC
```

Calcular no service (não no SQL): `totalResidents`, `totalPaid`, `totalPending`, `totalExpectedAmount`, `totalCollectedAmount`.

### Novo endpoint em `ResidentController`

```ts
@Get('contributions/report')
@Roles(Role.ADMIN, Role.COORDINATOR)
getContributionsReport(@Query() dto: GetContributionsReportDto) {
  return this.residentService.getContributionsReport(dto);
}
```

> **Atenção**: deve ficar ANTES de `@Get(':id')` no controller para não conflitar.

---

## 2 · Shared Types — `packages/types/src/index.ts`

Adicionar ao final da seção de Family Investment:

```ts
export interface ContributionReportItem {
  residentId: string;
  residentName: string;
  houseId: string;
  houseName: string;
  familyInvestment: FamilyInvestment;
  expectedAmount: number;
  paid: boolean;
  paidAt: string | null;
}

export interface ContributionsReportResponse {
  month: string;
  items: ContributionReportItem[];
  totalResidents: number;
  totalPaid: number;
  totalPending: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
}

export interface GetContributionsReportParams {
  month: string; // YYYY-MM
  houseId?: string;
}
```

---

## 3 · API Client — `packages/api-client/src/`

**`types.ts`** — importar e re-exportar os 3 novos tipos de `@fonte/types`.

**`modules/residents.ts`** — adicionar método:

```ts
contributionsReport: (params: GetContributionsReportParams) =>
  http.get<ContributionsReportResponse>('/residents/contributions/report', { params })
    .then((r) => r.data),
```

**`index.ts`** — exportar `ContributionReportItem`, `ContributionsReportResponse`, `GetContributionsReportParams`.

---

## 4 · Frontend — `apps/adm.fonte/src/`

### 4a · QueryKeys — `lib/queryKeys.ts`

```ts
billing: {
  filhos: {
    report: (params: { month: string; houseId?: string }) =>
      ['billing', 'filhos', 'report', params] as const,
  },
},
```

### 4b · Feature folder — `features/billing/`

```
features/billing/
  hooks/
    useContributions.ts
  components/
    ContributionSummaryCards.tsx
    ContributionReportTable.tsx
  pages/
    BillingPage.tsx
    FilhosPage.tsx         ← relatório de contribuições
    PizzaPage.tsx
    PaoPage.tsx
    AssociadosPage.tsx
```

**`hooks/useContributions.ts`**:

```ts
export function useContributionsReport(params: {
  month: string;
  houseId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.billing.filhos.report(params),
    queryFn: () => api.residents.contributionsReport(params),
  });
}
```

**`pages/BillingPage.tsx`**: mesma lógica do `SettingsPage` — redireciona `/billing` → `/billing/filhos`, renderiza `<Outlet />`.

**`pages/FilhosPage.tsx`**:

- `PageHeader` com título "Filhos — Contribuições"
- Seletor de mês (`<input type="month">` ou select) — default mês atual (`format(new Date(), 'yyyy-MM')`)
- Filtro por casa (select de houses existentes — `useHouses()`)
- `ContributionSummaryCards` — 5 cards: Total, Pagos, Pendentes, Valor Esperado, Valor Arrecadado
- `ContributionReportTable` — colunas: Nome, Casa, Tipo, Valor, Status (badge Pago/Pendente), Data
- `LoadingState` / `ErrorState` / `EmptyState`

**`components/ContributionSummaryCards.tsx`**: 5 cards em grid 2-3 cols usando `Card` do shadcn.

**`components/ContributionReportTable.tsx`**: `Table` do shadcn, badge verde/vermelho para status pago/pendente. Componente de item: `ContributionRow` (extraído, <150 linhas).

**Páginas placeholder** (`PizzaPage`, `PaoPage`, `AssociadosPage`): mesmo padrão — `PageHeader` com título + ícone + parágrafo "Em desenvolvimento".

### 4c · Sidebar — `components/layout/AppLayout.tsx`

Adicionar `FaturamentoSubmenu` (copiar padrão de `SettingsSubmenu`):

- Ícone: `Receipt` (lucide-react)
- `inBilling = location.pathname.startsWith('/billing')`
- Auto-abre quando em `/billing/*`
- Itens:
  - `/billing/filhos` → "Filhos"
  - `/billing/pizza` → "Pizza"
  - `/billing/pao` → "Pão"
  - `/billing/associados` → "Associados"

Adicionar ao `<nav>` logo após `Grupos de Apoio`, dentro do bloco `isAdminOrCoordinator`.

Importar `Receipt` no bloco de imports do lucide-react.

### 4d · Rotas — `App.tsx`

```tsx
// imports
import { BillingPage } from "@/features/billing/pages/BillingPage";
import { FilhosPage } from "@/features/billing/pages/FilhosPage";
import { PizzaPage } from "@/features/billing/pages/PizzaPage";
import { PaoPage } from "@/features/billing/pages/PaoPage";
import { AssociadosPage } from "@/features/billing/pages/AssociadosPage";

// route
<Route
  path="billing"
  element={
    <ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}>
      <BillingPage />
    </ProtectedRoute>
  }
>
  <Route path="filhos" element={<FilhosPage />} />
  <Route path="pizza" element={<PizzaPage />} />
  <Route path="pao" element={<PaoPage />} />
  <Route path="associados" element={<AssociadosPage />} />
</Route>;
```

---

## 5 · Postman — `fonte-api.postman_collection.json`

Adicionar request na pasta `Residents`:

- **Name**: `Get Contributions Monthly Report`
- **Method**: GET
- **URL**: `{{baseUrl}}/residents/contributions/report?month=2026-05`
- **Auth**: Bearer token
- Params: `month` (required), `houseId` (optional)

---

## Ordem de execução recomendada

1. `packages/types` — adicionar interfaces
2. `pnpm build:types`
3. `packages/api-client` — method + types + exports
4. `pnpm build:api-client`
5. Backend — DTO + service method + controller endpoint
6. Frontend — queryKeys → hook → components → pages → AppLayout → App.tsx
7. Postman collection

---

## Verificação

```bash
# 1. testes backend não quebram
pnpm test:api

# 2. levantar e verificar manualmente
pnpm docker:up
pnpm dev:api
pnpm dev:adm

# 3. navegar para /billing/filhos
# - submenu "Faturamento" aparece na sidebar expandido
# - selecionar mês corrente → tabela exibe residentes com contribuição
# - badge verde = pago, vermelho = pendente
# - cards de resumo batem com contagem da tabela
# - /billing/pizza, /billing/pao, /billing/associados mostram placeholders
```
