# Plan: criar produto do catálogo direto da declaração de contribuição

## Context

Na declaração de contribuição em produtos, o modo **catálogo** só oferece o que já está cadastrado
(`CatalogProductPicker`, story 114). Quando a família traz algo que não está no catálogo da casa, o
servo tem duas saídas ruins: cair no **modo avulso** (texto livre, que não mexe no estoque e nasce
com `pending_detailing = true` para alguém distrinchar depois), ou abandonar a declaração, ir até a
Dispensa/Almoxarifado, cadastrar o produto e voltar. Na prática o que acontece é o primeiro — e o
estoque não sobe.

A boa notícia do levantamento: **a parte cara já está construída e provada**. A tela de movimentação
da Dispensa (`features/storeroom/pages/MovementPage.tsx:88-105`) já cadastra item na hora e lança a
movimentação em seguida, inclusive sem sinal, usando `lib/offline/localIds.ts` — id sintético
`local:<uuid>` que entra no cache, é escolhido no formulário, e é resolvido para o id real no envio
(`resolveLocalId`). Se o cadastro for recusado, a movimentação falha com `UnresolvedLocalIdError` e
vai para `/sync` com motivo — nada é descartado em silêncio.

Esta story é aplicar esse mesmo padrão ao `CatalogProductPicker`, com uma complicação que a tela da
Dispensa não tem: **o catálogo da declaração é a união de dois inventários**. `useInventoryCatalog`
junta `storeroom.listItems` (a **Dispensa** na UI) e `supplyRoom.listItems` (o **Almoxarifado**) num
array só. Criar um item exige dizer em qual dos dois — e o Almoxarifado ainda pede `category`, que a
Dispensa não tem. (Atenção ao nome interno invertido, documentado em `outbox.ts:59`: `storeroom` é a
Dispensa, `supplyRoom` é o Almoxarifado.)

### Decisões travadas (usuário)

1. **O servo escolhe o destino, com Dispensa como padrão.** Comida é o caso comum de contribuição de
   família, então o formulário abre marcado em Dispensa. Escolher Almoxarifado **revela** o campo de
   categoria, obrigatório só lá.
2. **Dá para criar sem sinal**, encadeado por id local — o padrão da story 171, decisão 2. É a parte
   mais cara da story, e é o que impede a criação offline de virar um item perdido.
3. **Entra nos dois apps.** O `RegisterPaymentDialog` do `adm.fonte` usa o mesmo catálogo
   (`RegisterPaymentDialog.tsx:95`); quem registra pagamento no escritório esbarra no mesmo produto
   faltando. Lá é online, então sai barato.

### Decisões de desenho derivadas (do levantamento no código)

4. **Nada de endpoint novo.** `POST /storeroom/items` e `POST /supply-room/items` já existem, já são
   idempotentes e já estão na outbox (`OUTBOX_MUTATION_KEYS.storeroomCreateItem` /
   `supplyRoomCreateItem`). A story é de frontend e de fiação offline; o backend só ganha teste.
5. **O item criado não entra por uma mutation nova.** Reusar as chaves existentes é o que faz o item
   aparecer nas telas de estoque e na fila de pendências com o rótulo certo (*"Novo item da
   dispensa"* / *"Novo item do almoxarifado"*, já em `OUTBOX_LABELS`). Chave nova significaria
   rótulo novo, replay novo e um item que a tela de estoque não reconhece.
6. **A criação acontece dentro do picker, não numa tela separada.** Quando a busca não casa com nada,
   o dropdown passa a oferecer **"Cadastrar «<termo digitado>»"** — o nome já vem preenchido do que
   o servo digitou. Mandar para outra tela e voltar é o fluxo que a story existe para eliminar.
7. **Criar não é declarar.** O item entra no catálogo e é **selecionado** na linha; a quantidade
   continua sendo preenchida pelo servo e a declaração só acontece no submit do formulário. Criar o
   produto e sair da tela deixa o produto no catálogo e nenhuma contribuição lançada — que é o
   correto: catálogo é cadastro da casa, não do lançamento.
8. **Offline, o item local não vaza para fora da casa.** O id `local:` só existe no dispositivo; o
   `resolveLocalId` roda no envio da declaração, então o backend **nunca** vê um id local. A linha da
   contribuição criada offline com item local herda o modo catálogo (não vira avulso).
9. **Recusa do cadastro derruba a declaração junto, com motivo.** Se o `createItem` for rejeitado
   (nome duplicado, por exemplo), o mapeamento nunca existe e a declaração falha com
   `UnresolvedLocalIdError` em `/sync` — comportamento já implementado, que a story só passa a
   exercer. O texto da pendência precisa dizer qual produto ficou pendente, senão o servo não tem o
   que reenviar.
10. **A unidade é campo livre, como nas telas de estoque.** Não inventar lista fechada de unidades
    aqui: divergir do cadastro que já existe criaria dois vocabulários para o mesmo catálogo.
11. **No `adm.fonte` não há id local.** Online sempre: cria, espera o id real, seleciona. O dialog de
    criação é `react-hook-form` + `zod` (CLAUDE.md), dentro do `RegisterPaymentDialog` já aberto —
    dialog sobre dialog, com o foco devolvido ao picker no fechamento.

---

## Desenho

### 1. Backend e contratos

Nenhuma mudança. `CreateItemInput` (`name`, `unit`, `houseId`) e `CreateSupplyItemInput`
(`name`, `unit`, `category`, `houseId`) já são o que o formulário precisa.
`fonte-api.postman_collection.json` sem alteração — nenhuma rota nasce ou muda.

### 2. `ops.fonte` — o picker

**`CatalogProductPicker`** ganha, quando `filtered.length === 0` e há termo digitado, a linha
*Cadastrar «termo»* no fim do dropdown. Tocar abre o formulário inline (decisão 6):

```
Novo produto
  Nome    [ Arroz tipo 1        ]   ← pré-preenchido com a busca
  Unidade [ pacote              ]   ← livre (decisão 10)
  Onde    (●) Dispensa
          ( ) Almoxarifado
            └ Categoria [ ▾ ]       ← só quando Almoxarifado (decisão 1)
  [ Cancelar ]            [ Cadastrar ]
```

O componente passa a receber `houseId` e um callback `onCreated(item)`; a criação em si **não** mora
nele — ele é apresentação. Quem cria é a página.

**`DeclareProductContributionPage`** ganha `handleCreateItem`, espelhando
`MovementPage.tsx:88-105`:

```ts
function handleCreateItem({ name, unit, target, category }: NewProductInput) {
  const localId = createLocalId();
  const submit = target === 'supply' ? submitSupplyItem : submitStoreroomItem;

  submit(
    { name, unit, houseId, localId, ...(target === 'supply' ? { category } : {}) },
    {
      onSent:   (item) => selectItem(line, item.id, item.name, unit),
      onQueued: ()     => selectItem(line, localId, name, unit),   // decisão 2
      onFailed: (err)  => Alert.alert('Erro', getErrorMessage(err, 'Não foi possível cadastrar o produto.')),
    },
  );
}
```

O item recém-criado entra no cache do catálogo pelo `onMutate` que as chaves de `createItem` já têm,
então aparece no dropdown das **outras** linhas do mesmo formulário sem refetch.

**`useInventoryCatalog`** passa a marcar a origem de cada item (`source: 'storeroom' | 'supply'`) —
hoje ela é descartada no `map` (`useProductContributions.ts:33`). Sem isso, o item criado offline não
tem como ser reexibido com o rótulo do inventário certo.

**Nenhuma mudança em `lib/offline/`**: chaves, defaults, `localIds` e `outbox` ficam como estão
(decisões 4 e 5).

### 3. `adm.fonte` — o dialog

- `CatalogProductPicker` do `adm` (dentro de `RegisterPaymentDialog`) ganha a mesma opção
  *Cadastrar «termo»* quando a busca não casa.
- **`CreateInventoryItemDialog`** novo em `features/residents/components/`, autossuficiente:
  `react-hook-form` + `zod`, schema discriminado por destino (Almoxarifado exige `category`),
  `useCreateStoreroomItem` / `useCreateSupplyItem` (hooks já existentes nas features de estoque —
  reusar, não duplicar).
- No sucesso: invalida o catálogo, seleciona o item novo na linha e fecha (decisão 11). Erro por
  `getErrorMessage`, sucesso por `toast.success`.

---

## Validação

### Backend — `pnpm test:api`

Só regressão: `POST /storeroom/items` e `POST /supply-room/items` continuam idempotentes por
`Idempotency-Key` (reenvio da fila não duplica item). Nenhum código novo.

### `ops.fonte` — unit (`pnpm test:ops:unit`)

- **`CatalogProductPicker`**: a opção *Cadastrar «x»* aparece só com busca sem resultado e some
  quando há resultado; o nome digitado chega pré-preenchido no formulário; escolher Almoxarifado
  revela a categoria e a torna obrigatória; escolher Dispensa a esconde e **não** a envia.
- **`handleCreateItem`**: destino `storeroom` chama a mutation da Dispensa e `supply` a do
  Almoxarifado, cada uma com o payload certo (a inversão de nomes de `outbox.ts:59` é o erro fácil —
  o teste existe para travá-la).
- **Offline (decisão 2)**: `onQueued` seleciona o `local:<uuid>` na linha; o item aparece no dropdown
  das demais linhas; submeter a declaração com item local monta a linha em **modo catálogo**, não
  avulso (decisão 8).
- **Criar e sair sem declarar** (decisão 7): o produto fica no catálogo e **nenhuma** contribuição é
  enviada.
- `useInventoryCatalog` devolve `source` por item e continua ordenando por nome em pt-BR.

### `ops.fonte` — offline e2e (Playwright web, `e2e-web/`)

O teste que prova a story:

1. `setOffline(true)` → na declaração, buscar produto inexistente → *Cadastrar* → item selecionado na
   linha → preencher quantidade → declarar.
2. **Recarregar o app ainda offline** → os dois itens da fila continuam lá (cadastro e declaração).
3. `setOffline(false)` → o cadastro sobe primeiro, a declaração sobe com o id **real** (asserção de
   que nenhum `local:` chegou ao servidor — decisão 8) e o estoque sobe uma vez só.
4. Caso da decisão 9: servidor recusa o cadastro → a declaração aparece em `/sync` com
   `UnresolvedLocalIdError` e o texto **nomeia o produto pendente**.

### `adm.fonte` — unit (Vitest/RTL)

- `CreateInventoryItemDialog`: submit bloqueado sem nome ou unidade; Almoxarifado sem categoria
  bloqueia; Dispensa não envia `category`; erro do backend chega pela frase do backend via
  `getErrorMessage`.
- `RegisterPaymentDialog`: criar produto seleciona o item novo na linha e mantém o dialog de
  pagamento aberto com o restante do formulário preservado (o campo de valor não pode ser zerado ao
  fechar o dialog de cima).

### `adm.fonte` — e2e (Playwright)

Registrar pagamento com contribuição em produto: buscar produto inexistente → cadastrar na Dispensa →
declarar → o item aparece no estoque da casa com o movimento de entrada.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:ops:unit` e `pnpm test:adm:unit` com cobertura;
**não reduzir** a cobertura das features `residents` dos dois apps. Obrigatoriamente cobertos: o
roteamento de destino da decisão 1 (incluindo a inversão de nomes) e o caminho de id local das
decisões 2, 8 e 9. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Editar ou excluir produto do catálogo** pela declaração — só criação. Correção é nas telas de
  Dispensa/Almoxarifado.
- **Lista fechada de unidades** (decisão 10) e normalização de nomes duplicados no catálogo
  (*"arroz"* vs *"Arroz"*) — o cadastro atual já aceita os dois e esta story não muda isso.
- **Converter linha avulsa em item de catálogo** (`pending_detailing`): continua fora do app.
- **Criar produto a partir da fila de contribuições** da story 195 — a criação vive no formulário de
  declaração.
- **`app.fonte` e `portal.fonte`** — não declaram contribuição em produtos.
