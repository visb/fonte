# Plan: ops.fonte — consertar os dois fluxos Maestro vermelhos (dispensa e contribuição em produtos)

## Context

A suíte `pnpm test:ops` rodou pela primeira vez em aparelho em 2026-08-16 (commit `9ac1944`) e
fechou **11/13**. Os dois que sobraram são anteriores a essa execução: os specs foram escritos junto
com as features, mas nunca tinham sido executados, então ninguém viu que não passavam.

Nenhum dos dois é regressão de código — os dois são o spec pedindo algo que a tela não entrega
naquele estado.

### `storeroom.yaml` — o item nunca chega a ser selecionado

O fluxo abre "Dispensa" → "Movimentar item" → digita "Arroz" no campo de busca → toca em "Arroz" →
preenche quantidade → "Registrar entrada", e espera
`"Movimentação registrada com sucesso."`. O que acontece de verdade, conferido em tela: o formulário
fica com o erro **"Selecione um item"** e o dropdown oferece só **`+ Cadastrar "Arroz"`**.

Duas causas somadas:

1. **Seletor ambíguo.** Depois do `inputText`, o próprio `TextInput` passa a conter o texto "Arroz".
   O `tapOn: "Arroz"` casa com o **campo**, não com a linha do dropdown — o `onSelect` nunca roda e
   `selectedItemId` fica vazio. As linhas do dropdown
   (`features/storeroom/components/ItemSearchInput.tsx:76-87`) não têm `testID` nem
   `accessibilityLabel`; o único texto que as identifica é o nome do item, que é exatamente o texto
   já digitado.
2. **Corrida com o carregamento.** `showCreateOption` é
   `value.trim().length > 0 && filteredItems.length === 0` (`ItemSearchInput.tsx:37`). Ver
   `+ Cadastrar "Arroz"` prova que `items` estava **vazio** no momento em que o texto foi digitado —
   o `useStoreroomItems(staff?.houseId)` da `MovementPage` (`:47`) ainda não tinha resolvido. O
   spec vai de "Movimentar item" direto para o campo, sem esperar a lista.

### `product-contributions.yaml` — o filho do spec não tem carnê

O fluxo entra no **João Testador** e espera `"Parcela"` na tela de declaração. A tela devolve
`EmptyState` com *"Nenhuma parcela disponível para declarar contribuição."*, porque
`DeclareProductContributionPage.tsx:88-95` corta em `if (!receivable)`.

Motivo, no seed: **João Testador é inserido sem plano de contribuição** —
`seed-test.ts:132-136` grava só `name/house_id/status/entry_date/user_id`, sem `family_investment`.
Sem plano não há carnê, sem carnê não há parcela. (É por isso que o e2e do `adm.fonte` faz
"Alterar plano" → "Salvar" antes de tocar em parcela do João.)

**Marcelo Reacolhido**, do mesmo seed, nasce com `family_investment = 'BASKET_500'` e
`contribution_due_day = 10` (`seed-test.ts:166-171`) e tem acolhimento atual em aberto — o carnê
vigente se materializa sozinho. É o filho certo para este fluxo.

### Decisões travadas (usuário)

1. Os dois fluxos entram na mesma story; o build reproduzível do e2e do ops fica na story 184.

### Decisões assumidas por default (rever se discordar)

2. **`product-contributions.yaml` troca de filho, o seed NÃO muda.** Dar plano ao João Testador
   resolveria também, mas ele é o filho "base" lido por vários outros specs (ops e adm) e por
   `residents.spec.ts`, que hoje conta com ele **sem** carnê para exercitar o "Alterar plano". Mudar
   o seed para acomodar um spec é mover o risco para sete outros. Marcelo já existe exatamente com o
   estado que este fluxo precisa.
3. **As linhas do dropdown ganham `accessibilityLabel`** (`Selecionar <nome>`), em vez de o spec
   se virar com `index:` ou coordenadas. É código de app, mas é a mesma escolha que o repo já fez em
   `CensusListItem` (`Detalhes de X`, `Confirmar X`, `Remover X`) — alvo nomeado, não posicional. Um
   `tapOn` por índice quebra na primeira linha nova no dropdown.
4. **`supply-room` acompanha.** `features/supply-room/components/ItemSearchInput.tsx` é o espelho do
   componente da dispensa e tem o mesmo buraco. Não há spec de almoxarifado hoje, mas deixar os dois
   divergindo garante que o próximo spec repita o bug.
5. **Esperar a lista com `assertVisible` do item na tela anterior**, não com `sleep`. A tela de
   Dispensa já lista "Arroz" antes de abrir "Movimentar item"; dentro do formulário, a espera é pela
   linha do dropdown (que só existe depois de `items` carregar). Nada de espera cega.

---

## Desenho

### 1. `features/storeroom/components/ItemSearchInput.tsx`

A `TouchableOpacity` de cada linha do dropdown (`:77-87`) ganha:

```tsx
accessibilityLabel={`Selecionar ${i.name}`}
```

Nada mais muda: mesmo layout, mesmo `onPress`, mesmo texto visível.

### 2. `features/supply-room/components/ItemSearchInput.tsx`

Mesma adição, pelo motivo da decisão 4.

### 3. `e2e/storeroom.yaml`

```yaml
- tapOn: "Buscar item..."
- inputText: "Arroz"
# A lista vem do `useStoreroomItems`; sem esperar a linha do dropdown, o
# `tapOn` cai no próprio campo (que agora contém "Arroz") e o item nunca é
# selecionado — o formulário morre em "Selecione um item".
- assertVisible: "Selecionar Arroz"
- tapOn: "Selecionar Arroz"
```

O resto do fluxo (quantidade, `hideKeyboard`, "Registrar entrada", asserção do sucesso) fica
**inalterado** — se algo mais precisar mudar, a causa não era esta.

### 4. `e2e/product-contributions.yaml`

- Troca o filho: buscar e abrir **"Marcelo Reacolhido"** em vez de "João Testador" (o fluxo já
  entra pela aba Filhos; usar o campo de busca como `residents.yaml` faz).
- Comentário de cabeçalho passa a dizer **por que** é esse filho: é o único do seed que nasce com
  plano de contribuição, logo o único com parcela para declarar.
- As linhas do catálogo dentro da declaração usam o mesmo padrão do item 3 se o seletor de produto
  sofrer da mesma ambiguidade — verificar na execução; se o componente for outro, adaptar sem
  inventar alvo novo.

### 5. Sem mudança de backend, contrato ou seed

Nenhuma rota, DTO, tipo, migration ou `seed-test.ts` é tocado. Sem Postman.

---

## Validação

### `ops.fonte` — unit (Jest/RTL), `pnpm test:ops:unit`

`features/storeroom/components/ItemSearchInput.test.tsx` (estender o existente):

- cada linha do dropdown expõe `accessibilityLabel` = `Selecionar <nome do item>`;
- tocar por esse label dispara `onSelect` com o item correto (prova que o alvo novo é o alvo certo,
  não só que existe);
- com `items` vazio e texto digitado, aparece `+ Cadastrar "<texto>"` e **nenhum**
  `Selecionar ...` — é exatamente o estado que derrubava o e2e, agora coberto por unit;
- **regressão**: os testes atuais do componente passam sem mudança de expectativa.

`features/supply-room/components/ItemSearchInput.test.tsx` (ou `ItemSearchInputExtra.test.tsx`):
mesmo caso do label, para não deixar o espelho sem prova.

### `ops.fonte` — Maestro, `pnpm test:ops`

Pré-requisitos da story 184 (emulador API 34 + APK com cleartext). Com o banco recém-semeado
(`pnpm test:setup`):

- `storeroom.yaml` verde de ponta a ponta, incluindo
  `"Movimentação registrada com sucesso."`;
- `product-contributions.yaml` verde, incluindo `"Contribuição em produtos declarada."`;
- **a suíte inteira fecha 13/13** — é o critério de aceite da story, não só os dois fluxos isolados;
- **regressão**: os 11 fluxos que já passavam continuam passando, sem edição.

### Gate de cobertura (trava a story)

Story frontend-only: rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de
`features/storeroom` e `features/supply-room`. Todo caminho novo ou alterado tem teste
correspondente. Sem `skip`/`only`/`xfail` sem justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Build/ambiente do e2e do ops** (cleartext, API 34, ABI) — é a story 184, e é pré-requisito para
  rodar a validação Maestro desta aqui.
- **Mudar o `seed-test.ts`** para dar plano ao João Testador — rejeitado na decisão 2.
- **Criar spec de almoxarifado** (`supply-room`): o componente é corrigido junto, mas o fluxo Maestro
  novo é outra story.
- **Determinismo entre suítes** (reseed, fixtures por suíte) — é a story 182.
- **Marcar notificação como lida** no `notifications.yaml`: foi tirado do spec por não ser
  determinístico com o seed atual; recolocar exige fixture própria, que é assunto da 182.
- Qualquer mudança de layout, de regra de negócio da movimentação de estoque ou da declaração de
  contribuição. Esta story só torna alcançável o que já existe.
