# Plan: "Declarar saída da comunidade" e "Transferir de casa" como ações separadas na lista de filhos

## Context

A story 196 pôs na lista de filhos, no `adm.fonte` e no `ops.fonte`, o menu `⋮` com **"Remover da
casa"**. Esse item abre um único diálogo com três ações: alta, evasão e transferência para outra
casa.

Pedido do backlog: trocar o termo para **"Declarar saída da comunidade"**. "Remover" soa como
apagar o cadastro (e no `adm` fica ao lado de *Excluir*, que de fato apaga); o que a ação faz é
registrar que o filho saiu.

O termo novo não serve para a transferência: o filho transferido continua na comunidade, só muda de
casa. Por isso a troca de texto vira uma separação de ações.

### Decisões travadas (usuário)

1. **Separar as ações.** O `⋮` passa a ter dois itens:
   - **Declarar saída da comunidade** → alta ou evasão, com a data do acontecimento.
   - **Transferir de casa** → casa de destino.
2. **Nos dois apps** (`adm.fonte` e `ops.fonte`), com o mesmo termo. O backlog citava só o admin;
   o usuário estendeu ao `ops` para os dois apps não divergirem.

### Decisões de desenho derivadas

3. **Rótulos em `@fonte/types`**, ao lado de `RESIDENT_REMOVAL_LABELS` (story 196), para os dois
   apps não escreverem o termo cada um à sua maneira.
4. **Um componente por app, com `mode`** (`'exit' | 'transfer'`) em vez de dois componentes novos.
   O diálogo/modal já tem os dois ramos de campos; o `mode` só decide quais ações aparecem e o
   título. Duplicar o componente duplicaria a validação e o envio.
5. **Gates e backend não mudam.** Os dois itens seguem o gate da story 196: ADMIN/COORDINATOR, filho
   em `REMOVABLE_RESIDENT_STATUSES`. O guard de transição do `ResidentService.update` continua o
   mesmo. Sem rota nova, sem mudança de contrato, sem Postman.
6. **`mutationKey`s do ops intactas.** As três hooks de `useResidentRemoval.ts` não mudam; trocar a
   chave abandonaria na fila offline o lançamento pendente de quem atualizou o app.
7. **A contagem do `ops` (`CensusPage`) não muda.** Ela usa o `RemoveResidentModal` com as três
   ações e título "Remover filho". O modal ganha `mode` opcional; sem `mode`, comportamento atual
   (as três ações), então a contagem segue igual.

---

## Desenho

### 1. `packages/types`

```ts
export type ResidentRowAction = 'exit' | 'transfer';

export const RESIDENT_ROW_ACTION_LABELS: Record<ResidentRowAction, string> = {
  exit: 'Declarar saída da comunidade',
  transfer: 'Transferir de casa',
};

/** Quais ações de baixa cada item do menu oferece. */
export const RESIDENT_ROW_ACTIONS: Record<ResidentRowAction, ResidentRemovalAction[]> = {
  exit: ['discharge', 'evade'],
  transfer: ['transfer'],
};
```

`pnpm build:types` depois.

### 2. `adm.fonte`

- **`ResidentCard`**: o `⋮` passa de *Remover da casa* + *Excluir* para
  *Declarar saída da comunidade* + *Transferir de casa* + *Excluir* (este segue ADMIN-only, em
  vermelho, com o `AlertDialog` atual). A prop `onRemove` vira `onRemove(mode: ResidentRowAction)`.
  Atualizar o comentário das linhas 201-203.
- **`ResidentsPage`**: `removeTarget` passa a guardar `{ resident, mode }`.
- **`RemoveResidentDialog`** recebe `mode`:
  - título = `RESIDENT_ROW_ACTION_LABELS[mode]`;
  - `exit`: o select "O que aconteceu?" lista só alta e evasão, com o campo de data;
  - `transfer`: sem select de ação; mostra direto "Casa de destino".
- **`useResidentRemovalForm(resident, mode, onClose)`**: o default do form vem do `mode`
  (`exit` → `discharge` + data de hoje; `transfer` → `transfer` + `targetHouseId: ''`). O schema
  discriminado não muda.

### 3. `ops.fonte`

- **`ResidentRowMenuSheet`**: dois itens (*Declarar saída da comunidade*, ícone `exit-outline`,
  vermelho; *Transferir de casa*, ícone `swap-horizontal-outline`, azul). `onRemove` vira
  `onSelect(mode)`.
- **`ResidentsPage`**: guarda o `mode` escolhido e passa para o modal.
- **`RemoveResidentModal`**: prop `mode?: ResidentRowAction`. Com `mode`, filtra `ACTIONS` por
  `RESIDENT_ROW_ACTIONS[mode]`, pré-seleciona a ação quando sobra uma só (transferência) e usa o
  rótulo como título. Sem `mode`: tudo como hoje (contagem, decisão 7). Envio, `useFieldSubmit` e
  fluxo offline não mudam.

---

## Validação

### `packages/types`

- `pnpm build:types` passa.
- `RESIDENT_ROW_ACTIONS` cobre as três ações de `ResidentRemovalAction` exatamente uma vez (teste
  simples onde as constantes já são testadas, ou no unit de um dos apps).

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- **`ResidentCard`**: ADMIN vê *Declarar saída da comunidade*, *Transferir de casa* e *Excluir*;
  COORDINATOR vê os dois primeiros e não vê *Excluir*; filho fora de `REMOVABLE_RESIDENT_STATUSES`
  não vê nenhum dos dois; cada item chama `onRemove` com o `mode` certo. O texto "Remover da casa"
  não aparece mais.
- **`RemoveResidentDialog`**:
  - `mode="exit"`: título certo; o select tem só alta e evasão (sem transferência); a data é
    obrigatória.
  - `mode="transfer"`: sem select de ação; casa de destino obrigatória; a casa atual não aparece
    entre as opções.
- **`useResidentRemovalForm`**: o default respeita o `mode`; o envio de transferência manda só
  `houseId`, e o de saída manda `status` + `exitDate`.
- Atualizar os specs da story 196 que procuram "Remover da casa".

### `adm.fonte`: e2e (Playwright, `e2e/residents.spec.ts`)

Ajustar o bloco "remover da casa pela lista": `⋮` → *Declarar saída da comunidade* → alta com
data → o filho sai dos ativos. Novo caso: `⋮` → *Transferir de casa* → o filho aparece na casa de
destino. Fixture própria via API, removida no `afterAll` (story 182).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`ResidentRowMenuSheet`**: dois itens, cada um chama `onSelect` com o `mode` certo.
- **`ResidentsPage`**: escolher cada item abre o modal com o filho e o `mode` certos.
- **`RemoveResidentModal`**: com `mode="exit"` mostra só alta e evasão; com `mode="transfer"` só a
  lista de casas, já selecionada a ação; **sem `mode`** mostra as três (regressão da contagem).
- As `mutationKey`s continuam `OUTBOX_MUTATION_KEYS.residentUpdateStatus` (decisão 6). Os specs
  existentes já cobrem isso e passam sem mudar a expectativa.

### `ops.fonte`: offline e2e (Playwright web, `e2e-web/offline-field-flows.spec.ts`)

Trocar os cliques em "Remover da casa" (linhas 334 e 399) pelo item novo. O fluxo offline
(fila, recarregar, replay único, 400 em `/sync`) continua passando sem outra mudança.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:adm:unit` e `pnpm test:ops:unit` com cobertura,
sem reduzir a cobertura das features `residents` dos dois apps. Sem `skip`/`only`/`xfail` sem
justificativa explícita no código. Backend não muda; `pnpm test:api` só precisa continuar verde.

---

## Fora de escopo

- **Contagem do `ops`** (decisão 7): continua com o modal de três ações e o título "Remover filho".
- **Ação na ficha do filho**: segue só na lista, como decidido na story 196.
- **Backend**: guard, permissão e rota não mudam.
- **Refatorar `RemoveResidentModal` para `react-hook-form`**: continua fora, como na story 196.
