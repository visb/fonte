# Plan: aprovar solicitação e atribuir responsável pelo `ops.fonte`

## Context

No `ops`, uma atividade nasce como rascunho e o criador a envia como solicitação. Daí em diante o
fluxo para: aprovar (REQUESTED → TODO) e definir ou trocar o responsável são exclusivos de ADMIN no
backend (`assertCanChangeStatus` / `update` em `activity.service.ts`), e o ADMIN não opera pelo ops
(story 48). O coordenador da casa, que é quem de fato distribui o trabalho, precisa ir ao `adm` ou
pedir a um ADMIN. Além disso:

- depois de criar pela rota `/activities/new`, o app volta para a lista na aba que estava aberta, e
  o operador não vê o rascunho que acabou de criar;
- o botão "Enviar" do rascunho não diz o que acontece (vira solicitação);
- a aba *Histórico* do detalhe mostra "Histórico em breve.", embora o backend já grave a trilha
  (story 66) e o `adm` já a renderize;
- aprovar com responsável no body grava só `STATUS_CHANGED`. A atribuição feita na aprovação não
  aparece no histórico.

Pedido do usuário (ops, atividades):
- ao criar pela rota `/activities/new`, redirecionar para a lista de rascunhos;
- em rascunhos, trocar "Enviar" por "Enviar solicitação";
- em solicitações, botão "Aprovar solicitação", mesmo sem responsável; sem responsável, abrir modal
  para selecioná-lo;
- tocar no responsável do card abre o modal de seleção;
- no detalhe da atividade, permitir trocar o responsável;
- atribuir ou trocar o responsável fica registrado no histórico.

### Decisões travadas (usuário)

1. **Quem aprova e atribui/troca responsável:** o **coordenador da casa** (ADMIN ou COORDINATOR
   lotado na casa da atividade, `isHouseCoordinatorRole` da story 214 + vínculo de casa). SERVANT
   só vê o responsável e não aprova nem troca.
2. **Aba Histórico no ops entra nesta story.** Ela renderiza a trilha (`GET /activities/:id/events`)
   no lugar do placeholder, para quem trocou o responsável ver o registro.
3. **O responsável pode ser trocado em todas as situações, menos Concluída** (DRAFT, REQUESTED,
   TODO, DOING, BLOCKED). Para trocar em DONE é preciso reabrir antes.

### Decisões de desenho (defaults assumidos no refino)

4. **ADMIN mantém o comportamento atual no `adm`.** A trava de DONE e a exigência de "staff da
   mesma casa" valem para o coordenador. O ADMIN segue podendo reatribuir em qualquer status, como
   hoje, para não quebrar o `adm`.
5. **O responsável escolhido pelo coordenador tem que ser staff da casa da atividade.** Fora disso a
   API responde 400. O modal só lista `useHouseStaff(houseId)`.
6. **Responsável não pode ser removido (null) em TODO/DOING/BLOCKED/DONE.** É o invariante do bloco
   de trabalho. A API responde 400 para qualquer role. Antes de travar, conferir se o `adm` oferece
   "remover responsável" nesses status. Se oferecer, a trava vale só para não-ADMIN, e isso fica
   anotado no código. O modal do ops não tem opção "sem responsável".
7. **Aprovar com responsável já definido aprova direto**, sem modal, igual às outras ações do card.
   Sem responsável, abre o modal, e confirmar a seleção já aprova (uma chamada
   `PATCH /activities/:id/status` com `{ status: TODO, responsibleStaffId }`).
8. **Criador que também é coordenador** vê, em Solicitações, os dois botões: "Devolver para
   rascunho" e "Aprovar solicitação".
9. **Aprovar e trocar responsável exigem rede.** Nenhum dos dois endpoints aceita
   `Idempotency-Key`, igual à mudança de status (story 171, decisão 4). Sem sinal, o botão e o toque
   no responsável ficam desabilitados com o motivo escrito ("Precisa de conexão…"). Não entram na
   outbox. A lista de servos já é cacheada offline (story 204).
10. **Redirecionar após criar:** `NewActivityPage` faz `router.replace` para a lista com
    `?tab=DRAFT`, tanto no `onSent` quanto no `onQueued`, e depois mostra o aviso. `ActivitiesPage`
    lê o param (`useLocalSearchParams`) e o usa como aba inicial, prevalecendo sobre
    `initialActivityTab`. Sem param, o comportamento é o de hoje.
11. **Sem endpoint novo.** A troca de responsável usa `PATCH /activities/:id`
    (`responsibleStaffId`), que já grava `RESPONSIBLE_CHANGED`. A aprovação usa
    `PATCH /activities/:id/status`. Muda só a permissão.

---

## Desenho

### Backend (`services/api/src/modules/activity`)

- `activity.service.ts`:
  - novo predicado privado `canManageResponsible(activity, user, houseId)`: ADMIN sempre; senão
    `isHouseCoordinatorRole(role)` **e** `houseId === activity.houseId`.
  - **Aprovar** (REQUESTED → TODO): troca o "só ADMIN" por `canManageResponsible`. Para
    não-ADMIN, valida que o responsável (body ou já setado) é staff da casa da atividade
    (`assertStaffInHouse`).
  - **Registrar a atribuição feita na aprovação:** se o responsável efetivo difere do anterior,
    grava `RESPONSIBLE_CHANGED { from, to }` **antes** do `STATUS_CHANGED`. Hoje
    `assertCanChangeStatus` muta `activity.responsibleStaffId` sem evento. Mover a atribuição para
    `changeStatus`, ou devolver o "antes", para registrar.
  - **Trocar responsável** (`update` com `responsibleStaffId`): troca o "só ADMIN" por
    `canManageResponsible`. Para não-ADMIN, rejeita status DONE (403) e responsável de outra casa
    (400). `null` em status de trabalho → 400 (decisão 6).
  - O `update` do coordenador que mande **só** `responsibleStaffId` não pode cair na trava de
    `editsCoreContent` (título/casa continuam com a regra da story 48).
- `BUSINESS_RULES.md`: nova seção curta *Atividades*, com quem aprova, quem atribui, as travas
  (DONE, mesma casa, responsável obrigatório no bloco de trabalho) e o registro no histórico.
- `fonte-api.postman_collection.json`: atualizar a descrição de `PATCH /activities/:id` e
  `PATCH /activities/:id/status` (permissão do coordenador, 400 de outra casa/null, 403 em DONE).
  Rota, body e response não mudam.

### `ops.fonte` (`features/activities/`)

```
lib/permissions.ts                    ← + canApproveRequest, canManageResponsible (espelho do backend)
components/ActivityCardActions.tsx    ← "Enviar solicitação"; "Aprovar solicitação" p/ coordenador
components/ResponsibleBadge.tsx       ← vira tocável (onPress opcional + disabled offline)
components/SelectResponsibleModal.tsx ← novo; autossuficiente (useHouseStaff), marca o atual
components/ActivityHistory.tsx        ← novo; timeline da trilha (+ ActivityHistoryItem)
constants.ts                          ← labels de evento (espelho de adm/features/activities/constants.ts)
hooks/useActivities.ts                ← + useActivityEvents(id); update/changeStatus invalidam events
pages/NewActivityPage.tsx             ← replace p/ lista ?tab=DRAFT
pages/ActivitiesPage.tsx              ← lê ?tab; orquestra aprovar com/sem modal
pages/ActivityDetailPage.tsx          ← Responsável com "Alterar"; aba Histórico real
lib/queryKeys.ts                      ← queryKeys.activities.events(id)
```

- **Permissão no front**: `canManageResponsible(activity, { role, houseId })` =
  `isHouseCoordinatorRole(role) && houseId === activity.houseId && status !== DONE`.
  `canApproveRequest` é a mesma regra com `status === REQUESTED`. O backend é a autoridade, e o
  front só esconde ou desabilita.
- **Card**: `ResponsibleBadge` recebe `onPress` só quando `canManageResponsible`. Tocar abre
  `SelectResponsibleModal` em modo "trocar" (`useUpdateActivity` com `{ responsibleStaffId }`). O
  estado do modal (aberto, atividade, modo) fica na page ou num hook `useResponsibleModal`, não em
  cada card. O "Aprovar solicitação" sem responsável abre o mesmo modal em modo "aprovar"
  (`useChangeActivityStatus` com `{ status: TODO, responsibleStaffId }`). Com responsável, aprova
  direto.
- **Detalhe**: a linha *Responsável* ganha "Alterar" (mesma regra), que abre o mesmo modal em modo
  "trocar". `ActivityDetailPage` já passa de ~250 linhas. Extrair `ActivityInfoCard`,
  `ActivityTabs`/`TabButton` e `DescriptionSection` para `components/`, para manter o limite de ~150
  linhas por componente (CLAUDE.md).
- **Histórico**: `ActivityHistory` lista os eventos (ator, quando, o quê). Para
  `RESPONSIBLE_CHANGED`: "atribuiu a Fulano" (from null) ou "trocou o responsável de X para Y".
  `metadata` traz staff ids: resolver o nome pela lista `useHouseStaff`, com fallback "servo
  removido". Usa `LoadingState`/`ErrorState`/`EmptyState`. Leitura offline: seguir o mesmo
  tratamento de `activities.detail` em `lib/offline/constants.ts` (allowlist). Se o detalhe é
  persistido, a key de eventos também entra.
- Erros de API via `getErrorMessage`. Seleção do modal sem `useState` de campo de formulário: a
  escolha é um toque numa lista, sem form. Se tiver confirmação, usar `react-hook-form` + `zod`.

---

## Validação

### Backend: unit (`pnpm test:api`, `activity.service.spec.ts`)

- **Aprovar (REQUESTED → TODO):**
  - COORDINATOR da casa aprova com `responsibleStaffId` da casa → TODO, responsável setado;
  - COORDINATOR aprova atividade que já tem responsável, sem body → TODO;
  - COORDINATOR de **outra** casa → 404 (visibilidade); SERVANT da casa → 403;
  - COORDINATOR com responsável de outra casa → 400; sem responsável nenhum → 400;
  - ADMIN continua aprovando como hoje (regressão).
- **Histórico na aprovação:**
  - aprovação que define/troca responsável grava `RESPONSIBLE_CHANGED {from, to}` **e**
    `STATUS_CHANGED`, nessa ordem;
  - aprovação com responsável já setado e igual não grava `RESPONSIBLE_CHANGED`.
- **Trocar responsável (`update`):**
  - COORDINATOR da casa troca em DRAFT/REQUESTED/TODO/DOING/BLOCKED → ok + `RESPONSIBLE_CHANGED`;
  - COORDINATOR em DONE → 403; ADMIN em DONE → ok (decisão 4);
  - COORDINATOR com responsável de outra casa → 400; SERVANT → 403;
  - `null` em TODO/DOING/BLOCKED/DONE → 400 (decisão 6); `null` em DRAFT/REQUESTED → ok;
  - COORDINATOR mandando só `responsibleStaffId` em status ≠ DRAFT não cai na trava de título/casa;
  - COORDINATOR **não** ganha edição de título/casa fora de DRAFT (regressão da story 48).

### Backend: e2e (`pnpm test:api:e2e`)

- `PATCH /activities/:id/status` como coordenador (aprovar com responsável) → 200, e
  `GET /activities/:id/events` traz `RESPONSIBLE_CHANGED` + `STATUS_CHANGED`.
- `PATCH /activities/:id` como coordenador trocando responsável → 200; como servant → 403; em DONE
  como coordenador → 403.
- Fixture própria criada e removida por id (story 182). O seed é só leitura.

### Contratos

- Sem mudança de tipo prevista. Se `ActivityEvent`/metadata mudar, rodar `pnpm build:types` e
  `pnpm build:api-client`. Postman atualizado (descrições).

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`permissions`**: `canApproveRequest`/`canManageResponsible` por role (ADMIN, COORDINATOR,
  SERVANT), casa igual/diferente e cada status (DONE → false).
- **`ActivityCardActions`**:
  - rascunho do criador mostra "Enviar solicitação" (e não "Enviar");
  - solicitação + coordenador da casa → "Aprovar solicitação"; servant → não aparece;
  - criador-coordenador → "Devolver para rascunho" + "Aprovar solicitação";
  - offline → desabilitado com o aviso.
- **Aprovar**: com responsável chama `changeStatus({status: TODO})` direto; sem responsável abre o
  modal, e selecionar chama `changeStatus({status: TODO, responsibleStaffId})`.
- **`ResponsibleBadge`**: tocável só com `onPress`; sem `onPress` não é botão (servant / DONE).
- **`SelectResponsibleModal`**: lista os servos da casa, marca o atual, selecionar dispara a
  mutation do modo certo, erro de API mostra `getErrorMessage`, loading/vazio pelos componentes
  compartilhados.
- **`NewActivityPage`**: `onSent` e `onQueued` fazem `replace` para a lista com `tab=DRAFT`.
- **`ActivitiesPage`**: `?tab=DRAFT` abre em Rascunhos mesmo com itens em colunas anteriores; sem
  param mantém `initialActivityTab`.
- **`ActivityDetailPage`**: "Alterar" visível só para quem pode; abre o modal; troca chama
  `useUpdateActivity` com `{ responsibleStaffId }`.
- **`ActivityHistory`**: renderiza cada tipo de evento, inclusive `RESPONSIBLE_CHANGED`
  (atribuição e troca), fallback de nome e estados loading/erro/vazio.
- Atualizar os testes existentes que procuram "Enviar" (`ActivityCard.test.tsx`,
  `ActivityComponents.test.tsx`, `ActivityCardOffline.test.tsx` etc.).
- Se mexer na allowlist offline: atualizar `persister.test.ts`/`prefetch.test.tsx`.

### `ops.fonte`: Maestro (`pnpm test:ops`, `e2e/activities.yaml`)

- FAB → `/activities/new` → criar → cai na aba *Rascunhos* com o item → "Enviar solicitação" → aba
  *Solicitações* → "Aprovar solicitação" → modal → escolher servo → item em *A fazer* com o
  responsável → abrir o detalhe → aba *Histórico* mostra a atribuição.
- Usuário do fluxo precisa ser COORDINATOR da casa no seed de teste. Conferir em `seed-test.ts` e
  usar o login certo. Limpeza da fixture por id (`e2e/helpers/delete-activity.js`, story 182).

### `ops.fonte`: web offline (`e2e-web/`, Playwright)

- `context.setOffline(true)`: "Aprovar solicitação" e o toque no responsável ficam desabilitados com
  o aviso, e nada vai para a fila.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente. Nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov` e a cobertura de `pnpm test:ops:unit`, **sem reduzir** a cobertura de
`modules/activity` e `features/activities`. Componentes novos ≥90%. Sem `skip`/`only`/`xfail` sem
justificativa no código (CLAUDE.md).

---

## Fora de escopo

- SERVANT aprovar ou trocar responsável (decisão 1).
- Trocar responsável em atividade Concluída pelo ops (decisão 3): reabrir antes.
- Aprovar ou trocar responsável **offline** via outbox (decisão 9). Exigiria `Idempotency-Key` nos
  dois endpoints.
- Notificar o novo responsável (push/WhatsApp).
- Mudanças no `adm` além do que a regra de backend exigir. O `adm` já renderiza `RESPONSIBLE_CHANGED`.
- Responsável fora da casa da atividade (ex.: staff de outra casa ou sem casa).
