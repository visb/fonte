# Plan (EPIC): ops.fonte offline-first

> **Status: PLANEJAMENTO.** Epic. Filhas: [[168]] (persistência de cache + estado de rede),
> [[169]] (outbox e replay de escrita), [[170]] (tela de pendências de sincronização),
> [[171]] (adaptação dos fluxos de campo). Implementar na ordem 168 → 169 → 170 → 171.

## Context

O `ops.fonte` é usado pelos operadores **dentro das casas**, onde o sinal é ruim ou inexistente
(contagem no pátio, lançamento de despensa/almoxarifado no depósito, ocorrência no momento em que
acontece, venda de rua fora da casa). Hoje o app **não tem nenhuma infraestrutura offline**:

Estado verificado (2026-08-09):

- `app/_layout.tsx:19-21` — `new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime:
  30_000 } } })`. Cache **só em memória**: fechou o app, perdeu tudo. Sem `gcTime`, sem persister.
- Nenhuma ocorrência de `NetInfo`, `onlineManager`, `focusManager`, `persistQueryClient` ou outbox
  no app (grep em `apps/ops.fonte`, só bate `keyboardShouldPersistTaps`).
- Todas as mutations são `useMutation` com `mutationFn` inline e sem `mutationKey`
  (`features/*/hooks/use*.ts`) — nenhuma é retomável depois de um restart.
- `lib/api.ts` cria o client HTTP fora da árvore React; `onUnauthorized` já existe (story [[165]]),
  mas não há distinção entre "sem rede" e "sessão expirada".
- Sem rede, o operador vê tela de erro/vazio e **perde o lançamento** que acabou de digitar.

### Decisões travadas

1. **Alcance**: leitura cacheada em todo o app + **escrita em fila apenas nos fluxos de campo** —
   censo, ocorrências, despensa (`supply-room`), almoxarifado (`storeroom`), venda de rua e
   atividades. Fluxos que dependem de terceiros em tempo real (mensagens via socket.io, fotos de
   turma do curso bíblico, wishlist, grupos de apoio) **continuam exigindo rede** e apenas informam
   isso na UI.
2. **Persistência**: `@tanstack/react-query-persist-client` +
   `@tanstack/query-async-storage-persister` sobre AsyncStorage. Mantém os hooks existentes e o
   `queryKeys.ts` como estão; o custo é registrar `mutationKey` + `setMutationDefaults` nas
   mutations de campo. Descartado SQLite como fonte de verdade local (reescreveria a camada de
   dados inteira) e outbox 100% própria (mais código para manter sem ganho sobre o pause/resume
   nativo do React Query).
3. **Conflito no replay**: item que falha por **rejeição do servidor** (4xx de regra de negócio,
   validação, permissão) **para**, vai para uma dead-letter persistida e aparece numa tela
   "Pendências de sincronização" com o erro do backend. O operador reenvia ou descarta
   explicitamente. **Nada é descartado em silêncio.** Falha por **rede** não é falha: o item
   continua pausado e tenta de novo quando voltar o sinal.
4. **LGPD**: o cache persistido guarda dado pessoal de filho no dispositivo. Portanto — persistir
   **só as query keys em allowlist** (fluxos de campo + o que a home precisa), e **limpar o cache
   persistido no logout e na sessão expirada**, junto com as chaves de auth. Isso amarra com o
   inventário de `docs/lgpd/DIAGNOSTICO_LGPD.md`.
5. **Login continua online.** Sessão já autenticada funciona offline (token/staff já ficam em
   AsyncStorage, `lib/auth.tsx:52-60`); autenticar pela primeira vez sem rede está fora de escopo.
6. **Sem mudança de backend neste epic.** Nenhum endpoint, entity, migration ou DTO é alterado ⇒
   **sem** atualizar `fonte-api.postman_collection.json`, sem `build:types` / `build:api-client`.

### Risco residual — resolvido pela story [[172]], fora deste epic

O replay não é idempotente do lado do servidor: se a requisição chega ao backend mas a resposta se
perde, o item continua na fila e um reenvio **duplica** o lançamento (crítico para movimento de
estoque, que não tem estorno — `BUSINESS_RULES.md`). Mitigação de cliente (item só sai da fila com
ack) não cobre esse caso.

A solução é a story [[172]] — header `Idempotency-Key` deduplicado pelo backend nos endpoints de
escrita de campo. É mudança de backend + contrato, então fica **fora** deste epic, mas
**precede a [[169]]**: ordem final de implementação **172 → 168 → 169 → 170 → 171** (a 172 é
independente das demais e pode ser feita em paralelo com a 168).

## Desenho (visão de epic)

1. **[[168]] Infra de persistência e estado de rede** — `PersistQueryClientProvider`, allowlist de
   dehydrate, `gcTime`/`maxAge`, buster de schema, `onlineManager` ligado ao NetInfo,
   `focusManager` ligado ao AppState, banner "Você está offline", limpeza do cache no logout.
   Sem mudança de fluxo: o app só passa a **abrir com dado**.
2. **[[169]] Outbox e replay** — `mutationKey` + `setMutationDefaults` para as mutations de campo,
   `networkMode: 'offlineFirst'`, persistência de mutations pausadas, `resumePausedMutations` na
   volta da rede e na reidratação, update otimista, anexo de foto sobrevivendo ao restart
   (cópia para `FileSystem.documentDirectory`), dead-letter para rejeição do servidor.
3. **[[170]] Tela de pendências de sincronização** — `features/sync/`, rota própria, lista de itens
   pendentes/falhos com rótulo humano + erro do backend, ações reenviar/descartar, badge de
   contagem na home.
4. **[[171]] Adaptação dos fluxos de campo** — cada fluxo passa a usar as mutations retomáveis,
   pré-aquecimento do cache da casa do operador no login/foreground, e a UI dos fluxos que **não**
   funcionam offline passa a dizer isso em vez de falhar com erro genérico.

## Validação (visão de epic)

Cada filha traz sua própria Validação com **gate de cobertura**. No fecho do epic:

- `pnpm test:ops:unit:cov` verde, sem redução de cobertura em `lib/` e `features/` tocados.
- `pnpm test:ops:e2e` (Playwright web) cobrindo o ciclo offline ponta a ponta — o Playwright
  consegue simular queda de rede com `context.setOffline(true)` e o NetInfo em web lê
  `navigator.onLine`, então **é nele que mora o e2e de offline** (o Maestro não controla rede).
- `pnpm test:ops` (Maestro) continua verde nos yamls existentes — nenhum fluxo online regride.
- Nada de backend: `pnpm test:api` não é exigido por este epic (rodar só se algo escapar do escopo).

## Fora de escopo

- Login offline (primeira autenticação sem rede).
- Idempotência de escrita no backend (header `Idempotency-Key` deduplicado) — story [[172]], própria.
- Offline no `app.fonte` (familiares) e no `resident.fonte`.
- Mensagens em tempo real (socket.io) offline, fotos de turma do curso bíblico, wishlist e grupos
  de apoio em fila.
- Sincronização em background (headless/`expo-background-task`): o replay acontece com o app aberto.
- Resolução automática de conflito (merge de contagens divergentes) — o operador decide.
