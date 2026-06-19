# Plan: Associados — página inicial vira overview de faturamento mês a mês

> Pertence ao epic [[36]] (associados). Não reabre cadastro [[37]], gateway [[41]] nem
> scheduler [[39]]; só adiciona uma camada de leitura/agregação sobre os dados já existentes
> (`associates`, `associate_charges`, `associate_subscriptions`) e reorganiza as rotas do adm.

## Context

Hoje `/associados` (adm, só ADMIN) abre direto a **tabela de cadastro**. O ADMIN quer, como tela
inicial, um **overview de faturamento** — visão de gestão, não a lista operacional. A lista continua
existindo, só deixa de ser a porta de entrada.

### Decisões do usuário (travadas — 2026-06-16)

- **Rota separada**: `/associados` = overview; `/associados/lista` = tabela de cadastro atual.
  O overview tem botão "Ver associados" → `/associados/lista`.
- **Mês a mês = série histórica**: gráfico de **valor esperado vs arrecadado** dos últimos N meses
  (default 12) + cards e índices do **mês corrente**.
- **Valores bruto E líquido** lado a lado: bruto = `grossAmount` (cobrado do associado, com
  gross-up da taxa); líquido = `netAmount` (o que a Fonte recebe).
- **Índices no overview**: novos associados, churn, recorrência/ativos, inadimplência.
- Permissão inalterada: tudo ADMIN.

### Definições das métricas (travadas)

Base de cálculo = tabela `associate_charges` (cobranças reais geradas), não a contribuição teórica.

- **Esperado (mês)** = soma de `grossAmount`/`netAmount` das charges com `due_date` no mês.
- **Arrecadado (mês)** = soma de `grossAmount`/`netAmount` das charges `status=PAID` com `paid_at`
  no mês.
- **Novos associados (mês)** = `associates` com `created_at` no mês (exclui soft-deleted).
- **Churn (mês)** = assinaturas com `canceled_at` no mês ÷ assinaturas ativas no início do mês
  (rate + contagem absoluta).
- **Recorrência/ativos** = nº de `associate_subscriptions` `status=ACTIVE`; taxa = ativos ÷
  associados não-cancelados.
- **Inadimplência (mês)** = charges `status=FAILED` **ou** (`status=PENDING` e `due_date` já
  vencida) no mês; + contagem de associados `status=PAST_DUE` (atual).

## Desenho

### Backend — novo endpoint de agregação (sem mudança de schema)

`GET /associates/overview?months=12` (ADMIN). Service agrega via QueryBuilder/SQL:

```ts
interface AssociatesOverview {
  months: Array<{
    month: string;            // 'YYYY-MM'
    expectedGross: number;
    expectedNet: number;
    collectedGross: number;
    collectedNet: number;
  }>;
  current: {
    expectedGross: number; expectedNet: number;
    collectedGross: number; collectedNet: number;
    newAssociates: number;
    activeSubscriptions: number;
    recurrenceRate: number;   // 0..1
    churnCount: number;
    churnRate: number;        // 0..1
    delinquentCharges: number;
    pastDueAssociates: number;
  };
}
```

- Tipo `AssociatesOverview` em `packages/types` + re-export pelo `@fonte/api-client`.
- Método novo no `AssociateService` (agregações por mês com `date_trunc`/range; sem N+1).
- Rota nova no `AssociateController` (`@Get('overview')` **antes** de `@Get(':id')` p/ não colidir).
- `associates.getOverview(months?)` no módulo associates do `@fonte/api-client`.
- Atualizar `fonte-api.postman_collection.json` (endpoint novo).
- Testes unit do service (`associate.service.spec.ts`): meses corretos, esperado/arrecadado,
  churn, inadimplência, mês sem dados = zeros.

### Frontend adm — rotas e telas

- **Rotas** (`App.tsx`):
  - `associados` → `AssociatesOverviewPage` (nova, default).
  - `associados/lista` → página de lista atual (renomear `AssociatesPage` → `AssociatesListPage`;
    conteúdo da tabela inalterado, só ganha um "voltar ao overview" no header).
  - Menu lateral continua apontando para `associados`.
- **Hook**: `useAssociatesOverview(months?)` em `features/associates/hooks/` (query nova;
  `queryKeys.associates.overview(months)`).
- **Página `AssociatesOverviewPage`** (orquestra, sem fetch direto, <150 linhas):
  - `OverviewKpiCards` — cards esperado/arrecadado (bruto+líquido) do mês.
  - `OverviewIndicesCards` — novos associados, ativos+recorrência, churn, inadimplência.
  - `BillingMonthlyChart` — recharts (espelhar `features/billing/components/SalesHistoryChart.tsx`):
    barras/linhas esperado vs arrecadado por mês.
  - Botão "Ver associados" → `/associados/lista`.
  - Estados via `LoadingState`/`ErrorState`/`EmptyState`.
- Item extraído por responsabilidade (card, chart) conforme regra de decomposição do CLAUDE.md.
- Formatação de moeda reusando helper existente (verificar em `lib/` antes de criar).

## Validação

- `pnpm build:types` + `pnpm build:api-client` (tipo novo propaga).
- `pnpm test:api` verde, incluindo specs novos do overview.
- `pnpm build:adm` (ou `tsc -b`) compila.
- `pnpm test:adm` do spec de associados, se existir, atualizado para a nova navegação
  (overview default + link para lista). Criar/ajustar se quebrar.
- Smoke manual: seed com charges pagas/pendentes em meses distintos → conferir série e índices.

## Fora de escopo

- Mudança de schema/migration (só leitura sobre tabelas existentes).
- Exportar relatório (CSV/PDF).
- Filtros avançados (por associado, faixa de valor) no overview.
- Alterar regras de cobrança, gateway ou scheduler.
- Métricas preditivas/projeção futura — só histórico realizado + mês corrente.
