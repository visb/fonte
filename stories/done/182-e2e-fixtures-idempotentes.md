# Plan: suítes e2e idempotentes — cada suíte cria e limpa a própria fixture

## Context

Hoje as suítes e2e **não rodam em qualquer ordem**. A única sequência que fecha verde é:

```bash
pnpm test:setup && pnpm test:api:e2e
pnpm test:setup && pnpm test:adm
```

Ou seja: reseed manual entre cada bateria. Isso foi contornado à mão nas stories 180 e 181 (o
implementer reseedou antes de cada gate), mas é ruído permanente — qualquer run de CI ou qualquer
segunda execução local sem reseed acusa falha que não é regressão de código.

O problema é **pré-existente** e independente daquelas duas stories. São três sintomas com duas
causas.

### Sintoma 1 — `residents.spec.ts` queima o carnê do seed

`apps/adm.fonte/e2e/residents.spec.ts` tem dois testes de Contribuição (linhas 476 e 518) que abrem
o **João Testador do seed**, clicam "Alterar plano" → "Salvar" para gerar o carnê e depois registram
pagamento na primeira parcela pendente (`Registrar pagamento`).

O pagamento é persistido. Num segundo run **sem reseed**, as parcelas já estão `PAID`; o botão
`Registrar pagamento` some e os dois testes falham em `expect(payButton).toBeVisible()`.

### Sintoma 2 — `storerooms.e2e-spec.ts` apaga o item do seed

`services/api/test/storerooms.e2e-spec.ts:32-37`:

```ts
afterAll(async () => {
  // catálogo unificado — limpa apenas os itens de almoxarifado
  await dataSource.query(`DELETE FROM inventory_movements WHERE kind = 'STOREROOM'`);
  await dataSource.query(`DELETE FROM inventory_items WHERE kind = 'STOREROOM'`);
  await app.close();
});
```

O comentário diz "limpa apenas os itens de almoxarifado" — mas o filtro é por `kind`, não por
autoria. O `DELETE` leva junto o **"Arroz (kg)" que o seed insere**
(`seed-test.ts:266-270`). Depois disso, `residents.spec.ts:542`
(`selectOption({ label: 'Arroz (kg)' })`) não acha a opção no `<select>` "Produto do catálogo" e o
teste "declara produtos (catálogo + avulso)" falha.

### Sintoma 3 — a mesma limpeza cega derruba a suíte inteira

Pior: se `pnpm test:adm` rodar **antes** de `pnpm test:api:e2e`, o teste de contribuição do adm deixa
uma linha em `receivable_product_contributions` apontando para o item STOREROOM. Aí o `afterAll`
acima estoura:

```
FK_rpc_inventory_item ... ON DELETE SET NULL
CHK_rpc_item_xor_description CHECK ((inventory_item_id IS NOT NULL) <> (description IS NOT NULL))
```

(`1777743139019-InitialSchema.ts:613`, `:1208-1209`.) Apagar o item zera o `inventory_item_id` da
contribuição de catálogo; como `description` já é `NULL` nessa linha, os dois lados ficam `NULL`, o
XOR quebra e **o próprio `DELETE` falha** — derrubando o `afterAll` e, com ele, a suíte.

### A causa comum

Duas regras não escritas foram violadas:

1. **Ninguém apaga linha que não criou.** O `WHERE kind = 'STOREROOM'` limpa por *categoria*, não por
   *autoria* — e a categoria inclui o seed.
2. **Ninguém deixa o estado do seed mutado.** Os testes de Contribuição consomem o carnê do João
   Testador, um recurso compartilhado, e não o devolvem.

O repo **já tem o padrão certo**, aplicado em duas suítes:

- `services/api/test/receivable-product-contributions.e2e-spec.ts` cria o próprio filho e o próprio
  item (`Arroz Contrib ${Date.now()}`), guarda os ids e limpa **por id** no `afterAll` (linhas
  49-75);
- `apps/adm.fonte/e2e/helpers/api.ts` já expõe `createTemplate`/`deleteTemplate` — fixture criada via
  API, removida no fim, com `deleteTemplate` tolerante a 404 ("o cleanup roda sobre tudo que a
  fixture criou e um template já removido não pode derrubar a suíte").

Esta story generaliza esse padrão para as suítes que ainda não o seguem.

### Decisões travadas (usuário)

1. **Fixtures por suíte**, não reseed automático. Um `globalSetup` que reseeda antes de cada bateria
   seria mais barato, mas: (a) não conserta o acoplamento **dentro** da mesma bateria — `storerooms`
   continuaria apagando o "Arroz" para as suítes backend seguintes; (b) mascara o vazamento em vez de
   removê-lo. Corrigir a causa.
2. **Incluir a catraca contra regressão** — um teste que varre os `*.e2e-spec.ts` e falha se houver
   `DELETE` em massa sobre tabela que o seed popula. Sem ela, a próxima suíte nova repete o padrão e
   o problema volta em silêncio.

### Decisões assumidas por default (rever se discordar)

3. **A catraca proíbe apenas o subconjunto perigoso.** Existem 46 `DELETE FROM` nos
   `*.e2e-spec.ts`; a maioria (`DELETE FROM events`, `DELETE FROM associates`,
   `DELETE FROM activities`, `DELETE FROM payables`, `DELETE FROM incidents`,
   `DELETE FROM street_sales`) é sobre tabela que **o seed não popula** — ninguém compartilha aquele
   estado, e proibir tudo geraria ~20 falsos positivos. A regra é: **`DELETE` sem `WHERE`
   parametrizado é proibido nas tabelas que o `seed-test.ts` popula.**
4. **`supply-room.e2e-spec.ts` entra junto.** Suas linhas 34-35 têm exatamente a mesma forma
   (`WHERE kind = 'SUPPLY_ROOM'` em `inventory_items`). Hoje é inofensivo — o seed só insere um item
   `STOREROOM` — mas é a mesma bomba armada, e a catraca do item 3 vai apontá-la de qualquer forma.
5. **Os testes de Contribuição do adm passam a usar filho próprio, criado via API.** Criar pelo
   wizard (`createResidentViaWizard`) seria lento e testaria de novo o acolhimento, que já tem
   cobertura própria. A fixture nasce em `helpers/api.ts`, ao lado de `createTemplate`.
6. **O "Arroz (kg)" continua no seed.** Outras leituras dependem dele; o que muda é que ninguém mais
   o apaga. O teste de catálogo do adm passa a criar **o próprio** item, com nome único, e a
   selecioná-lo pelo nome que criou — assim não depende nem do seed nem da ordem.
7. **Sem `globalSetup` novo e sem mudança no `pnpm test:setup`.** O seed continua sendo reset total
   (`TRUNCATE ... RESTART IDENTITY CASCADE`, `seed-test.ts:14-47`); ele só deixa de ser
   **obrigatório** entre baterias.

---

## Desenho

### 1. `services/api/test/storerooms.e2e-spec.ts` — limpar por id

Trocar a limpeza por categoria por limpeza por autoria:

- acumular num `createdItemIds: string[]` todo item criado pela suíte (os `POST /storerooms/items`
  espalhados pelos testes passam a registrar o id retornado);
- no `afterAll`, na ordem: contribuições que referenciam esses itens → movimentos desses itens →
  os itens, **todos filtrados por `= ANY($1)`**;
- **remover** os dois `DELETE ... WHERE kind = 'STOREROOM'`.

```ts
afterAll(async () => {
  if (createdItemIds.length) {
    await dataSource.query(
      `DELETE FROM receivable_product_contributions WHERE inventory_item_id = ANY($1)`,
      [createdItemIds],
    );
    await dataSource.query(`DELETE FROM inventory_movements WHERE item_id = ANY($1)`, [createdItemIds]);
    await dataSource.query(`DELETE FROM inventory_items WHERE id = ANY($1)`, [createdItemIds]);
  }
  await app.close();
});
```

A contribuição sai **antes** do item — é o que evita o `CHK_rpc_item_xor_description` do sintoma 3.
Apagar a linha inteira é correto aqui: ela é lixo de fixture, não lançamento de negócio (e o
`ON DELETE SET NULL` da FK existe para o caso de negócio, em que o item some mas a declaração fica).

O `itemBody()` (`:39`) passa a gerar nome único (`Arroz Storeroom ${Date.now()}`) para que dois runs
concorrentes ou um run interrompido não colidam nas asserções de listagem.

### 2. `services/api/test/supply-room.e2e-spec.ts` — mesma correção

Idêntico ao item 1, trocando `kind = 'SUPPLY_ROOM'` por ids acumulados. Sem contribuições envolvidas
(supply room não entra em carnê), então só movimentos → itens.

### 3. `apps/adm.fonte/e2e/helpers/api.ts` — fixtures novas

Seguindo a forma de `createTemplate`/`deleteTemplate` (mesma tolerância a 404 no delete):

```ts
export interface ResidentFixtureInput {
  name: string;
  houseId?: string;          // default: a casa do admin logado
  entryDate?: string;        // default: hoje (garante carnê com parcela pendente)
  familyInvestment?: string; // default: 'PAYMENT_700'
  contributionDueDay?: number;
}

export async function createResident(request, token, data): Promise<{ id: string; name: string }>;
export async function deleteResident(request, token, id): Promise<void>;

export async function createStoreroomItem(
  request, token, data: { name: string; unit: string; houseId: string },
): Promise<{ id: string; name: string }>;
export async function deleteStoreroomItem(request, token, id): Promise<void>;
```

- `createResident` usa `POST /residents` com `familyInvestment` pagante + `entryDate` de hoje: é o
  que faz o backend gerar o carnê com parcela pendente, sem passar pelo wizard.
- `deleteResident` usa `DELETE /residents/:id` (soft delete via `deleted_at`, conforme CLAUDE.md) e
  tolera 404.
- `deleteStoreroomItem` remove as contribuições e movimentos do item antes de removê-lo — mesma
  ordem do item 1 — para que o helper seja seguro mesmo quando o teste declarou produto.
- `houseId`: obter via `GET /staff/me` do token, como `receivable-product-contributions.e2e-spec.ts`
  já faz com `loginCoordinator`.

### 4. `apps/adm.fonte/e2e/residents.spec.ts` — filho próprio nos testes de Contribuição

Os dois testes que mutam carnê (linhas 476 e 518) ganham um filho de fixture, criado em
`beforeAll` do bloco e removido em `afterAll`:

- nome único (`Contribuinte E2E ${Date.now()}`) — não colide com a asserção
  `toHaveCount(1)` da busca por "João Testador" (`:33-39`), porque a busca filtra por nome;
- o teste do catálogo cria também **o próprio** item de almoxarifado e o seleciona pelo nome criado,
  em vez de `selectOption({ label: 'Arroz (kg)' })`;
- navegação: em vez de clicar no card da lista, buscar pelo nome da fixture antes de abrir (o filho
  novo pode não estar na primeira página).

**Não mudam:**

- o teste "lista residente criado pelo seed" (`:25`) e os demais que só **leem** o João Testador;
- o teste de dois acolhimentos (`:559`), que lê o Marcelo Reacolhido do seed sem mutá-lo — as 6
  parcelas pagas que ele assere são as do carnê **antigo**, inseridas prontas pelo seed
  (`seed-test.ts:195-204`);
- o `resetResidentsFilters()` do `beforeEach`/`afterAll`, que já é exatamente este padrão aplicado a
  preferências.

### 5. Catraca — `services/api/test/e2e-cleanup-scope.spec.ts` (novo, unit)

Roda em `pnpm test:api` (é unit, não e2e: lê arquivos, não sobe app nem banco).

- Deriva a **lista de tabelas semeadas** do próprio `seed-test.ts`, lendo o arquivo e extraindo os
  alvos de `INSERT INTO <tabela>`. Derivar em vez de hardcodar é o ponto: quando o seed passar a
  popular uma tabela nova, a catraca cobre essa tabela **sem** ninguém lembrar de atualizar uma
  lista.
- Varre `services/api/test/*.e2e-spec.ts` e `apps/adm.fonte/e2e/**/*.ts` procurando
  `DELETE FROM <tabela>`.
- **Falha** quando a tabela está na lista semeada e o `DELETE` não tem `WHERE` com placeholder
  (`$1`, `$2`, …) — isto é, não está escopado por id de fixture.
- A mensagem de falha nomeia arquivo, linha e a alternativa (`limpe por id da fixture`), no espírito
  das mensagens do `bash-guard`.

Limitação aceita e documentada no próprio spec: é análise textual, não semântica — um `DELETE` com
`$1` que por acaso apague demais passa. A catraca pega a classe de erro que já aconteceu duas vezes
(limpeza por categoria), não toda limpeza ruim concebível.

### 6. Documentação

- `CLAUDE.md`, seção "Testes" → "Pré-requisitos por tipo": trocar o aviso implícito de reseed por uma
  linha afirmativa — **as suítes e2e são idempotentes; `pnpm test:setup` é necessário só na primeira
  vez ou após mudança de schema.**
- Comentário de cabeçalho em `storerooms.e2e-spec.ts` e `supply-room.e2e-spec.ts` explicando por que
  a limpeza é por id (o comentário atual, "limpa apenas os itens de almoxarifado", é justamente o
  que induziu ao erro).

---

## Validação

### Backend — `pnpm test:api`

`e2e-cleanup-scope.spec.ts` (novo):

- extrai as tabelas semeadas do `seed-test.ts` e o conjunto não é vazio (se o parser quebrar, a
  catraca não pode passar em silêncio — este caso é o que impede a catraca de virar decoração);
- um trecho fixture com `DELETE FROM inventory_items WHERE kind = 'STOREROOM'` é **reprovado**;
- `DELETE FROM inventory_items WHERE id = ANY($1)` é **aprovado**;
- `DELETE FROM events` (tabela não semeada) é **aprovado** — prova a decisão 3;
- `DELETE FROM residents` sem `WHERE` é **reprovado**;
- rodando sobre a árvore real do repo, **não há violação** (é a asserção que trava a story).

### Backend — `pnpm test:api:e2e`

- `storerooms.e2e-spec.ts` e `supply-room.e2e-spec.ts` verdes;
- **prova da idempotência**: rodar `pnpm test:api:e2e` **duas vezes seguidas sem reseed** — verde nas
  duas. Este é o critério de aceite da story, não um detalhe;
- após a suíte de storerooms, o item "Arroz (kg)" do seed **ainda existe** — asserção explícita
  (`SELECT count(*) FROM inventory_items WHERE name = 'Arroz'` no fim da suíte, ou um spec dedicado
  de guarda);
- caso do sintoma 3 reproduzido de propósito: declarar uma contribuição de catálogo sobre um item da
  fixture e conferir que o `afterAll` limpa sem violar `CHK_rpc_item_xor_description`.

### `adm.fonte` — e2e (Playwright), `pnpm test:adm`

- os dois testes de Contribuição passam com o filho de fixture, e o filho **não** aparece mais no
  carnê do João Testador;
- **prova da idempotência**: rodar `pnpm test:adm` **duas vezes seguidas sem reseed** — verde nas
  duas;
- **prova da ordem**: `pnpm test:adm` → `pnpm test:api:e2e` (a ordem que hoje derruba a suíte) —
  verde;
- **regressão**: os demais testes de `residents.spec.ts` passam **sem mudança de expectativa**. Se
  algum precisar mudar, a fixture vazou para a listagem;
- o `afterAll` remove o filho e o item de fixture; um run interrompido não deixa filho órfão na lista
  (o delete é tolerante e o nome é único).

### `adm.fonte` — unit, `pnpm test:adm:unit`

Sem mudança de código de aplicação nesta story ⇒ nenhuma expectativa nova. A suíte roda como
regressão.

### Contratos

Nenhuma rota, DTO ou tipo muda. **Sem** `build:types`/`build:api-client` obrigatórios, **sem**
atualização do Postman, **sem** migration.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov`; **não reduzir** a cobertura de `services/api`. Os helpers de fixture
(`apps/adm.fonte/e2e/helpers/api.ts`) são código de teste e não entram no denominador de cobertura do
app — a prova deles é a própria suíte e2e passar duas vezes seguidas. Sem `skip`/`only`/`xfail` sem
justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **`globalSetup` de reseed** no Playwright ou no Jest e2e — explicitamente rejeitado (decisão 1).
- **Rodar as suítes em paralelo.** `playwright.config.ts` mantém `workers: 1` /
  `fullyParallel: false`. Fixture isolada é pré-requisito de paralelismo, mas paralelizar é outra
  story (envolve banco por worker).
- **Auditar as outras 40+ chamadas de `DELETE FROM`** em tabelas não semeadas (`events`,
  `associates`, `activities`, `payables`, `incidents`, `street_sales`, `idempotency_keys`). Elas
  seguem o contrato "a suíte é dona da tabela"; se um dia o seed passar a popular uma delas, a
  catraca acusa sozinha — que é o ponto de derivar a lista do `seed-test.ts`.
- **Mudar o `seed-test.ts`** para adicionar fixtures dedicadas por suíte. O caminho escolhido é o
  inverso: menos estado compartilhado no seed, não mais.
- **`ops.fonte` / `app.fonte`** (Maestro e `e2e-web`) — não compartilham o carnê nem o catálogo do
  seed desta forma; se aparecer o mesmo sintoma lá, é story própria.
- Corrigir a falta de cobertura de qualquer fluxo de negócio tocado de passagem — esta story mexe só
  em código de teste e infraestrutura de fixture.
