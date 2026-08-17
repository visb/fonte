# Plan: ops.fonte — ficha do filho hidratada do store não pode nascer "fresca"

## Context

Achado da rodada de autorun 182–184, diagnosticado **em aparelho** durante a story 183
(`stories/done/PROGRESS-182-184.md` → "Resumo final", achado 2). Não é regressão de nenhuma daquelas
stories: o defeito existe desde a story 175 (store SQLite dos filhos).

### O sintoma que apareceu

No `product-contributions.yaml`, a declaração de contribuição em produtos abria com o seletor de
catálogo vazio — *"Nenhum produto encontrado."* — sempre que a ficha era aberta logo após o login.
Com um `swipe` (pull-to-refresh) na ficha antes de abrir a declaração, passava. O spec hoje carrega
esse `swipe` como contorno, com comentário apontando para cá.

### A causa, provada com dump do device

1. `GET /houses/:id/residents` devolve a linha **enxuta** do filho:
   `id, name, status, entryDate, photoUrl, photoThumbUrl` — **sem `houseId`**.
2. O store local grava essa linha como está. Dump do SQLite do aparelho, para o Marcelo Reacolhido:
   `{"id":…,"name":"Marcelo Reacolhido","status":"ACTIVE","entryDate":…,"photoUrl":null,"photoThumbUrl":null}`.
3. `hydrateResidentQueries` (`apps/ops.fonte/lib/offline/store/hydrate.ts:72-74`) semeia essa linha na
   chave de **detalhe** (`queryKeys.residents.detail(id)`) e **para aí** — sem chamar
   `needsServerConfirmation`, que a mesma função aplica a `residents.byHouse` e
   `residents.countByHouse` nas linhas 68-69, pelo motivo que o comentário ali já explica ("semear
   como dado fresco faria essas telas **nunca** buscarem").
4. Com `staleTime: 30_000` (`apps/ops.fonte/lib/queryClient.ts:31`), a ficha aberta dentro dos
   primeiros 30s **não rebusca**. `resident.houseId` fica `undefined`.
5. `ResidentDetailPage.tsx:112` então passa `houseId: ''`; `useInventoryCatalog('')` fica
   `enabled: false` (não havia **nenhuma** query `inventory-catalog` no cache persistido do device) →
   seletor vazio.

### O segundo efeito, do mesmo `houseId` vazio

`ResidentDetailPage.tsx:138` esconde o `ChangeMinistryModal` enquanto a ficha vier do store. Ou seja:
**trocar o ministério do filho fica indisponível** na mesma janela. É o mesmo bug, não outro — entra
nesta story (decisão 3).

O `swipe` mascarava os dois porque o refetch traz a ficha completa do servidor, com `houseId`.

### Decisões travadas (usuário)

1. **Consertar na hidratação, não no backend.** A linha enxuta de `GET /houses/:id/residents` é
   deliberada (payload e minimização de dado pessoal — o snapshot da story 177 é o mesmo desenho);
   engordá-la para acomodar uma tela é mover o problema. O defeito real é a chave de detalhe nascer
   fresca a partir de um dado que **sabidamente** é parcial.
2. **O `swipe` sai do `product-contributions.yaml` nesta story.** Contorno que sobrevive à correção
   vira folclore: ninguém depois sabe se ainda é necessário. A remoção é parte da prova de que o
   conserto funciona.
3. **O `ChangeMinistryModal` entra na mesma story.** É o mesmo `houseId` vazio, no mesmo componente,
   na mesma janela de 30s. Duas stories para uma causa só duplicariam a validação.

### Decisões assumidas por default (rever se discordar)

4. **`needsServerConfirmation` na chave de detalhe, e nada mais.** É exatamente o tratamento que a
   função já dá às outras chaves cujo conteúdo do store é subconjunto do que a tela precisa. Não
   inventa mecanismo: `invalidateQueries({ exact: true, refetchType: 'none' })` deixa a tela abrir com
   o dado do disco (o ponto do offline-first: `ops.fonte` roda sem sinal, invariante do `CLAUDE.md`) e
   busca ao montar **quando houver rede**. Sem sinal, nada é queimado em tentativa.
5. **`staleTime` global não muda.** Baixar os 30s "resolveria" o sintoma e degradaria o app inteiro —
   e não conserta o caso real de abrir a ficha **offline**, em que refetch nenhum vai acontecer.
6. **A linha do store continua parcial; nada de completar `houseId` no cliente.** Deduzir o
   `houseId` da casa que agrupa a lista seria correto hoje e silenciosamente errado no dia em que o
   filho mudar de casa — o servidor é a verdade sobre vínculo.
7. **Sem mudança de contrato, de endpoint, de migration ou de Postman.** Nada sai de
   `apps/ops.fonte/lib/offline/` + o yaml do e2e.
8. **`ResidentDetailPage.tsx` não muda.** As guardas de `:112` e `:138` estão **certas** — a tela não
   deve chamar catálogo nem oferecer troca de ministério com `houseId` vazio. O que estava errado era
   ela receber `houseId` vazio de um dado marcado como fresco.

---

## Desenho

### 1. `apps/ops.fonte/lib/offline/store/hydrate.ts`

No laço de `dump.residents` (`:72-74`), marcar a chave semeada como pendente de confirmação, igual às
linhas 68-69:

```ts
for (const entry of dump.residents) {
  const detail = queryKeys.residents.detail(entry.data.id);
  seed(queryClient, detail, entry.data, entry.updatedAt);
  // A linha guardada é a **enxuta** da listagem da casa (sem `houseId`, entre
  // outros) — a ficha precisa de mais que isso. Semear como fresco fazia a tela
  // nunca buscar dentro do `staleTime`, e `houseId` vazio derrubava o catálogo de
  // produtos e escondia a troca de ministério.
  needsServerConfirmation(queryClient, detail);
}
```

Comentário obrigatório: é a terceira vez que "semear como fresco" morde, e o que impediu o
`byHouse` de repetir o erro foi justamente o comentário que já está lá.

### 2. `apps/ops.fonte/e2e/product-contributions.yaml`

Remover o `swipe` de contorno e o comentário que aponta para esta story. O restante do fluxo
(login como coordenador, busca do Marcelo Reacolhido, declaração) fica **inalterado** — se algo mais
precisar mudar, a causa não era esta.

### 3. Nada mais

Sem backend, sem `packages/types`/`api-client`, sem migration, sem Postman, sem `seed-test.ts`, sem
mudança em `ResidentDetailPage.tsx`, `queryClient.ts` ou no schema do store.

---

## Validação

### `ops.fonte` — unit (Jest/RTL), `pnpm test:ops:unit`

Estender o teste de `hydrate` (ao lado dos casos que já cobrem `byHouse`/`countByHouse`):

- depois de `hydrateResidentQueries`, a chave `residents.detail(id)` **tem os dados do store** (a
  tela abre com dado — o offline-first não regride) **e** está marcada como `isStale`/invalidada;
- **regressão direta do bug**: com a linha enxuta no store (sem `houseId`) e um `queryClient` com
  `staleTime: 30_000`, a query de detalhe é considerada stale ⇒ o consumidor refetcha ao montar. Sem
  a correção este caso falha — é o teste que trava a story;
- `refetchType: 'none'`: a marcação **não** dispara busca durante a própria hidratação (contagem de
  chamadas do mock de rede em zero) — é o que garante que boot offline não queima tentativa;
- os casos existentes de `byHouse`, `countByHouse`, detalhes (`follow_ups`, `attachments`,
  `consents`, `receivables`) e ministérios passam **sem mudança de expectativa**;
- `updatedAt` do disco continua sendo respeitado no seed (a tela não mente sobre frescor).

Se houver teste de `ResidentDetailPage` que hoje dependa da ficha vir fresca do store, ele **não**
deve precisar de edição — se precisar, a correção vazou para além da hidratação.

### `ops.fonte` — Maestro, `pnpm test:ops`

Pré-requisitos: emulador/aparelho **API ≤ 34**, APK de release via
`pnpm --filter ops.fonte build:e2e:android` (story 184), `pnpm test:setup` imediatamente antes.

- `product-contributions.yaml` verde **sem o `swipe`**, incluindo
  `"Contribuição em produtos declarada."` — é o critério de aceite da story;
- **a suíte fecha 13/13**, sem edição nos outros 12 fluxos;
- ciente da flakiness conhecida de launch do driver (`census`/`dashboard`, ver BACKLOG): falha de ~7s
  no launch se reproduz isolando o fluxo antes de culpar esta mudança.

### Prova manual do segundo efeito (uma vez)

Abrir a ficha de um filho **nos primeiros 30s** após o login, com rede: o `ChangeMinistryModal` está
disponível (hoje não está). Sem rede: a ficha abre com o dado do disco e o modal segue escondido — o
comportamento correto, não regressão.

### Gate de cobertura (trava a story)

Story frontend-only, em `lib/offline/`: rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura do
`ops.fonte` (baseline da rodada 182–184: 94.5 stmt / 85.2 br / 93.15 fn / 95.6 ln; thresholds
90/81/89/93). Todo caminho novo ou alterado tem teste correspondente — código novo sem teste não
fecha a story. Sem `skip`/`only`/`xfail` sem justificativa explícita no código (`CLAUDE.md`).

---

## Fora de escopo

- **Engordar `GET /houses/:id/residents`** com `houseId` (ou qualquer outro campo) — rejeitado na
  decisão 1.
- **Mexer no `staleTime` global** (`lib/queryClient.ts`) — decisão 5.
- **Mudar `ResidentDetailPage.tsx`**: as guardas de `houseId` vazio estão corretas — decisão 8.
- **Liberar a declaração de contribuição em produtos ao SERVANT** (`GET /residents/:id/receivables` é
  `@Roles(ADMIN, COORDINATOR)`) — é o outro item do BACKLOG e é decisão de backend.
- **Flakiness de launch do Maestro** (`census`, `dashboard`) — item próprio do BACKLOG.
- **Auditar as outras chaves semeadas pela hidratação** em busca do mesmo padrão. As de `dump.details`
  guardam a resposta **inteira** do endpoint que a tela consome, não um subconjunto — não têm o
  defeito. Se um dia alguma passar a guardar recorte, o comentário do item 1 é o aviso.
- **`app.fonte`** — não tem store local; nada a replicar.
