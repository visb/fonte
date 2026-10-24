# Plan: criar atividade em Rascunhos, Solicitações e A fazer pelo `ops.fonte`, com responsável

## Context

No `ops`, toda atividade nasce como rascunho. O backend (`activity.service.ts → create`) só
deixa não-ADMIN criar em `DRAFT` e descarta o `responsibleStaffId` que ele mandar. Criar direto
em `TODO` (com responsável) é exclusivo de ADMIN, e ninguém cria direto em `REQUESTED`. No app, o
quick-add só aparece na coluna *Rascunhos* (`canQuickAddInStatus`) e `/activities/new` sempre cria
rascunho, sem campo de responsável.

Desde a story 220, o coordenador da casa aprova solicitações e atribui o responsável pelo `ops`.
Para pôr uma tarefa em *A fazer*, ele ainda precisa criar o rascunho, enviar como solicitação,
aprovar e escolher o responsável: quatro passos para algo que ele já decidiu na hora de criar.

Pedido do usuário (BACKLOG, dois itens unidos nesta story porque dependem da mesma mudança de
backend e do mesmo formulário):
- no `ops`, o coordenador pode criar atividades nas colunas *Rascunhos*, *Solicitações* e
  *A fazer*. *A fazer* exige responsável;
- em `/activities/new`, adicionar o campo "Responsável" já na criação.

Depende da story 220 (`canManageResponsible`, `SelectResponsibleModal`, aba inicial por `?tab=`).

### Decisões travadas (usuário)

1. **Os dois itens viram uma story só.**
2. **O campo "Responsável" em `/activities/new` aparece para todos.** O servo pode indicar o
   responsável ao criar o **rascunho**. Trocar o responsável depois continua sendo só do
   coordenador (story 220). O backend passa a aceitar `responsibleStaffId` de não-ADMIN na
   criação.
3. **O coordenador escolhe a coluna num seletor de status no formulário** (Rascunho |
   Solicitação | A fazer). O default é a aba de onde veio o FAB (`/activities/new?status=`). Com
   *A fazer*, o responsável fica obrigatório. O servo não vê o seletor: cria sempre rascunho.
4. **Quick-add em *A fazer*: título → modal de responsável.** O coordenador digita o título e toca
   "Adicionar". Abre o `SelectResponsibleModal` (story 220), e escolher o servo já cria a
   atividade em `TODO` com aquele responsável. Cancelar o modal não cria nada e mantém o título
   digitado.

### Decisões de desenho (defaults assumidos no refino)

5. **Quem cria em cada status** (`create`):
   - `DRAFT`: qualquer staff, como hoje;
   - `REQUESTED` e `TODO`: ADMIN ou coordenador da casa (`isHouseCoordinatorRole` + casa da
     atividade = casa do staff, mesmo predicado `canManageResponsible` da story 220). SERVANT →
     403;
   - qualquer outro status na criação → 400.
   O ADMIN ganha `REQUESTED` também, por simetria. O `adm` não precisa expor isso nesta story.
6. **Regras do responsável na criação:**
   - `TODO` sem responsável → 400 (regra atual, agora também para o coordenador);
   - `DRAFT`/`REQUESTED`: responsável opcional;
   - para não-ADMIN, o responsável tem de ser staff **ativo** da casa da atividade, senão 400
     (mesma checagem `assertStaffInHouse` da story 220). ADMIN mantém só `assertStaffExists`.
7. **Histórico:** criar com responsável grava `CREATED` e depois `RESPONSIBLE_CHANGED { from:
   null, to }`, para a atribuição aparecer na aba *Histórico* como na story 220. Sem responsável,
   só `CREATED`.
8. **Offline:** a criação já passa pela outbox com `Idempotency-Key` (story 171) e continua
   assim, inclusive em `REQUESTED`/`TODO` e com responsável. A lista de servos do modal e do
   campo vem do cache offline (`useHouseStaff`, story 204). Rejeição do servidor (ex.: perdeu o
   papel de coordenador) vai para `/sync` com o erro, sem descarte silencioso.
9. **Depois de criar, a tela vai para a aba do status criado.** `goToDrafts()` vira
   `goToTab(status)`, nos dois caminhos (`onSent`/`onQueued`). Os textos do aviso e do botão
   seguem o status: "Criar rascunho" / "Criar solicitação" / "Criar atividade".
10. **`canQuickAddInStatus(status, viewer)`**: `DRAFT` para todos; `REQUESTED` e `TODO` só para
    quem `canManageResponsible` na casa. O quick-add de `REQUESTED` é só título, sem modal.
11. **O seletor de status não oferece DOING/BLOCKED/DONE.**

---

## Desenho

### Backend (`services/api/src/modules/activity`)

- `dto/create-activity.dto.ts`: `status` aceita `DRAFT | REQUESTED | TODO` (`@IsIn`).
  `responsibleStaffId` continua `@IsOptional @IsUUID`.
- `activity.service.ts → create`:
  - resolve a casa do staff (`resolveHouseId`) e aplica a matriz da decisão 5 com o predicado da
    story 220. Não duplicar a regra: extrair `canManageInHouse(user, houseId, activityHouseId)` se
    o predicado atual depender de uma atividade carregada;
  - responsável: não-ADMIN → `assertStaffInHouse(responsibleStaffId, activityHouseId)`;
    ADMIN → `assertStaffExists` (como hoje); `TODO` sem responsável → 400;
  - eventos: `CREATED`, depois `RESPONSIBLE_CHANGED` quando houver responsável (decisão 7).
- `BUSINESS_RULES.md` (seção *Atividades* da story 220): quem cria em cada status e a regra do
  responsável na criação.
- `fonte-api.postman_collection.json`: `POST /activities` com `status` (`DRAFT|REQUESTED|TODO`),
  `responsibleStaffId` e as respostas 400/403 novas.

### Contratos

- `packages/types`: se o tipo de `status` do input de criação estiver restrito a `DRAFT|TODO`,
  ampliar. `CreateActivityInput` do `api-client` aceita `responsibleStaffId`. Rodar
  `pnpm build:types` e `pnpm build:api-client` se algo mudar.

### `ops.fonte` (`features/activities/`)

```
constants.ts                          ← canQuickAddInStatus(status, viewer) (decisão 10); labels do botão por status
components/ActivityFormFields.tsx     ← + campo Responsável (todos) e seletor de status (só coordenador)
components/ResponsibleField.tsx       ← novo; abre SelectResponsibleModal, mostra o escolhido, permite limpar (exceto TODO)
components/ActivityStatusPicker.tsx   ← novo; Rascunho | Solicitação | A fazer
components/QuickAddCard.tsx           ← em TODO, submit abre o modal; escolha cria com responsibleStaffId
components/SelectResponsibleModal.tsx ← + modo "escolher" (devolve o staff, sem mutation) além de trocar/aprovar
components/ActivityColumn.tsx         ← passa viewer para canQuickAddInStatus
pages/NewActivityPage.tsx             ← lê ?status=; schema zod com refine (TODO ⇒ responsável); goToTab(status)
pages/ActivitiesPage.tsx              ← FAB navega com ?status=<aba atual> quando o viewer pode criar nela
```

- Formulário: `react-hook-form` + `zod`, sem `useState` de campo. `status` e
  `responsibleStaffId` são campos do form (`Controller`). O refine marca o erro "Escolha o
  responsável" quando `status === TODO` e o responsável está vazio.
- Servo: o form não mostra o seletor de status, e o `status` enviado é `DRAFT`. Se o `?status=` da
  URL não for permitido para o viewer, cai em `DRAFT`.
- Quick-add em TODO: o título continua no `useForm` do card. O modal recebe `onSelect(staff)` e o
  card chama `submit({ title, status: TODO, responsibleStaffId, houseId })`. O estado de "modal
  aberto" fica no card, porque é um único modal por coluna e só a coluna TODO tem esse quick-add.
- Componentes no limite de ~150 linhas (CLAUDE.md). `ActivityFormFields` cresce, então extrair os
  campos novos como componentes próprios, conforme o desenho acima.
- Erros de API via `getErrorMessage`.

---

## Validação

### Backend: unit (`pnpm test:api`, `activity.service.spec.ts`)

- **Matriz de criação** (decisão 5), por role × status:
  - SERVANT: `DRAFT` ok; `REQUESTED`/`TODO` → 403;
  - COORDINATOR da casa: `DRAFT`/`REQUESTED`/`TODO` ok;
  - COORDINATOR criando com `houseId` de outra casa em `REQUESTED`/`TODO` → 403;
  - ADMIN: `DRAFT`/`REQUESTED`/`TODO` ok;
  - `DOING`/`BLOCKED`/`DONE` na criação → 400 (DTO).
- **Responsável:**
  - `TODO` sem responsável → 400 (coordenador e ADMIN);
  - SERVANT cria `DRAFT` com responsável da casa → salvo (antes era descartado);
  - não-ADMIN com responsável de outra casa ou desligado → 400;
  - ADMIN com responsável de qualquer casa → ok (regressão).
- **Eventos:** com responsável grava `CREATED` + `RESPONSIBLE_CHANGED {from: null, to}`, nessa
  ordem; sem responsável, só `CREATED`.

### Backend: e2e (`pnpm test:api:e2e`)

- `POST /activities` como coordenador em `TODO` com responsável → 201, e `GET .../events` traz os
  dois eventos; como servant em `TODO` → 403; como servant em `DRAFT` com responsável → 201 com o
  responsável. Fixtures próprias removidas por id (story 182).

### Contratos

- `pnpm build:types` / `pnpm build:api-client` se os tipos mudarem; `pnpm test:api-client`.
  Postman atualizado.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`canQuickAddInStatus`**: DRAFT true para todos; REQUESTED/TODO true só para o coordenador da
  casa; DOING/BLOCKED/DONE false.
- **`NewActivityPage`**:
  - servo: sem seletor de status, com campo responsável; envia `DRAFT` (+ responsável se
    escolhido);
  - coordenador: seletor com default vindo de `?status=`; `?status=` inválido para o viewer →
    DRAFT;
  - TODO sem responsável → erro de validação e nada enviado;
  - `onSent`/`onQueued` → `replace` para a aba do status criado; texto do botão por status.
- **`ResponsibleField`**: abre o modal, mostra o escolhido, limpar volta a vazio (bloqueado em
  TODO).
- **`QuickAddCard`**: em DRAFT/REQUESTED cria direto; em TODO abre o modal, escolher cria com
  `responsibleStaffId`, cancelar não cria e mantém o título.
- **`SelectResponsibleModal`**: modo "escolher" devolve o staff sem chamar mutation.
- **`ActivityColumn`/`ActivitiesPage`**: quick-add visível por coluna conforme o viewer; FAB leva
  `?status=` da aba atual.
- Atualizar os testes existentes de `QuickAddCard`, `NewActivityPage`, `ActivityColumn` e de
  `constants`.

### `ops.fonte`: Maestro (`pnpm test:ops`, `e2e/activities.yaml`)

- Coordenador: aba *A fazer* → quick-add com título → modal → escolher servo → card aparece em
  *A fazer* com o responsável.
- Coordenador: FAB na aba *Solicitações* → form abre com "Solicitação" → criar → cai em
  *Solicitações*.
- Servo: FAB → form sem seletor, com responsável → criar → rascunho com o responsável.
- Logins certos do `seed-test.ts`; limpeza por id (`e2e/helpers/delete-activity.js`).

### `ops.fonte`: web offline (`e2e-web/`, Playwright)

- `context.setOffline(true)`: coordenador cria em *A fazer* com responsável pelo quick-add → item
  aparece pendente na coluna; ao voltar a rede, sobe com status e responsável.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente. Código novo sem teste não fecha a story.
Rodar `pnpm test:api:cov` e a cobertura de `pnpm test:ops:unit`, **sem reduzir** a cobertura de
`modules/activity` e `features/activities`. Componentes novos ≥90%. Sem `skip`/`only`/`xfail` sem
justificativa no código (CLAUDE.md).

---

## Fora de escopo

- Servo criar fora de `DRAFT` (decisão 5) ou trocar o responsável depois de criado (story 220).
- Criar em `DOING`/`BLOCKED`/`DONE` (decisão 11).
- Expor criação em `REQUESTED` ou o campo responsável no rascunho no `adm`.
- Notificar o responsável atribuído na criação.
- Responsável fora da casa da atividade.
