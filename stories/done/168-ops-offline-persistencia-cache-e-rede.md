# Plan: ops.fonte offline — persistência de cache e estado de rede

> Filha de [[167]]. Primeira da fila: 168 → [[169]] → [[170]] → [[171]].

## Context

Fatia 1 do epic [[167]]: fazer o `ops.fonte` **abrir com dado** sem rede. Nenhuma escrita muda
aqui — só leitura, estado de rede e o aviso visual.

Estado verificado:

- `app/_layout.tsx:19-21` — `QueryClient` com `retry: 1`, `staleTime: 30_000` e **sem `gcTime`**
  (default 5 min). Qualquer persistência sem ajustar `gcTime` é inútil: a query é coletada antes de
  o cache ser reidratado com utilidade.
- `lib/auth.tsx:7` — `STORAGE_KEYS = ['token', 'staff', 'resident']`; `logout()` limpa só isso.
- `app/(app)/_layout.tsx` é o layout autenticado — lugar natural do banner.
- Não existe `@react-native-community/netinfo` nas deps (`package.json`).
- O app roda em **três alvos**: nativo (Expo), web (`react-native-web`, usado pelo e2e Playwright)
  e o modo resident/kiosk. A infra precisa ser neutra nos três.

### Decisões travadas

1. **Allowlist de persistência, não denylist.** `dehydrateOptions.shouldDehydrateQuery` só deixa
   passar as chaves dos fluxos de campo + o que a home precisa. Dado pessoal que ninguém consome
   offline não vai para o disco (decisão LGPD do epic).
2. **`gcTime: 24h` e `maxAge: 24h`** no persister. Cache mais velho que 24h é descartado na
   reidratação — o operador não decide nada com base em contagem de anteontem.
3. **Buster versionado à mão** (`PERSIST_BUSTER` em `lib/offline/constants.ts`), incrementado
   quando a forma dos dados cacheados muda. Deploy novo com formato novo não reidrata lixo.
4. **`onlineManager` ligado ao NetInfo** com `isConnected && isInternetReachable !== false` — o
   `!== false` evita tratar o `null` inicial (ainda apurando) como offline e travar o app na
   abertura.
5. **`focusManager` ligado ao `AppState`** — voltar do background revalida, que é o gatilho natural
   de "cheguei num lugar com sinal".
6. **Offline não é sessão expirada.** O handler de 401 (`lib/api.ts:31-33`, story [[165]]) só pode
   disparar em 401 de verdade. Erro de rede (`!error.response`) nunca pode derrubar a sessão —
   cobrir isso com teste, é a regressão mais cara possível aqui.
7. **Limpar o cache persistido no logout e na sessão expirada**, junto com `STORAGE_KEYS`.
8. Sem mudança de backend, de contrato ou de fluxo.

## Desenho

### Dependências novas (`apps/ops.fonte/package.json`)

- `@tanstack/react-query-persist-client`
- `@tanstack/query-async-storage-persister`
- `@react-native-community/netinfo` — na versão pinada pelo Expo SDK 52 (`npx expo install`, não
  `pnpm add` solto).

### `lib/offline/constants.ts` (novo)

- `PERSIST_KEY = 'ops-fonte-query-cache'`, `PERSIST_BUSTER`, `PERSIST_MAX_AGE = 24h`,
  `QUERY_GC_TIME = 24h`.
- `PERSISTED_QUERY_PREFIXES`: prefixos de `queryKeys` que podem ir para o disco — `residents`
  (byHouse/countByHouse/detail), `houses`, `inventory.catalog`, `storeroom.*`, `supplyRoom.*`,
  `incidents.*`, `activities.*`, `streetSales.*`. Fora da lista: mensagens, notificações,
  wishlist, grupos de apoio, curso bíblico.

### `lib/offline/persister.ts` (novo)

- `createAsyncStoragePersister({ storage: AsyncStorage, key: PERSIST_KEY, throttleTime })`.
- `clearPersistedCache()` — usado pelo `logout()` e pela sessão expirada.

### `lib/offline/network.ts` (novo)

- `startNetworkWatcher()`: assina `NetInfo.addEventListener`, alimenta `onlineManager.setOnline(...)`
  e devolve o unsubscribe.
- `startFocusWatcher()`: assina `AppState`, alimenta `focusManager.setFocused(...)` (no-op em web,
  onde o React Query já usa `visibilitychange`).
- `useIsOnline()`: hook sobre `onlineManager.subscribe` para a UI.

### `app/_layout.tsx`

- `QueryClientProvider` → `PersistQueryClientProvider` com `persistOptions: { persister, maxAge,
  buster, dehydrateOptions }`.
- `QueryClient` ganha `gcTime: QUERY_GC_TIME` e `networkMode` explícito nas queries.
- `useEffect` monta os dois watchers e devolve os unsubscribes no cleanup.

### `components/OfflineBanner.tsx` (novo) + `app/(app)/_layout.tsx`

- Faixa fixa no topo quando offline: "Sem conexão — você continua trabalhando; os lançamentos vão
  ser enviados quando o sinal voltar." Some sozinha ao voltar a rede. `testID="offline-banner"`.
- Segue o padrão de componente compartilhado do app (CLAUDE.md — componentes de estado
  compartilhados em vez de `Text` solto).

### `lib/auth.tsx`

- `logout()` e o caminho de sessão expirada chamam `clearPersistedCache()` + `queryClient.clear()`.

## Validação

**Unit (Jest/RTL — `pnpm test:ops:unit`)**

- `lib/offline/network.test.ts`: NetInfo `{isConnected:true,isInternetReachable:true}` → online;
  `{isConnected:false}` → offline; `{isConnected:true,isInternetReachable:null}` → **online**
  (estado indeterminado não vira offline); unsubscribe é chamado no cleanup.
- `lib/offline/persister.test.ts`: `shouldDehydrateQuery` aceita chave da allowlist e **rejeita**
  chave fora dela (mensagens, notificações, wishlist); `clearPersistedCache` remove `PERSIST_KEY`
  do AsyncStorage.
- `lib/auth.test.tsx` (existente, estender): logout limpa `STORAGE_KEYS` **e** o cache persistido;
  erro de rede (`axios` sem `response`) **não** marca `sessionExpired`; 401 continua marcando
  (não regredir a story [[165]]).
- `components/OfflineBanner.test.tsx`: renderiza offline, some online.

**E2E web (Playwright — `pnpm test:ops:e2e`)**

- `e2e-web/offline.spec.ts` (novo): logar, carregar a home, `context.setOffline(true)`, recarregar
  a página → o banner aparece e a lista continua exibindo os dados cacheados (não cai em erro nem
  em vazio); `setOffline(false)` → banner some.

**E2E Maestro (`pnpm test:ops`)**

- Rodar os yamls existentes sem alteração — a mudança de provider não pode quebrar login, dashboard,
  incidents, storeroom, residents.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura de
`lib/` nem de `components/`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
Story frontend-only: **não** exige `pnpm test:api:cov`, `build:types`, `build:api-client` nem
Postman.

## Fora de escopo

- Fila de escrita e replay ([[169]]).
- Tela de pendências ([[170]]).
- Mudar qualquer fluxo/tela de negócio ([[171]]).
- Pré-aquecimento (prefetch) do cache — vai na [[171]].
