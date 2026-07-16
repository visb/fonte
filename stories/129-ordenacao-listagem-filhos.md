# Plan: Ordenação na listagem de filhos — padrão por data de entrada e select

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

A listagem de filhos do `adm.fonte` sai sempre em ordem alfabética, sem opção de mudar. Quem
acompanha acolhimentos quer ver **quem entrou por último primeiro** — hoje precisa procurar na lista
inteira. Esta story troca o padrão da tela e dá ao usuário um **select de ordenação** junto dos
filtros.

### Estado atual

- **Backend:** `ResidentService.findAll` ordena por `resident.name ASC` **fixo**
  (`resident.service.ts:128`) e é **paginado** (`page`/`limit`) — por isso a ordenação tem que ser
  resolvida no banco; ordenar no cliente só reordenaria a página corrente.
- **`ListResidentsDto`** aceita hoje `page`, `limit`, `search`, `status`, `houseId`,
  `overdueContribution`. Nada de ordenação.
- **Frontend:** `ResidentsPage` usa **infinite scroll** (`useInfiniteResidents`) e já persiste os
  filtros na URL (`q`, `status`, `house`, `overdue`) — commit `3e57442`. O select novo segue o mesmo
  padrão de URL.
- **`ops.fonte` consome o mesmo endpoint** (`api.residents.list()` em
  `ops.fonte/features/residents/hooks/useResidents.ts:8`).

### Decisões travadas

1. **O default novo é só do `adm.fonte`.** O backend **mantém** `name ASC` como default do
   `GET /residents`; o adm passa `sort=entryDate&order=desc` explicitamente. Como o `ops.fonte` usa o
   mesmo endpoint, mudar o default no backend mudaria a lista dos operadores sem ninguém pedir — e lá
   o alfabético é o certo (operador procura filho pelo nome).
2. **Quatro opções no select**, cobrindo os dois eixos nas duas direções:

   | Rótulo | `sort` na URL | Backend |
   |---|---|---|
   | Mais recentes primeiro (padrão) | `entry_desc` | `entryDate` / `desc` |
   | Mais antigos primeiro | `entry_asc` | `entryDate` / `asc` |
   | Nome (A–Z) | `name_asc` | `name` / `asc` |
   | Nome (Z–A) | `name_desc` | `name` / `desc` |

3. **Desempate obrigatório por `resident.id ASC`.** `entry_date` é `date` (sem hora) e **repete
   muito** — vários filhos entram no mesmo dia. Sem desempate determinístico, a paginação do infinite
   scroll pode **repetir ou pular** registros entre páginas, porque o Postgres não garante ordem
   estável para linhas empatadas. Vale para todas as opções.
4. **`entry_date` nulo vai para o fim** (`NULLS LAST`) nas duas direções — filho `ARCHIVED` pode não
   ter data de entrada e não deve encabeçar a lista.
5. **Whitelist de colunas no backend.** `sort`/`order` são validados por enum/`@IsIn` e **mapeados**
   para nome de coluna; nunca interpolar o valor recebido direto no `orderBy` — isso seria injeção de
   SQL na cláusula de ordenação.
6. **Ordenação vive na URL, como os demais filtros** — link compartilhado reproduz a mesma tela. A
   [[130]] transforma isso em preferência salva; a URL continua tendo precedência sobre a preferência.

### Dependências

- **[[130]]** (preferências do usuário) — a ordenação escolhida entra no conjunto de filtros
  persistidos lá. Esta story não persiste nada além da URL; é a 130 que dá memória. Fazer a 129
  antes: a 130 só pluga o que já existir na URL.

## Desenho

### Backend (`services/api`)

- **`ListResidentsDto`**: `sort?: 'entryDate' | 'name'` (default `name`) e `order?: 'asc' | 'desc'`
  (default `asc`), ambos com `@IsOptional()` + `@IsIn([...])`. Defaults preservam o comportamento
  atual (decisão 1).
- **`ResidentService.findAll`**: trocar o `.orderBy('resident.name', 'ASC')` fixo por mapa
  whitelisted (decisão 5):
  ```ts
  const SORT_COLUMNS = { name: 'resident.name', entryDate: 'resident.entryDate' } as const;
  qb.orderBy(SORT_COLUMNS[sort], order === 'desc' ? 'DESC' : 'ASC', 'NULLS LAST')
    .addOrderBy('resident.id', 'ASC'); // desempate estável (decisão 3)
  ```
  Sem tocar nos filtros nem no escopo por casa (LGPD, `resident.service.ts:115-121`) já existentes.
- **Postman**: refletir `sort` e `order` em `GET /residents`.

### Contratos

- `packages/types` / `api-client`: parâmetros da listagem ganham `sort?: 'entryDate' | 'name'` e
  `order?: 'asc' | 'desc'`.

### Frontend (`adm.fonte`)

- **`ResidentsFilters`**: `Select` "Ordenar por" com as 4 opções da decisão 2, ao lado dos filtros
  atuais. Rótulos em português; valores conforme a tabela.
- **`ResidentsPage`**: lê `sort` da URL com **default `entry_desc`** (o padrão da tela, decisão 1);
  grava via o `setParam` que já existe; converte `entry_desc` → `{ sort: 'entryDate', order: 'desc' }`
  no chamado do hook. O mapa rótulo→params fica em `features/residents/constants.ts` (convenção do
  repo), não espalhado na page.
- **`useInfiniteResidents`**: repassa `sort`/`order` e **inclui os dois na query key** (`lib/queryKeys.ts`,
  nunca literal) — sem isso o cache devolve a lista da ordenação anterior.

## Validação

- **`pnpm test:api`** (unit `ResidentService.findAll`):
  - **default preservado**: sem `sort`/`order` → ordena por `name ASC` (prova a decisão 1, que
    protege o `ops.fonte`);
  - `sort=entryDate&order=desc` → mais recente primeiro; `order=asc` → mais antigo primeiro;
    `sort=name&order=desc` → Z–A;
  - **desempate**: filhos com a **mesma** `entry_date` saem em ordem estável por `id` (decisão 3);
  - **nulos**: filho sem `entry_date` vai para o fim nas duas direções (decisão 4);
  - ordenação **não afeta** filtros nem o escopo por casa do não-ADMIN (regressão LGPD).
- **`pnpm test:api:e2e`** (estender o spec de residents):
  - `GET /residents?sort=entryDate&order=desc` devolve na ordem certa;
  - **400** para `sort`/`order` fora da whitelist (ex: `sort=name;DROP`) — prova a decisão 5;
  - **paginação estável**: page 1 + page 2 com datas repetidas **não repetem nem perdem** registro.
- **`pnpm test:adm:unit`**:
  - `ResidentsFilters`: renderiza as 4 opções; escolher uma chama o handler com o valor certo.
  - `ResidentsPage`: sem `sort` na URL → hook chamado com `entryDate`/`desc` (default da tela);
    `?sort=name_asc` → hook chamado com `name`/`asc`; trocar o select **escreve na URL**; query key
    muda com a ordenação (não reusa cache da anterior).
- **`pnpm test:adm`** (Playwright, spec de residents): trocar a ordenação → lista reordena → recarregar
  a página mantém a ordem (veio da URL).
- **`pnpm build:types && pnpm build:api-client`** (contratos mudaram). Sem migration.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` + `pnpm test:adm:unit:cov`; **não
reduzir** a cobertura do módulo `resident` nem de `features/residents`. Sem `skip`/`only`/`xfail` sem
justificativa no código (CLAUDE.md).

## Fora de escopo

- **Persistir a ordenação como preferência do usuário** — story [[130]].
- Mudar a ordenação do `ops.fonte`/`app.fonte` (decisão 1 mantém o alfabético lá).
- Ordenar por casa, status, idade ou tempo de casa (decisão 2 fixou 4 opções).
- Ordenação em outras listagens (staff, associados, eventos).
- Ordenar por coluna clicando em cabeçalho de tabela — a listagem é de cards com infinite scroll.
