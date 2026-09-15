# Plan: remover filho da casa pela lista — menu de linha no `ops.fonte` e no `adm.fonte`

## Context

Dar baixa num filho (alta, evasão ou transferência) só é possível hoje por **um** caminho: a
**Contagem** do `ops.fonte`, pelo `RemoveResidentModal`
(`features/census/components/RemoveResidentModal.tsx`). Fora da contagem — que é uma tarefa de
onboarding, feita uma vez — não existe ação nenhuma. O filho sai da casa numa terça e o coordenador
não tem por onde registrar isso até a próxima contagem.

O modal da contagem é bom e reusável: já tem as três ações com os campos certos (data do
acontecimento para alta/evasão, casa de destino para transferência), e as três mutations já passam
pela outbox (`OUTBOX_MUTATION_KEYS.residentUpdateStatus`), então funcionam sem sinal. O que falta é
chamá-lo de outro lugar.

O levantamento achou **dois problemas** que mudam o desenho, e são o motivo de a story ser maior que
"mover um modal":

**1. `SERVANT` não pode fazer isso, e offline ele não descobre.** `PATCH /residents/:id` é
`@Roles(ADMIN, COORDINATOR)` (`resident.controller.ts:298`) — o servo não tem permissão, nem na
contagem. Sem gate na UI, o servo toca em *Remover*, a mutation entra na fila (offline não conhece
403), o app diz "salvo no aparelho", e horas depois o item morre em `/sync` com um erro de permissão
que ele não tem como resolver. A tela precisa esconder a ação de quem não pode executá-la.

**2. A regra de transição não existe no service.** `BUSINESS_RULES.md` afirma *"Status de Resident só
muda por transição validada em service"* e *"Alta exige status `ACTIVE` ou `DISCIPLINE` +
`exit_date`"* — mas `ResidentService.update` (`resident.service.ts:335`) apenas aplica o `dto` e
dispara os efeitos (follow-up, cancelamento do carnê, notificação). **Não há validação de transição
nenhuma.** Hoje o furo é difícil de alcançar porque a contagem só lista filho ativo; expor a ação na
lista completa — que tem filtro de status e mostra `DISCHARGED`, `EVADED`, `ARCHIVED` — coloca o furo
a um toque de distância, e dar alta em quem já evadiu dispara `cancelAfterExit` e notificação de novo.

### Decisões travadas (usuário)

1. **Nos dois apps.** `ops.fonte` (lista de filhos) e `adm.fonte` (lista de filhos). O componente do
   `ops` é React Native e não atravessa — o `adm` ganha um dialog próprio, em shadcn.
2. **Menu `⋮` na linha.** Ícone de três pontos à direita abre o menu com *Remover da casa*. Visível e
   descobrível — o servo aprende o app em campo, sem treino, então swipe e toque longo estão fora.
3. **Só na lista.** A ficha do filho (aba Visão Geral no `ops`, detalhe no `adm`) não ganha o botão.

### Decisões de desenho derivadas (do levantamento no código)

4. **A ação é gated por role nas duas telas**: `ADMIN` e `COORDINATOR` veem o `⋮`; `SERVANT` não vê.
   No `ops`, via `staff.user.role` do `useAuth()`, como `HouseSettingsPage` já faz. Esconder, não
   desabilitar: botão morto na tela de campo é pior que ausência — o servo tenta, não entende, e
   chama alguém.
5. **A ação é gated por status**: o item do menu só aparece para filho em acolhimento
   (`ACTIVE`, `DISCIPLINE`, `TEMP_LEAVE`). Para `DISCHARGED`, `EVADED`, `ARCHIVED`, `PRE_ADMISSION`,
   `CENSUS_ADDED` e `REJECTED_CENSUS` o `⋮` não oferece *Remover* — quem já saiu não sai de novo.
   A lista de status elegíveis nasce em `@fonte/types` como `REMOVABLE_RESIDENT_STATUSES`, uma só
   para os dois apps e para o backend.
6. **O guard entra no service** (não só na tela). É o ponto 2 do Context: gate de UI sobre uma regra
   que `BUSINESS_RULES.md` diz existir e que o service não implementa é como a regra continua
   quebrada. `ResidentService.update` passa a recusar com **400** a transição para `DISCHARGED`/
   `EVADED` a partir de status não elegível, **antes** de aplicar o update e de disparar qualquer
   efeito. Mensagem acionável (*"Filho já encerrado não pode receber alta."*).
7. **O modal sai de `features/census/` e vira compartilhado** — `features/residents/components/
   RemoveResidentModal.tsx` no `ops`. A contagem passa a importar de lá. Componente de baixa de filho
   morando na feature de contagem é o que faz a próxima pessoa duplicá-lo em vez de reusá-lo. As três
   hooks (`useDischargeResident`, `useEvadeResident`, `useTransferResident`) migram junto, de
   `features/census/hooks/useCensus.ts` para `features/residents/hooks/useResidentRemoval.ts`.
   **As `mutationKey`s não mudam** — trocar a chave abandonaria na fila os itens de quem atualizou o
   app com lançamento pendente.
8. **No `adm`, a "Excluir" existente entra no mesmo menu.** O card hoje tem lápis (Editar) e lixeira
   (Excluir — `DELETE /residents/:id`, soft delete, `ADMIN`-only). Deixar *Excluir* como ícone solto
   ao lado de um menu com *Remover da casa* põe duas ações destrutivas parecidas e de consequências
   opostas a um clique uma da outra. *Editar* continua botão direto; *Remover da casa* e *Excluir*
   ficam no `⋮`, separados e rotulados. `Excluir` continua `ADMIN`-only e continua pedindo o
   `AlertDialog` de confirmação que já existe.
9. **O `adm` não reusa o layout do modal do `ops`,** mas reusa as regras: mesmas três ações, mesmos
   campos obrigatórios, mesmos rótulos (que sobem para `@fonte/types` junto com a decisão 5).
   Formulário em `react-hook-form` + `zod`, como manda o CLAUDE.md — o modal do `ops` usa `useState`
   por ser anterior à regra, e **não** é refatorado nesta story (mexer nele sem necessidade é risco
   num fluxo que já funciona offline).
10. **O `adm` não é offline.** Nada de outbox lá: mutation normal, invalidação das listagens e toast
    de erro por `getErrorMessage`.

---

## Desenho

### 1. `packages/types`

```ts
/** Status a partir dos quais o filho pode receber baixa (alta/evasão/transferência). */
export const REMOVABLE_RESIDENT_STATUSES: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
];

export type ResidentRemovalAction = 'discharge' | 'evade' | 'transfer';

export const RESIDENT_REMOVAL_LABELS: Record<ResidentRemovalAction, {
  label: string;
  description: string;
}> = {
  discharge: { label: 'Declarar alta',  description: 'Encerrar o acolhimento com alta.' },
  evade:     { label: 'Evasão',         description: 'Registrar saída por evasão.' },
  transfer:  { label: 'Transferir para outra casa', description: 'Mover o filho para outra casa.' },
};
```

Os rótulos saem do array `ACTIONS` hardcoded em `RemoveResidentModal.tsx:32` — dois apps escrevendo
"Declarar alta" por conta própria é como viram "Declarar Alta" e "Dar alta".

### 2. Backend — `ResidentService.update` (decisão 6)

Antes de `residentRepository.update`:

```ts
const isExit = dto.status === ResidentStatus.DISCHARGED || dto.status === ResidentStatus.EVADED;
if (isExit && dto.status !== before.status
    && !REMOVABLE_RESIDENT_STATUSES.includes(before.status)) {
  throw new BadRequestException(/* mensagem por status de origem */);
}
```

- Vem **antes** do `update` e dos efeitos — hoje `cancelAfterExit` e `notifyResidentDischarged`
  rodariam mesmo na transição inválida.
- `dto.status === before.status` continua passando (reenvio idempotente da outbox não pode virar 400
  na segunda entrega — a rota é `@Idempotent()` justamente por causa do censo offline).
- Nenhuma outra transição é restringida: a story fecha a porta que ela abre, não reescreve a máquina
  de estados inteira.

Sem migration, sem rota nova, sem mudança de contrato de rota.

### 3. `ops.fonte`

**Movidos** (decisão 7), sem mudança de comportamento:
`features/census/components/RemoveResidentModal.tsx` → `features/residents/components/`;
as três hooks → `features/residents/hooks/useResidentRemoval.ts`.
`CensusPage` e `CensusListItem` passam a importar do novo lugar.

**`ResidentListItem`** ganha o `⋮` à direita, renderizado só quando
`canRemove = isAdminOrCoordinator && REMOVABLE_RESIDENT_STATUSES.includes(item.status)`
(decisões 4 e 5). O toque no `⋮` **não** navega para a ficha — `stopPropagation`, senão o menu abre
junto com a navegação.

**`ResidentsPage`** hospeda o modal (um por página, não um por linha) e passa
`resident={selected}` — item de lista não instancia `Modal`.

Estados e fluxo offline: o modal já usa `useFieldSubmit`, então sem sinal o modal fecha na hora com o
aviso "salvo no aparelho" e o item vai para `/sync` se o servidor recusar — inclusive o 400 novo da
decisão 6, com a mensagem legível.

### 4. `adm.fonte`

**`ResidentCard`** (decisão 8): lápis continua; lixeira e a ação nova passam para um
`DropdownMenu` (`@/components/ui/dropdown-menu`, já existe):

```
[ Editar ✎ ]  [ ⋮ ]
                ├── Remover da casa      (ADMIN, COORDINATOR · status elegível)
                └── Excluir              (ADMIN · destrutivo, abre AlertDialog)
```

Menu vazio → o `⋮` não é renderizado.

**`RemoveResidentDialog`** novo em `features/residents/components/`, autossuficiente (busca as casas
para a transferência com `useHouses({ enabled: open })` — sem prop drilling, CLAUDE.md):
`react-hook-form` + `zod`, schema discriminado pela ação (`discharge`/`evade` exigem `exitDate`;
`transfer` exige `targetHouseId`), rótulos de `RESIDENT_REMOVAL_LABELS`.

**`useRemoveResident`** em `features/residents/hooks/`: mutation por `api.residents.update`,
invalida `queryKeys.residents.all`, a listagem por casa e o detalhe. Erro por `getErrorMessage`,
sucesso por `toast.success`.

### 5. API e contratos

Nenhuma rota nova. `PATCH /residents/:id` ganha um caso de **400** (decisão 6) —
`fonte-api.postman_collection.json` atualizado com a resposta nova (regra do CLAUDE.md).
`pnpm build:types` pelas constantes da seção 1.

---

## Validação

### Backend — `pnpm test:api`

- **Guard da decisão 6**: `ACTIVE` → `DISCHARGED` passa; `DISCIPLINE` → `DISCHARGED` passa;
  `TEMP_LEAVE` → `EVADED` passa; `DISCHARGED` → `DISCHARGED` (reenvio) **passa**, sem reaplicar
  efeitos; `EVADED` → `DISCHARGED` → **400**; `ARCHIVED` → `EVADED` → **400**;
  `PRE_ADMISSION` → `DISCHARGED` → **400**.
- **Efeitos não vazam na recusa** — o teste que justifica o guard: na transição inválida,
  `followUpService.createAuto`, `receivableService.cancelAfterExit` e `notifyResidentDischarged`
  **não** são chamados, e a linha do filho não muda no banco.
- **Transferência não é restringida**: mudar `houseId` sem mexer em `status` continua funcionando de
  qualquer status (o guard só olha as duas transições de saída).
- **Regressão**: os specs de `update` existentes passam **sem alteração de expectativa**. Se algum
  precisou mudar, o guard pegou mais do que devia.

### Backend — `pnpm test:api:e2e`

- `PATCH /residents/:id` com `status: DISCHARGED` em filho já `EVADED` → `400` com a mensagem.
- Caminho feliz para `COORDINATOR` → `200`; `SERVANT` → `403` (prova a decisão 4 do lado do servidor).
- Reenvio com a mesma `Idempotency-Key` → mesma resposta, sem duplicar follow-up.
- Fixtures conforme a story 182: criadas pela suíte via API, removidas no `afterAll`, limpeza por id
  acumulado.

### `ops.fonte` — unit (`pnpm test:ops:unit`)

- **`ResidentListItem`**: `⋮` presente para `COORDINATOR` com filho `ACTIVE`; **ausente** para
  `SERVANT` (decisão 4 — é o teste que impede o lançamento fadado ao 403 na fila); ausente para filho
  `DISCHARGED`/`EVADED`/`ARCHIVED` (decisão 5); tocar no `⋮` **não** dispara a navegação para a ficha.
- **`ResidentsPage`**: abrir o menu e escolher *Remover da casa* abre o modal com o filho certo;
  fechar sem confirmar não dispara mutation.
- **`RemoveResidentModal` após a mudança de pasta**: os specs existentes (`CensusComponents.test.tsx`)
  continuam passando, só com o import novo — a mudança é de lugar, não de comportamento.
- **As `mutationKey`s continuam as mesmas** (decisão 7): asserção direta sobre
  `OUTBOX_MUTATION_KEYS.residentUpdateStatus` nas três hooks movidas. É o que garante que o
  lançamento pendente de quem atualizou o app ainda é retomado.

### `ops.fonte` — offline e2e (Playwright web, `e2e-web/`)

Offline, remover pela lista: o modal fecha na hora, o item entra na fila, **recarregar o app ainda
offline mantém o item**, e ao voltar o sinal a baixa é aplicada uma vez só. Depois, o caso da decisão
6: item recusado com 400 aparece em `/sync` com a mensagem do backend, não com erro de axios.

### `adm.fonte` — unit (Vitest/RTL)

- **`ResidentCard`**: `⋮` com *Remover da casa* + *Excluir* para `ADMIN`; só *Remover da casa* para
  `COORDINATOR`; **sem** `⋮` para filho já encerrado e sem permissão; *Editar* continua botão direto
  em todos os casos.
- **`RemoveResidentDialog`**: escolher *alta* exige data (submit bloqueado sem ela); *transferência*
  exige casa de destino e **não** pede data; a casa atual não aparece entre as opções; erro do
  backend chega pela frase do backend via `getErrorMessage`.
- **`useRemoveResident`**: invalida as três query keys no sucesso.

### `adm.fonte` — e2e (Playwright)

Na lista de filhos: `⋮` → *Remover da casa* → alta com data → o card sai da listagem de ativos e
aparece com o badge de encerrado no filtro correspondente.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov`, `pnpm test:ops:unit` e
`pnpm test:adm:unit` com cobertura; **não reduzir** a cobertura de `resident` no backend nem das
features `residents` dos dois apps. Cobertura obrigatória nos dois pontos que a story existe para
fechar: o gate de role da decisão 4 e o guard de transição da decisão 6 (cada status de origem).
Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- **Refatorar `RemoveResidentModal` para `react-hook-form`** (decisão 9): ele muda de pasta, não de
  implementação.
- **Ação na ficha do filho** (decisão 3), nos dois apps.
- **Reintroduzir/readmitir** pela lista — o caminho de volta continua sendo o fluxo de reintrodução
  existente (`ReadmissionForm`).
- **Máquina de estados completa do filho**: o guard da decisão 6 cobre só as duas transições de saída
  que esta story torna alcançáveis. As demais transições continuam sem validação — dívida conhecida,
  registrada aqui, não resolvida.
- **Permitir `SERVANT` dar baixa** (afrouxar `PATCH /residents/:id`): a story respeita a permissão
  atual, não a discute.
- **Ação em lote** (remover vários filhos de uma vez).
- **`app.fonte`** — familiares não dão baixa em ninguém.
