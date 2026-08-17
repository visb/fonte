# Plan: recorte do carnê para o servo — fechar o 403 da contribuição em produtos sem abrir o financeiro

## Context

Achado da rodada de autorun 182–184, diagnosticado **em aparelho** durante a story 183
(`stories/done/PROGRESS-182-184.md` → "Resumo final", achado 1).

A declaração de contribuição em produtos no `ops.fonte` é, hoje, **impossível para o servo**. A tela
mostra *"Erro ao carregar o carnê do filho."* e o log traz **403**. Foi por isso que
`e2e/product-contributions.yaml` passou a logar como coordenador (`login-coordinator.yaml`), mesmo
sendo um fluxo de operação de casa.

### O buraco é de uma rota só

As rotas de **contribuição em produtos** já são liberadas ao servo desde a story 112
(`services/api/src/modules/resident/resident.controller.ts:444-468`), com comentário explícito:

```ts
// Contribuição em produtos (story 112): liberada para SERVANT+ (ops usa) —
// diferente do pagamento em VALOR, que segue restrito a ADMIN/COORDINATOR.
@Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
```

O que ficou de fora é a **listagem do carnê**, `GET /residents/:id/receivables`
(`resident.controller.ts:391-395`), que segue `@Roles(ADMIN, COORDINATOR)` — e é ela que a tela usa
para **achar a parcela** em que o produto será declarado. A story 112 liberou o verbo e esqueceu o
substantivo: a permissão ficou pela metade e o fluxo nasceu morto.

O mesmo recorte foi espelhado no pacote offline (`offline-sync.service.ts:99-102`), com teste
afirmando *"o carnê NÃO desce para o servo"*.

### O que a tela do ops realmente precisa

Levantado no código, não suposto. `DeclareProductContributionPage.tsx` consome o carnê só através de
`currentReceivable()` (`features/residents/lib/receivables.ts:32-47`) e exibe apenas
`formatReferenceMonth(receivable.referenceMonth)` (`:106`). Os campos usados são **três**:

| campo | para quê |
|---|---|
| `id` | referenciar a parcela na declaração |
| `referenceMonth` | escolher a parcela corrente e escrever "Junho/2026" na tela |
| `status` | ignorar `CANCELED` e preferir `PENDING` na escolha |

**Valor não é usado. Data e forma de pagamento não são usadas. Histórico não é usado.** O servo não
precisa de nada disso para declarar um saco de arroz.

### Decisões travadas (usuário)

1. **O servo recebe um recorte, não o carnê.** Rota nova, enxuta, com `id`, `referenceMonth` e
   `status` — e mais nada. A rota cheia (`GET :id/receivables`, com valores, pagamentos e histórico)
   **continua `ADMIN/COORDINATOR`**.
2. **A primeira escolha foi liberar o carnê inteiro ao servo e foi revertida pelo usuário**, com o
   motivo registrado aqui para não ser reaberto por engano: histórico de pagamento da família é dado
   pessoal financeiro e não deve ficar acessível a todo operador da casa. O comentário de
   `offline-sync.service.ts:99-102` foi escrito exatamente contra esse atalho e **continua válido em
   espírito** — o que muda é que passa a existir um recorte que não é "o carnê".

### Decisões assumidas por default (rever se discordar)

3. **Rota nova em vez de projeção por role na rota existente.** Projetar campos conforme quem
   pergunta faz o tipo mentir (`amount` "opcional" que na verdade depende de role) e esconde a
   política dentro do service. Duas rotas, dois tipos, cada uma com seu `@Roles`: a permissão fica
   legível no controller.
4. **O `ops.fonte` passa a usar o recorte para todas as roles**, não só para servo. Coordenador que
   abre o ops vê a mesma tela e ela não precisa de mais que três campos; manter dois caminhos por
   role no app seria complexidade sem ganho. O carnê cheio segue sendo assunto do `adm.fonte`.
5. **O pacote offline desce o recorte, para todas as roles de staff** — some a condicional
   `canSeeReceivables` e some junto o risco que ela guardava, porque o que desce deixa de ser
   financeiro. O comentário de `:99-102` é **reescrito** (mantê-lo como está viraria mentira
   documentada).
6. **O teste "o carnê NÃO desce para o servo" é reescrito, não deletado.** Passa a afirmar duas
   coisas: o **recorte** desce para o servo **e** o pacote **não** carrega valor nem pagamento para
   ninguém. A asserção continua guardando a decisão, agora mais forte.
7. **Escrita financeira intocada.** `POST :id/receivables/:receivableId/payment`, `.../reopen`,
   `PATCH :id/contribution-plan` e `PATCH :id/contribution-exempt` seguem `ADMIN/COORDINATOR`.
8. **`e2e/product-contributions.yaml` volta a logar como servo** — é o ponto da story, e a prova de
   ponta a ponta.
9. **`adm.fonte` não muda.** Continua na rota cheia, que continua existindo com as mesmas permissões.

### Dependências

- **Independente da story 185** (hidratação da ficha sem `houseId`), mas as duas editam
  `e2e/product-contributions.yaml` (a 185 remove o `swipe`, esta troca o login). **Implementar 185
  primeiro** evita rodar Maestro duas vezes.

---

## Desenho

### 1. `packages/types` — o tipo do recorte

`ResidentReceivableSummary`: `{ id: string; referenceMonth: string; status: ReceivableStatus }`.
Nome diz o que é. **Não** herda de `ResidentReceivable` nem o estende — são contratos diferentes, e
acoplá-los faria um campo novo no carnê vazar para o recorte sem ninguém decidir.

### 2. `services/api` — rota do recorte

Controller (`resident.controller.ts`, ao lado de `:391-395`):

```ts
// Recorte do carnê para o ops (story 186): o servo precisa localizar a parcela
// para declarar contribuição em produtos (SERVANT+ desde a story 112), e para
// isso bastam mês de referência e status. Valor, pagamento e histórico NÃO
// entram aqui — a rota cheia acima segue ADMIN/COORDINATOR.
@Get(':id/receivables/summary')
@Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
getReceivablesSummary(@Param('id', ParseUUIDPipe) id: string): Promise<ResidentReceivableSummary[]>
```

No `ReceivableService`, `findSummaryByResident(residentId)` — **projeção no repositório** (`select` só
das três colunas), não `map()` sobre a entidade cheia. Recorte que existe só na saída volta a vazar no
dia em que alguém logar o objeto ou reusar o método.

Ordem de rota: `':id/receivables/summary'` tem que ser declarada **antes** de qualquer
`':id/receivables/:receivableId'` para o Nest não casar `summary` como id (o `ParseUUIDPipe`
transformaria isso num 400 confuso).

### 3. `packages/api-client`

`api.residents.getReceivablesSummary(residentId)` → `ResidentReceivableSummary[]`.
`getReceivables` continua como está, para o `adm.fonte`.

### 4. `apps/ops.fonte`

- `features/residents/hooks/useProductContributions.ts:42-51` — `useResidentReceivables` passa a
  chamar `getReceivablesSummary`. Mesma query key (`queryKeys.residents.receivables(id)`): é a mesma
  pergunta ("quais parcelas esse filho tem?"), agora respondida com menos.
- `features/residents/lib/receivables.ts` — `currentReceivable()` passa a tipar
  `ResidentReceivableSummary`. A lógica **não muda** (já só usa `status` e `referenceMonth`).
- Nada de UI muda. Nada em `lib/offline/` muda (o app é offline-first — invariante do `CLAUDE.md`).

### 5. `services/api` — pacote offline

`offline-sync.service.ts`: remover `canSeeReceivables` (`:102`) e a condicional de `:108`; o bloco
`receivables` passa a ser alimentado pela **projeção enxuta**, para toda role de staff. Reescrever o
comentário de `:99-101` dizendo que o pacote leva o recorte (mês + status), nunca valor ou pagamento,
e que a rota cheia segue restrita.

O bloco de detalhe do store do ops (`ResidentDetailKind.receivables`) continua com o mesmo nome e a
mesma chave — muda o conteúdo, que encolhe.

### 6. Postman e docs

- `fonte-api.postman_collection.json`: requisição nova para `GET :id/receivables/summary` (a coleção é
  a documentação viva da API — `CLAUDE.md`).
- `BUSINESS_RULES.md`: matriz de permissões — servo **lê o recorte** do carnê; não lê valores, não
  registra pagamento em valor, não reabre parcela, não altera plano.
- `docs/lgpd/DIAGNOSTICO_LGPD.md`: registrar que o `ops.fonte` passa a trafegar e **persistir no
  aparelho** mês e status de parcela por filho — é dado pessoal, ainda que não financeiro. O registro
  é barato agora e impagável numa auditoria.

---

## Validação

### Backend — unit, `pnpm test:api`

- `ReceivableService.findSummaryByResident`: devolve só os três campos e **ordena** de forma estável;
  um teste falha se a projeção passar a trazer `amount`/pagamento (asserção sobre as **chaves** do
  objeto, não só sobre os valores) — é a catraca que protege a decisão 1 de erodir;
- `offline-sync`: com `user.role = SERVANT` o pacote traz o bloco `receivables` **preenchido** (hoje
  vem vazio);
- `offline-sync`: para **toda** role, nenhum item do bloco carrega valor ou dado de pagamento —
  asserção sobre chaves, valendo também para ADMIN/COORDINATOR;
- `offline-sync`: o recorte de `access_level` da timeline (`followUps.findByResidents(..., user.role,
  ...)`) **continua** filtrando para o servo. É o vizinho mais fácil de derrubar sem querer.

### Backend — e2e, `pnpm test:api:e2e`

- `GET :id/receivables/summary` com token de **operador** → **200**, itens só com
  `id`/`referenceMonth`/`status`;
- `GET :id/receivables` (rota cheia) com token de **operador** → **403** — a story fecha o fluxo sem
  abrir o financeiro, e este é o caso que prova isso;
- escritas financeiras com operador → **403**, caso a caso: `POST .../payment`, `POST .../reopen`,
  `PATCH :id/contribution-plan`, `PATCH :id/contribution-exempt`;
- `RELATIVE` e `RESIDENT` → **403** nas duas rotas de leitura (a liberação é de staff; role não citada
  não pega carona);
- fluxo completo por operador na API: recorte → declarar produto na parcela → listar contribuições;
- `GET :id/receivables/summary` com `:id` inexistente → 404 (e não 400 por colisão de rota — a prova
  de que a ordem de declaração do item 2 está certa).

### `adm.fonte` — regressão

`pnpm test:adm` e `pnpm test:adm:unit` **sem mudança de expectativa**: o adm continua na rota cheia.
Se algum teste do adm precisar mudar, o recorte vazou para onde não devia.

### `ops.fonte` — unit, `pnpm test:ops:unit`

- `currentReceivable()` com o tipo do recorte: os casos existentes (mês corrente, `PENDING` mais
  recente, fallback, `CANCELED` ignorado, lista vazia) passam **sem mudança de expectativa**;
- `useResidentReceivables` chama `getReceivablesSummary` (mock do api-client) e continua desabilitado
  sem `residentId`.

### `ops.fonte` — Maestro, `pnpm test:ops`

Pré-requisitos: emulador/aparelho **API ≤ 34**, APK via `pnpm --filter ops.fonte build:e2e:android`
(story 184), `pnpm test:setup` imediatamente antes.

- `product-contributions.yaml` verde **logado como operador**, incluindo
  `"Contribuição em produtos declarada."` — critério de aceite;
- **suíte fecha 13/13**, sem edição nos outros 12 fluxos;
- flakiness conhecida de launch do driver (`census`/`dashboard`) não conta como falha desta story.

### Contratos

`packages/types` e `packages/api-client` mudam ⇒ `pnpm build:types && pnpm build:api-client`
obrigatórios antes de subir API/apps. **Sem migration** (nenhuma coluna nova; a projeção lê o que já
existe). **Com** Postman.

### Gate de cobertura (trava a story)

`pnpm test:api:cov` — não reduzir `services/api` (baseline 92.55 / 79.85 / 90 / 94.32; thresholds
90/75/87/92). `pnpm test:ops:unit:cov` — não reduzir `ops.fonte` (baseline 94.5 / 85.2 / 93.15 / 95.6;
thresholds 90/81/89/93). Atenção: esta story **remove** o ramo `canSeeReceivables` e **adiciona** rota
e projeção — todo caminho novo tem teste correspondente; código novo sem teste não fecha a story. Sem
`skip`/`only`/`xfail` sem justificativa explícita no código (`CLAUDE.md`).

---

## Fora de escopo

- **Liberar o carnê cheio ao servo** — revertido pelo usuário, decisão 2. Se voltar à mesa, é story
  nova que substitui esta política, não um ajuste desta.
- **Liberar escrita financeira ao servo** — decisão 7.
- **Mudar a rota cheia** (`GET :id/receivables`), sua resposta ou suas permissões — decisão 9.
- **Mudar o recorte de `access_level` da timeline** ou qualquer outro filtro por role do pacote
  offline.
- **UI nova no `ops.fonte`** — a tela já existe e já funciona; só levava 403.
- **Rever base legal do tratamento financeiro** — o inventário LGPD é atualizado, mas base legal é
  assunto do `ROADMAP_LGPD.md`.
- **Story 185** (hidratação da ficha sem `houseId`) e **flakiness do Maestro** — itens próprios.
