# Plan: Tela `/observabilidade` no `adm.fonte`

> **Depende da story 191** (observabilidade da API — backend). Sem o
> `GET /observability/stats` e o módulo `observability` no `@fonte/api-client`, esta story não tem
> o que consumir. Não começar antes de 191 fechar.

## Context

A story 191 instrumenta a API: custo por requisição (`cpu_ms`, `db_queries`, `db_ms`,
`heap_delta_kb`), agregado por rota desde o boot num store **em memória**, ring buffer das últimas
requisições e saúde do runtime (event loop lag, memória, CPU, uptime). Tudo isso sai por
`GET /observability/stats` (ADMIN).

Falta a leitura humana. Hoje o ADMIN só chegaria nesses números por `curl` ou pelo painel do
Sentry — e o Sentry mostra o **histórico amostrado**, não o estado vivo do processo que está
rodando agora no VPS de 1 vCPU.

### Decisões travadas

1. **A tela é uma janela viva, não um dashboard histórico.** Os dados morrem no restart da API, por
   desenho (story 191: zero persistência). A UI tem que deixar isso explícito, senão a primeira
   pergunta vira "cadê o gráfico dos últimos 30 dias" — que é o Sentry, não esta tela.
2. **ADMIN apenas.** Mesmo molde de `/backup` (`App.tsx:110`, `AppLayout.tsx:339-344`).
3. **Sem biblioteca de gráfico nova.** Tabela ordenável + cards de número. O valor está em
   comparar rotas por custo, não em desenhar série temporal de dado que não existe.

### O que a tela precisa responder

Nesta ordem, que é a ordem da pergunta original do usuário:

- O processo está saudável **agora**? (event loop lag, memória, CPU, uptime)
- Qual endpoint custa mais? (CPU médio, queries médias, p95)
- O que acabou de acontecer? (últimas requisições, para correlacionar com um relato de lentidão)

---

## Desenho

### 1. `apps/adm.fonte/src/features/observability/`

```
features/observability/
  hooks/useObservability.ts          ← useObservabilityStats(), useResetObservability()
  components/RuntimeCards.tsx        ← uptime, RSS/heap, CPU %, event loop lag p99
  components/RouteCostTable.tsx      ← tabela por rota, ordenável
  components/RouteCostRow.tsx        ← item extraído (CLAUDE.md: nada de item inline)
  components/RecentRequestsTable.tsx
  components/RecentRequestRow.tsx
  constants.ts                       ← thresholds e labels de coluna
  utils.ts                           ← formatação (ms, bytes, %) e comparadores de ordenação
  pages/ObservabilityPage.tsx        ← só orquestra
```

Nenhum componente passa de ~150 linhas; a tabela não renderiza item inline.

### 2. Hooks

`useObservability.ts`:

- `useObservabilityStats()` — `useQuery` com `queryKey: queryKeys.observability.stats` e
  `refetchInterval: 10_000`. Tela viva: 10s é o intervalo, não menos — cada poll é uma requisição
  que também entra na própria medição.
- `useResetObservability()` — `useMutation` sobre `api.observability.reset()`, invalidando
  `queryKeys.observability.stats` no `onSuccess`. Serve para medir uma janela específica ("zera,
  roda o fluxo, olha o custo") sem reiniciar a API.

`lib/queryKeys.ts` ganha:

```ts
observability: {
  stats: ['observability', 'stats'] as const,
},
```

Query key literal fora do `queryKeys.ts` é a regra mais violada do repo (CLAUDE.md) — aqui não.

### 3. `RuntimeCards`

Quatro cards, na ordem de importância para 1 vCPU:

| Card | Conteúdo | Destaque |
|---|---|---|
| Event loop lag | p99 em ms (p50 como secundário) | `destructive` acima de 100ms |
| Memória | `heapUsed` / `rss` formatados | `destructive` se `rss` acima do limite do container |
| CPU | % desde o último sample | `destructive` acima de 80% |
| Uptime | tempo desde o boot, humanizado | — |

O card de event loop lag leva um `title`/tooltip explicando o que ele significa: é o número que
denuncia Puppeteer (PDF), `sharp` (thumbnail) e `pg_dump` (backup) travando o processo. Sem essa
frase, é um número sem dono.

### 4. `RouteCostTable`

Colunas: **rota**, chamadas, erros, p50, p95, máx, **CPU médio (ms)**, **queries médias**,
**DB ms médio**.

- Ordenação default: **p95 desc**. Cabeçalhos de p95, CPU médio e queries médias são clicáveis —
  são as três lentes de "custo" que a pergunta original pede.
- Estado de ordenação é `useState` local do componente (é estado de UI, não de formulário — a
  proibição de `useState` do CLAUDE.md é sobre campo de formulário).
- Marcação de suspeita, com os tokens de tema existentes (nada de cor nova):
  - `queries médias > 20` → cheiro de N+1;
  - `p95 > 1000ms` → lentidão;
  - `erros > 0` → coluna em `destructive`.
  Thresholds em `constants.ts`, não espalhados no JSX.
- A linha `OTHER` (bucket de estouro de cardinalidade do store, story 191) é renderizada com label
  explicativo — senão parece bug.

### 5. `RecentRequestsTable`

Últimas N requisições do ring buffer, mais recente primeiro: horário, método, rota, status,
duração, CPU, queries. Status ≥ 400 em `destructive`. Sem paginação — o buffer já é limitado no
backend.

### 6. `ObservabilityPage`

Orquestra e nada mais:

- `LoadingState` / `ErrorState` (com `onRetry`) / `EmptyState` compartilhados de
  `@/components/shared/`; erro via `getErrorMessage`.
- `PageHeader` com título, descrição e, nas ações, o botão **Zerar contadores**
  (`useResetObservability`), no molde do botão de rodar backup (`BackupPage.tsx`).
- **Aviso permanente** no cabeçalho, curto: os números são desde o último restart da API e vivem
  só em memória; histórico e alerta ficam no Sentry.
- Rodapé com link para o projeto no Sentry quando `VITE_SENTRY_ORG_URL` estiver definida (opcional;
  ausente, o bloco não renderiza).

### 7. Rota e navegação

- `App.tsx`: `<Route path="observabilidade" element={<ProtectedRoute allowedRoles={[Role.ADMIN]}><ObservabilityPage /></ProtectedRoute>} />`,
  espelhando `/backup` (`App.tsx:110`).
- `AppLayout.tsx`: link dentro do bloco `isAdmin`, junto de Backup (`:339-344`), ícone `Activity`
  do `lucide-react`, label **Observabilidade**.

---

## Validação

### Unit (`pnpm test:adm:unit`)

**`hooks/useObservability.test.tsx`**
- `useObservabilityStats` chama `api.observability.stats()` e usa
  `queryKeys.observability.stats` (asserção da chave — é a regra mais violada do repo).
- `useResetObservability` invalida `queryKeys.observability.stats` no sucesso.

**`components/RouteCostTable.test.tsx`**
- Ordena por p95 desc por padrão; clicar no cabeçalho de CPU médio reordena por CPU; clicar de novo
  inverte.
- Linha com `queries médias > 20` recebe a marcação de N+1; linha com 5 queries **não** recebe.
- Linha com `p95 > 1000` recebe a marcação de lentidão.
- Rota `OTHER` renderiza com o label explicativo.

**`components/RuntimeCards.test.tsx`**
- Formatação: bytes viram MB legível, ms com uma casa, uptime humanizado.
- Lag p99 acima de 100ms recebe o destaque; abaixo, não.

**`utils.test.ts`**
- Formatadores com zero, valor grande e `null`/`undefined` (o backend pode devolver rota sem
  amostra de DB → `avgDbMs` ausente não pode virar `NaN` na tela).
- Comparadores de ordenação com valores iguais mantêm ordem estável.

**`pages/ObservabilityPage.test.tsx`**
- Três estados: `LoadingState`, `ErrorState` (com retry), `EmptyState` (nenhuma rota registrada).
- Aviso de "desde o último restart" sempre presente.
- Botão de zerar dispara a mutation.

### E2E (`pnpm test:adm`)

Novo `apps/adm.fonte/e2e/observability.spec.ts`:
- ADMIN abre `/observabilidade` **pelo link do menu** e vê a tabela contendo ao menos a rota que a
  própria navegação acabou de gerar.
- SERVANT **não** vê o link no menu e, entrando direto na URL, é barrado pelo `ProtectedRoute`.
- Botão **Zerar contadores** zera: depois do clique, a contagem da rota observada cai (e volta a
  subir no poll seguinte, porque o próprio poll é requisição).
- **Isolamento (story 182):** a suíte não cria nem apaga linha em banco nenhum — o reset toca só
  memória da API. Registrar isso no header do spec para não parecer cleanup faltando.

### Contratos

Nada a construir aqui: os tipos e o módulo `observability` do `@fonte/api-client` são entrega da
story 191. Se esta story precisar de um campo novo no payload, ele volta para a 191 (backend +
Postman + `pnpm build:api-client`) em vez de ser remendado no front.

### Verificação manual

1. Com a API rodando, navegar por 3 telas do adm e abrir `/observabilidade`: as rotas visitadas
   aparecem com contagem coerente.
2. Deixar a tela aberta 30s: os números avançam sozinhos (poll de 10s) sem piscar a tela inteira.
3. Gerar um PDF pelo adm e observar o card de event loop lag subir.
4. Entrar como SERVANT: link ausente no menu, URL direta bloqueada.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. Story frontend-only: rodar a cobertura do `adm.fonte`
> (`test:adm:unit` com cobertura / `pnpm test:cov:all` no recorte do app) e **não reduzir** a
> cobertura do app. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

---

## Fora de escopo

- **Qualquer mudança no backend.** Se faltar dado, é ajuste na story 191.
- **Gráfico de série temporal.** Não existe histórico para plotar (o store morre no restart).
- **Biblioteca de charts nova** no `adm.fonte`.
- **Observabilidade nos outros apps** (`portal.fonte`, `ops.fonte`, `app.fonte`).
- **Alertas** — painel do Sentry, não código.
- **Otimizar endpoint** que a tela venha a acusar como caro. A tela mede; corrigir é a story que
  nascer da medição.
