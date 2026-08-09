# Plan: ops.fonte offline — adaptação dos fluxos de campo

> Filha de [[167]]. Última da fila: [[168]] → [[169]] → [[170]] → 171.

## Context

Fatia 4 (fecho) do epic [[167]]: ligar o motor às telas. Até aqui existem persistência ([[168]]),
fila/replay ([[169]]) e visibilidade ([[170]]), mas **nenhum fluxo real** usa isso — os hooks de
feature continuam com `mutationFn` inline e sem `mutationKey`.

Fluxos de campo (definição travada no epic), com os hooks existentes:

| fluxo | hook | mutations |
|---|---|---|
| Censo | `features/census/hooks/useCensus.ts` | addResident (+foto), conclude, discharge, evade, transfer |
| Ocorrências | `features/incidents/hooks/useIncidents.ts` | create |
| Almoxarifado | `features/storeroom/hooks/useStoreroom.ts` | createMovement, createItem |
| Despensa | `features/supply-room/hooks/useSupplyRoom.ts` | createMovement, createItem |
| Venda de rua | `features/street-sales/hooks/useStreetSales.ts` | create, update |
| Atividades | `features/activities/hooks/useActivities.ts` | create, comment, mudança de status |

Fora da fila (decisão do epic): mensagens (socket.io), fotos de turma do curso bíblico, wishlist,
grupos de apoio, `house-settings`, `ministries`, `profile`.

### Decisões travadas

1. **Hooks de campo passam a declarar `mutationKey`** das chaves de [[169]] e param de repetir
   `mutationFn`/`onSuccess` — a lógica vive no `setMutationDefaults`. A assinatura pública de cada
   hook (`useCreateMovement()` etc.) **não muda**, então as pages e os testes existentes continuam
   valendo; a mudança é interna.
2. **Criar item de estoque offline gera id local.** `createItem` seguido de `createMovement` no
   mesmo período offline exige que o movimento aponte para um item que ainda não tem id do servidor.
   Travado: item criado offline recebe id temporário (`local:<uuid>`); o replay do `createItem`
   grava o mapeamento `local:<uuid> → id real` e o `createMovement` da fila resolve o id no envio.
   Item com id local aparece na lista marcado como pendente e **não** pode ser editado até subir.
3. **Pré-aquecimento (prefetch) da casa do operador** no login e ao voltar do background: residents
   da casa, catálogo de inventário, incidents de hoje, atividades da casa. Sem isso, "offline-first"
   só vale para quem abriu a tela antes de perder o sinal.
4. **Ações que não funcionam offline avisam em vez de falhar.** Botão desabilitado + texto curto
   ("Precisa de conexão") nas telas fora da fila — nada de erro genérico do axios na cara do
   operador.
5. **Marcação visual de pendente** nos itens otimistas (badge discreto no card/linha do lançamento),
   consistente com a [[170]].
6. **Censo com foto** usa o encadeamento de [[169]] (criar filho → enfileirar upload). A tela não
   muda de fluxo; o operador tira a foto normalmente.
7. **Contagem/censo não resolve conflito automaticamente** (epic): se o backend recusar uma
   transição de status no replay, vira item de "Não enviadas" com o motivo — regra de transição de
   status de Resident continua sendo do service (`BUSINESS_RULES.md`).
8. Sem mudança de backend, contrato ou Postman.

## Desenho

- **Hooks de campo** (6 arquivos da tabela): trocar `mutationFn` inline por `mutationKey` +
  variáveis; mover a invalidação para os defaults; expor o estado `isPaused` para a UI marcar
  pendente.
- **`lib/offline/localIds.ts`** (novo): geração de `local:<uuid>`, mapa persistido
  `local → real`, `resolveLocalId(value)` aplicado nas variáveis no momento do envio, e limpeza do
  mapa quando o item sai da fila.
- **`lib/offline/prefetch.ts`** (novo): `warmHouseCache(queryClient, houseId)` — `prefetchQuery` das
  chaves da casa; chamado no sucesso do login (`lib/auth.tsx`) e no retorno ao foreground
  (`focusManager` já ligado na [[168]]).
- **Componentes**: badge "pendente" reaproveitável (`components/PendingBadge.tsx`) usado nos cards
  de movimento, ocorrência, venda de rua, atividade e no item de estoque com id local.
- **Telas fora da fila**: `useIsOnline()` ([[168]]) desabilita a ação e mostra o aviso — mensagens,
  wishlist, curso bíblico, grupos de apoio, house-settings, ministries.

## Validação

**Unit (Jest/RTL — `pnpm test:ops:unit`)**

- Os testes existentes dos 6 hooks (`use*.test.tsx`) **continuam passando** com a assinatura
  inalterada — é o gate de não-regressão desta story.
- Por hook de campo: mutation offline fica `paused` e não chama a API; online envia e invalida as
  mesmas chaves de antes (comparar com o comportamento atual, não afrouxar).
- `localIds.test.ts`: `createItem` offline gera `local:*`; replay mapeia para o id real;
  `createMovement` enfileirado com `local:*` sai com o id real; item com id local é marcado como
  pendente e não editável.
- `prefetch.test.ts`: `warmHouseCache` popula as chaves esperadas; sem `houseId` não faz nada; é
  chamado no login e no retorno ao foreground.
- `PendingBadge` aparece em item otimista e some depois do envio.
- Telas fora da fila: offline → ação desabilitada + aviso; online → ação normal (uma por domínio
  fora da fila, não uma bateria redundante).

**E2E web (Playwright — `pnpm test:ops:e2e`)**

- `e2e-web/offline-field-flows.spec.ts` (novo), com `context.setOffline`:
  - **Almoxarifado**: criar item + movimento offline → ambos marcados pendentes → online → ambos
    persistem e o movimento aponta para o item criado (o teste do id local, que é o ponto mais
    frágil desta story).
  - **Ocorrência**: registrar offline → aparece na lista de hoje → online → sobe uma vez só.
  - **Censo**: remover/transferir filho offline → lista reflete → online → o backend confirma.
  - **Fluxo bloqueado**: abrir mensagens offline → ação desabilitada com o aviso, sem erro na tela.

**E2E Maestro (`pnpm test:ops`)**

- `e2e/storeroom.yaml`, `e2e/incidents.yaml`, `e2e/residents.yaml`, `e2e/dashboard.yaml` verdes com
  rede normal — nenhum fluxo online regride.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de
`features/` (censo, ocorrências, storeroom, supply-room, street-sales, atividades) nem de `lib/`.
Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md). Story frontend-only: **não**
exige `pnpm test:api:cov`, `build:types`, `build:api-client` nem Postman.

## Fora de escopo

- Colocar mensagens, wishlist, grupos de apoio, curso bíblico ou ministérios na fila.
- Idempotência/dedupe no backend (`BACKLOG.md`).
- Offline no `app.fonte` e no `resident.fonte`.
- Sync em background com o app fechado.
- Resolução automática de conflito de contagem.
