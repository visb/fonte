# Plan: módulo de contribuição em produtos no `ops.fonte` — fila do mês + declaração offline-first

## Context

A declaração de contribuição em produtos do filho **já existe** no `ops.fonte` desde a story 112:
`features/residents/pages/DeclareProductContributionPage.tsx`, rota
`/(app)/residents/declare-products`, com catálogo unificado, modo avulso e remoção por correção. O
backend já libera `SERVANT` nas três rotas (`resident.controller.ts:493-523`) — o recorte sem valor
do carnê (story 186) foi criado exatamente para isso.

O que não existe é **entrada própria**. Hoje o único caminho é: Filhos → buscar o filho → abrir →
aba Visão Geral → botão *Declarar produtos* (`ResidentDetailPage.tsx:111`). Quatro toques e uma busca
para um lançamento que acontece na porta da casa, com a família esperando, várias vezes por dia. E,
pior: não há **nenhuma** tela que mostre o que já foi declarado na casa — o servo não tem como saber
se o colega já lançou a cesta que ele está com a mão, então o jeito de conferir é abrir filho por
filho.

Junto disso vem um defeito real: `useDeclareProductContribution` (`useProductContributions.ts:79`)
usa **`mutationFn` inline**. Declarar produto é fluxo de campo, e o CLAUDE.md é explícito —
`mutationFn` inline não é serializável, então a mutation pausada sem sinal **não é retomada** no
restart do app. O lançamento feito no fundo da casa, sem rede, se perde se o servo fechar o app antes
de o sinal voltar. A infra que resolve isso já está pronta (stories 168-171): `OUTBOX_MUTATION_KEYS`,
`setMutationDefaults`, `networkMode: 'offlineFirst'`, dead-letter e tela de pendências.

Esta story é entrada no menu + a fila do mês + a correção do offline. O formulário em si não muda.

### Decisões travadas (usuário)

1. **O módulo é a fila do mês, não um atalho.** Item *Contribuições* na seção **Casa** do menu abre
   **o que já foi declarado na casa no mês corrente** — uma linha por filho, com o resumo do que
   entrou — e um botão *Nova declaração*. Ver o que já entrou é metade do valor: é o que evita a
   cesta lançada duas vezes.
2. **A competência continua sendo resolvida sozinha.** `currentReceivable()` escolhe a parcela
   corrente e a tela nem mostra a escolha, como hoje. Produto de mês atrasado é correção do
   escritório no `adm.fonte` — dar o select ao servo troca um erro raro por um erro silencioso.
3. **As duas entradas convivem.** O botão em `ResidentOverviewTab` fica: quem já está na ficha do
   filho não volta ao menu. Mesma tela de destino, dois caminhos — custo zero.

### Decisões de desenho derivadas (do levantamento no código)

4. **A fila exige endpoint novo.** `ReceivableProductContributionService.listByReceivable` é
   `(residentId, receivableId)` — não há como perguntar "o que a casa recebeu neste mês". Nasce
   `GET /houses/:id/product-contributions?referenceMonth=YYYY-MM-DD`, no `HouseController` (ao lado
   de `:id/residents` e `:id/staff`), roles `ADMIN`/`COORDINATOR`/`SERVANT` — as mesmas das rotas de
   contribuição, não as do carnê em dinheiro.
5. **A resposta vem agrupada por filho**, porque é assim que a tela lê: `residentId`, `residentName`,
   `receivableId`, `referenceMonth` e as linhas. Agrupar no cliente obrigaria o app a baixar a lista
   crua e reconstruir o que o banco já sabe fazer com um `JOIN`.
6. **O cache da fila vai para o store local dos filhos, não para o blob de 24h.** A resposta carrega
   **nome de filho**, e `PERSISTED_QUERY_PREFIXES` é allowlist por LGPD (epic 167). Dado de filho
   mora em `RESIDENT_STORE_QUERY_PREFIXES` (story 175): sem prazo de validade e **purgado no
   logout** — que é a garantia que o blob de 24h não dá. Mesmo tratamento que `resident-receivables`
   já recebe.
7. **A mutation vira item de outbox.** `OUTBOX_MUTATION_KEYS.productContributionDeclare =
   ['productContributions', 'declare']`, `mutationFn` registrada em `mutationDefaults.ts` (fora da
   árvore React), rótulo *"Contribuição em produtos"* em `OUTBOX_LABELS` para a tela de pendências.
   Todas as variáveis que a `mutationFn` e a invalidação precisam (`residentId`, `receivableId`,
   `lines`, `houseId`, `referenceMonth`) vão **nas variáveis** — nada de closure, que não sobrevive à
   desidratação.
8. **A tela usa `useFieldSubmit`** (story 171): com sinal, alerta de sucesso e volta; **sem sinal**,
   a tela segue em frente na hora com o aviso de que entrou na fila. Esperar `onSuccess` sem rede
   deixa o servo no botão girando — e é o que aconteceria hoje se a mutation fosse pausável.
9. **A fila mostra o que ainda está na fila**, via update otimista da query da casa no `onMutate`,
   marcado como *aguardando envio*. Fila que só mostra o que o servidor confirmou é inútil
   justamente no cenário para o qual ela existe. Item rejeitado pelo servidor sai da fila e aparece
   em `/sync` com o motivo (story 170) — nunca some em silêncio.
10. **O filho é escolhido dentro do fluxo, com a lista já em cache.** *Nova declaração* abre a lista
    de filhos **da casa do servo** (`residents.byHouse`, já no store local), com busca por nome.
    Escolhido o filho, navega para a tela que já existe — `DeclareProductContributionPage` não muda
    de responsabilidade, só passa a receber `residentId` de dois lugares.
11. **A feature nasce em `features/contributions/`**, não dentro de `features/residents/`. A página
    de declaração **permanece** onde está (é ficha de filho); o que nasce é a fila + a escolha de
    filho, que são do módulo novo. Hook novo `useHouseProductContributions` na feature nova.

---

## Desenho

### 1. Banco

**Nenhuma migration.** `receivable_product_contributions` já tem tudo
(`IDX_rpc_receivable`, `IDX_rpc_inventory_item`). A consulta nova é
`contribuições → receivable → resident WHERE resident.house_id = :houseId AND
receivable.reference_month = :month`, coberta pelos índices existentes mais o
`house_id` de `residents`.

### 2. Backend — `ReceivableProductContributionService.listByHouseAndMonth`

```ts
export interface HouseProductContributionView {
  residentId: string;
  residentName: string;
  receivableId: string;
  referenceMonth: string;          // 'YYYY-MM-DD', como vem do Postgres
  lines: ProductContributionView[]; // view que já existe, reusada
}

listByHouseAndMonth(houseId: string, referenceMonth: string)
  : Promise<HouseProductContributionView[]>
```

- Ignora linhas e parcelas soft-deletadas (`deleted_at IS NULL` nos dois lados).
- Ordena por nome do filho (pt-BR), linhas por `created_at`.
- Filho sem contribuição no mês **não aparece** — a fila é do que entrou, não checklist da casa.
- `referenceMonth` ausente → mês corrente. Formato inválido → 400.
- Lê a competência pelos **componentes da string**, nunca `new Date(...)` — em fuso negativo o dia 1º
  volta um mês (a mesma armadilha que `referenceMonthOf` já documenta na story 193).

### 3. API

| rota | roles | observação |
|---|---|---|
| `GET /houses/:id/product-contributions?referenceMonth=` | `ADMIN`, `COORDINATOR`, `SERVANT` | novo (decisão 4) |
| `GET/POST/DELETE /residents/:id/receivables/:rid/product-contributions` | inalteradas | |

`fonte-api.postman_collection.json` atualizado com a rota nova (regra do CLAUDE.md).

### 4. `packages/api-client`

`houses.productContributions(houseId, params?: { referenceMonth?: string })`
→ `HouseProductContributionView[]`. Tipo exportado por `@fonte/types`.

### 5. `ops.fonte` — offline (o miolo)

**`lib/queryKeys.ts`**
```ts
houses: {
  productContributions: (houseId: string, month: string) =>
    ['resident-product-contributions-house', houseId, month] as const,
}
```
Prefixo escolhido para cair no store de filho (decisão 6) sem colidir por igualdade com
`resident-product-contributions`, que é comparado por igualdade exata
(`constants.ts:isPersistableQueryKey`).

**`lib/offline/constants.ts`** — entrada nova em `RESIDENT_STORE_QUERY_PREFIXES`, com o comentário do
porquê (nome de filho). Nada em `PERSISTED_QUERY_PREFIXES`.

**`lib/offline/outbox.ts`** — `productContributionDeclare: ['productContributions', 'declare']` em
`OUTBOX_MUTATION_KEYS` + rótulo em `OUTBOX_LABELS`.

**`lib/offline/mutationDefaults.ts`** — `ProductContributionDeclareVariables extends OutboxVariables`
(`residentId`, `receivableId`, `houseId`, `referenceMonth`, `lines`), `mutationFn` chamando
`api.residents.declareProductContributions`, `onMutate` com o update otimista da decisão 9,
invalidação de `residents.productContributions`, `residents.receivables`, `residents.detail` e
`houses.productContributions`. `networkMode: 'offlineFirst'` + `outboxRetry`, como as demais.

**`useDeclareProductContribution`** deixa de declarar `mutationFn` e passa a usar só
`mutationKey` — o default resolve o resto. É o que torna o lançamento retomável no restart.

### 6. `ops.fonte` — telas (`features/contributions/`)

```
features/contributions/
  hooks/useHouseProductContributions.ts   ← query da fila
  components/ContributionResidentRow.tsx  ← item extraído (nunca inline no FlatList)
  components/ContributionSummary.tsx      ← "3 itens" / "cesta básica" / "aguardando envio"
  pages/ContributionsQueuePage.tsx        ← fila do mês + FAB "Nova declaração"
  pages/PickResidentPage.tsx              ← escolha do filho (decisão 10)
app/(app)/contributions/
  index.tsx        ← fila
  pick-resident.tsx
  _layout.tsx
```

- Entrada em `features/menu/constants.ts`, seção **Casa**, rótulo *Contribuições*, `quickAction`
  *Nova declaração* apontando direto para `pick-resident`.
- Estados por `LoadingState` / `EmptyState` / `ErrorState` (*"Nenhuma contribuição declarada neste
  mês."*), nunca `ActivityIndicator` ou `<Text>` solto (CLAUDE.md).
- `PickResidentPage` consome `residents.byHouse` (store local) — funciona sem sinal.
- Pull-to-refresh + `LastSyncedAt`, como as demais telas de campo.
- Nenhum componente acima de ~150 linhas.

### 7. `adm.fonte`

Inalterado. A fila é ferramenta de casa; o escritório continua vendo a contribuição pela ficha do
filho.

---

## Validação

### Backend — `pnpm test:api`

- **`listByHouseAndMonth`**: agrupa por filho com as linhas ordenadas; filho de **outra** casa não
  aparece; contribuição de **outro mês** não aparece; linha soft-deletada e parcela soft-deletada
  ficam de fora; filho sem contribuição no mês não vira linha vazia; casa sem nada → `[]`.
- **Competência (decisão 2 da lista técnica)**: parcela com `reference_month` no dia 1º é retornada
  no mês certo — teste rodando com `TZ` negativo, que é onde `new Date()` erraria.
- `referenceMonth` ausente → mês corrente; formato inválido → 400.
- **Roles**: `SERVANT` lê; a rota não expõe **nenhum** campo de valor em dinheiro (asserção
  explícita sobre as chaves da resposta — é o que separa esta rota do carnê).

### Backend — `pnpm test:api:e2e`

- `GET /houses/:id/product-contributions`: `200` para ADMIN, COORDINATOR e SERVANT; `403` para
  RELATIVE; `404` para casa inexistente; filtro por `referenceMonth` devolvendo conjuntos diferentes
  para dois meses.
- Fixtures conforme a story 182: criadas pela suíte via API e removidas no `afterAll`, limpeza por id
  acumulado — **nunca** `DELETE FROM receivable_product_contributions`.

### Contratos

`pnpm build:types` e `pnpm build:api-client` (`HouseProductContributionView`, método novo).
Postman atualizado.

### `ops.fonte` — unit (Vitest/RTL), `pnpm test:ops:unit`

- **`ContributionsQueuePage`**: renderiza uma linha por filho com o resumo certo (N itens do catálogo
  / descrição do avulso); `EmptyState` sem contribuições; `ErrorState` em falha.
- **`PickResidentPage`**: lista só os filhos da casa; busca filtra por nome; escolher navega com
  `residentId` e `houseId`.
- **`useDeclareProductContribution`**: o hook **não** declara `mutationFn` (asserção direta — é a
  regressão que a story existe para impedir) e usa a `mutationKey` registrada.
- **`mutationDefaults`**: a `mutationFn` da chave nova chama o endpoint com as variáveis
  desidratadas; `onMutate` insere o item otimista na query da casa; a invalidação atinge as quatro
  chaves da seção 5.
- **`constants.ts`**: `isResidentStoreQueryKey(['resident-product-contributions-house', h, m])` →
  `true`; `isPersistableQueryKey` da mesma chave → **`false`** (decisão 6 — o teste que impede a
  regressão de LGPD); e `resident-product-contributions` **não** entra de carona por prefixo.
- **`useFieldSubmit`** na tela: offline chama `onQueued` e navega; online chama `onSent`.

### `ops.fonte` — offline e2e (Playwright web, `e2e-web/`)

O teste que prova a story (Maestro não controla rede — `context.setOffline`):

1. Online: abrir a fila, ver o que já existe.
2. `setOffline(true)` → declarar produtos para um filho → a tela **avança** e o item aparece na fila
   como *aguardando envio*.
3. **Recarregar o app ainda offline** → o item continua na fila (é o que o `mutationFn` inline
   perdia).
4. `setOffline(false)` → a fila sincroniza, o item perde o marcador e nada duplica.
5. Rejeição do servidor → o item sai da fila e aparece em `/sync` com o motivo.

### `ops.fonte` — e2e (Maestro, `pnpm test:ops`)

Fluxo online pelo menu: *Contribuições* → *Nova declaração* → escolher filho → lançar um item de
catálogo e um avulso → voltar e ver as duas linhas na fila.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` e `pnpm test:ops:unit` com cobertura;
**não reduzir** a cobertura de `resident-receivable` no backend nem de `lib/offline/` no `ops.fonte`,
e a feature nova `contributions` nasce ≥90. Os pontos obrigatoriamente cobertos: a allowlist da
decisão 6 (store sim, blob não) e a ausência de `mutationFn` inline na decisão 7 — são as duas
regressões silenciosas possíveis. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Declaração cobrindo vários filhos de uma vez** (a família traz cesta para dois irmãos): continua
  uma declaração por filho.
- **Escolher a competência** (decisão 2) — correção de mês é no `adm.fonte`.
- **Detalhar o avulso** (`pending_detailing = true` → virar item de catálogo): a logística resolve
  fora do app; a fila só exibe o marcador.
- **Remover contribuição pela fila.** A remoção (que gera movimento OUT de correção, sem estorno —
  `BUSINESS_RULES.md`) continua só na tela do filho, com o contexto da parcela à vista.
- **Valor em dinheiro**: a rota nova não expõe nem passa a expor pagamento; o carnê segue restrito a
  ADMIN/COORDINATOR no `adm.fonte`.
- **Criar item de catálogo na hora da declaração** — é a story seguinte do backlog.
- **Histórico de meses anteriores na fila**: a tela é do mês corrente. Consulta histórica é
  `adm.fonte`.
- **`adm.fonte` e `app.fonte`** — nenhuma mudança.
