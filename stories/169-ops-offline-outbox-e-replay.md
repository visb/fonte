# Plan: ops.fonte offline — outbox e replay de escrita

> Filha de [[167]]. Depende de [[168]] (persister e `onlineManager` já ligados).
> Ordem: [[168]] → 169 → [[170]] → [[171]].

## Context

Fatia 2 do epic [[167]]: o operador lança em campo **sem rede** e o lançamento não se perde. Esta
story entrega o motor (fila persistida + replay); quem pluga cada tela é a [[171]].

Estado verificado:

- Toda mutation do app é `useMutation({ mutationFn: inline, onSuccess: invalidate })`, **sem
  `mutationKey`** — ex. `features/storeroom/hooks/useStoreroom.ts:37-45`,
  `features/census/hooks/useCensus.ts:63-76`. Função não é serializável: sem
  `setMutationDefaults(key, { mutationFn })` a mutation pausada **não sobrevive** a um restart.
- `useCensusAddResident` (`useCensus.ts:63-76`) faz **duas** chamadas (`census.addResident` +
  `residents.uploadPhoto`) e monta `FormData` a partir de um URI de câmera/galeria — nada disso é
  serializável, e o URI temporário do picker pode ser evicted pelo SO antes do replay.
- `MovementType` IN/OUT altera `current_quantity`; `BUSINESS_RULES.md` diz que **storeroom não tem
  estorno**. Duplicar um movimento no replay é um estrago que só se corrige com lançamento novo.

### Decisões travadas

1. **`setMutationDefaults` por `mutationKey`**, registrado num único arquivo
   (`lib/offline/mutationDefaults.ts`) no boot, antes de reidratar o cache. Cada hook de campo
   passa a declarar só `mutationKey` + variáveis; a `mutationFn` e a invalidação vivem no default.
   É a única forma de a fila retomar depois de fechar o app.
2. **`networkMode: 'offlineFirst'`** nessas mutations: offline elas ficam `paused` (não falham),
   e o React Query as retoma.
3. **Replay FIFO, tolerante a falha individual.** `resumePausedMutations()` roda na ordem de
   entrada; se um item é rejeitado, os seguintes **continuam** (movimentos de itens diferentes são
   independentes). O rejeitado vai para a dead-letter, não bloqueia a fila.
4. **Rede ≠ rejeição.** Erro sem `response` (rede/timeout) mantém o item na fila; 4xx de negócio
   (400/403/404/409/422) tira da fila e grava na dead-letter com a mensagem do backend via
   `getErrorMessage` (`lib/errors.ts`). 5xx conta como transitório (fica na fila, com limite de
   tentativas para não girar para sempre).
5. **Dead-letter é store próprio persistido** (`lib/offline/deadLetter.ts` sobre AsyncStorage),
   alimentado por um `MutationCache.onError` global. O React Query descarta a mutation depois do
   erro definitivo — sem store próprio o item some da tela e da vida.
6. **Foto sobrevive ao restart.** No `onMutate`, copiar o arquivo escolhido para
   `FileSystem.documentDirectory + 'outbox/'` com nome estável e enfileirar **o caminho copiado**,
   não o URI do picker. O `FormData` é remontado na hora do envio. Em web, o mesmo passo persiste
   o blob como data URL. Arquivo é apagado quando o item sai da fila (sucesso ou descarte).
7. **`useCensusAddResident` vira duas etapas encadeadas na fila**: criar o filho e, com o `id`
   retornado, enfileirar o upload da foto. Um `FormData` não pode depender de um id que ainda não
   existe.
8. **Update otimista** com `onMutate` gravando no cache (o lançamento aparece na hora, marcado como
   pendente) e rollback no erro definitivo. É o que faz o app **parecer** offline-first.
9. **Chave de idempotência no header `Idempotency-Key`** (UUID), não no corpo da requisição.
   `services/api/src/main.ts:27-31` usa `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
   true })` ⇒ campo extra no body é **400**, não é descartado em silêncio. A chave é gerada **uma
   vez** no `onMutate`, guardada junto do item na fila e **reusada em todo reenvio** do mesmo item —
   gerar chave nova a cada retry anula a idempotência. O backend que consome esse header é a
   story [[172]], que **precede** esta; enquanto ela não estiver implementada, o header é ignorado
   pelo servidor e não atrapalha nada.

## Desenho

### `lib/offline/outbox.ts` (novo)

- `OUTBOX_MUTATION_KEYS`: catálogo das chaves de campo (`['census','addResident']`,
  `['census','conclude']`, `['residents','updateStatus']`, `['incidents','create']`,
  `['storeroom','createMovement']`, `['storeroom','createItem']`,
  `['supplyRoom','createMovement']`, `['supplyRoom','createItem']`,
  `['streetSales','create']`, `['streetSales','update']`, `['activities','create']`,
  `['activities','comment']`).
- `usePendingMutations()`: lê `queryClient.getMutationCache()` e devolve os itens `paused`/`pending`
  já normalizados (label, timestamp, chave) — consumido pela [[170]].
- `isDefinitiveFailure(error)`: classifica rede vs 4xx vs 5xx.

### `lib/offline/mutationDefaults.ts` (novo)

- `registerMutationDefaults(queryClient)`: um `setMutationDefaults` por chave, com `mutationFn`,
  `networkMode: 'offlineFirst'`, `retry` para transitórios, e a invalidação que hoje mora no
  `onSuccess` de cada hook.

### `lib/offline/deadLetter.ts` (novo)

- Lista persistida `{ id, mutationKey, variables, label, error, failedAt }`.
- `append`, `list`, `remove`, `clear` + subscribe para a UI reagir.
- `clear` também roda no logout (junto com o `clearPersistedCache` da [[168]]).

### `lib/offline/attachments.ts` (novo)

- `persistOutboxFile(uri)` → caminho estável em `documentDirectory/outbox/`.
- `buildFormDataFromOutboxFile(path)` → `FormData` (nativo e web, como
  `buildPhotoFormData` já faz hoje em `useCensus.ts:47-58` — mover/generalizar em vez de duplicar).
- `discardOutboxFile(path)`.

### `app/_layout.tsx`

- Persister passa a persistir mutations (`dehydrateOptions.shouldDehydrateMutation` restrito às
  chaves da outbox).
- `registerMutationDefaults(queryClient)` antes da reidratação.
- `onSuccess` do `PersistQueryClientProvider` → `queryClient.resumePausedMutations()`.
- Assinatura em `onlineManager` para chamar `resumePausedMutations()` na volta da rede.
- `MutationCache` com `onError` global gravando na dead-letter quando `isDefinitiveFailure`.

## Validação

**Unit (Jest/RTL — `pnpm test:ops:unit`)**

- `lib/offline/outbox.test.ts`: `isDefinitiveFailure` — erro sem `response` → transitório; 422/409/403
  → definitivo; 500 → transitório; `usePendingMutations` normaliza pausadas e ignora as concluídas.
- `lib/offline/mutationDefaults.test.ts`: cada chave da outbox tem default registrado com
  `networkMode: 'offlineFirst'` e `mutationFn` definida (teste de catálogo — pega chave nova sem
  default, que é a falha silenciosa clássica aqui).
- `lib/offline/deadLetter.test.ts`: append persiste; remove some; `clear` esvazia; sobrevive a
  releitura do AsyncStorage.
- `lib/offline/attachments.test.ts`: `persistOutboxFile` copia para `documentDirectory/outbox/`;
  `buildFormDataFromOutboxFile` monta `FormData` em nativo e em web; `discardOutboxFile` apaga.
- Teste de integração do motor (`lib/offline/replay.test.tsx`): offline → mutation fica `paused` e é
  persistida; volta online → é enviada uma vez e a query é invalidada; rejeição 422 → sai da fila e
  entra na dead-letter com a mensagem do backend; erro de rede → **permanece** na fila; FIFO com
  falha no meio → os itens seguintes ainda são enviados.
- Update otimista: `onMutate` grava no cache e o rollback desfaz no erro definitivo.

**E2E web (Playwright — `pnpm test:ops:e2e`)**

- `e2e-web/offline-outbox.spec.ts` (novo): logar → `setOffline(true)` → criar um movimento de
  almoxarifado → o item aparece na lista marcado como pendente e **nenhuma** requisição sai →
  `setOffline(false)` → o lançamento é enviado e passa a constar normalmente, **uma única vez**
  (conferir a contagem de requisições ao endpoint, é o teste que protege contra duplicata).

**E2E Maestro (`pnpm test:ops`)**

- `e2e/storeroom.yaml` e `e2e/incidents.yaml` continuam verdes com a rede normal — o caminho online
  não pode mudar de comportamento.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de
`lib/` e dos hooks de feature tocados. Sem `skip`/`only`/`xfail` sem justificativa no código
(CLAUDE.md). Story frontend-only: **não** exige `pnpm test:api:cov`, `build:types`,
`build:api-client` nem Postman.

## Fora de escopo

- UI de pendências e ações de reenviar/descartar ([[170]]).
- Migrar as telas para as novas mutations e o prefetch da casa ([[171]]).
- Dedupe/idempotência no backend — story [[172]], que precede esta.
- Sync em background com o app fechado.
