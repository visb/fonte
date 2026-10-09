---
name: fonte-frontend
description: Padrões dos apps adm.fonte (React/Vite), portal.fonte (React/Vite público, sem login) e ops.fonte/app.fonte (Expo Router/React Native) — arquitetura em vertical slices (features/) + MVVM (Model = tipos/api-client, ViewModel = hooks, View = pages/components), cliente HTTP @fonte/api-client compartilhado, rotas/auth/config de cada app, modo Resident e timer de uso no ops.fonte, tipos compartilhados. Use ao editar apps/adm.fonte, apps/portal.fonte, apps/ops.fonte ou apps/app.fonte.
---

# Guia dos frontends para IA

## Apps

- `apps/adm.fonte` — React + Vite para gestão administrativa.
- `apps/portal.fonte` — React + Vite público, sem login; acesso por token na URL.
- `apps/ops.fonte` — Expo Router/React Native para operadores.
- `apps/app.fonte` — Expo/React Native para familiares (role `RELATIVE`).

Todos consomem `@fonte/types` (contratos) e `@fonte/api-client` (HTTP).

---

## Arquitetura: vertical slices + MVVM

Estes apps são organizados em **vertical slices** (uma pasta por domínio, autossuficiente) e cada slice segue **MVVM**. As duas ideias se encaixam: o slice é a fatia vertical; o MVVM é como as camadas se dividem **dentro** do slice.

### Vertical slice (fatia por domínio)

```
features/<domínio>/        ← ex.: residents, billing, messages, houses
  hooks/        ← ViewModel: queries, mutations, estado derivado, lógica de form
  pages/        ← View de orquestração (compõe hooks + componentes; sem fetch)
  components/   ← View de apresentação (dumb; recebe props, emite eventos)
  constants.ts  ← labels, variantes, mapas de exibição do domínio
  lib/          ← helpers puros do domínio (formatadores, cálculos)
```

Regras do slice:

- **Autossuficiente**: um slice não importa `hooks/`, `components/` ou `lib/` internos de **outro** slice. Se dois domínios precisam do mesmo código, ele sobe para o compartilhado (`components/shared/`, `src/lib/`, `src/hooks/`) ou para `@fonte/api-client` (se for HTTP).
- **Borda do slice é o ViewModel**: o que sai do slice para outras telas é um hook ou um componente exportado com nome próprio — nunca o estado cru.
- Criar um domínio novo = criar uma pasta nova em `features/`, não espalhar arquivos em `pages/` ou `components/` globais.

### MVVM (camadas dentro do slice)

| Camada | É | Onde vive | Regras |
|---|---|---|---|
| **Model** | dados + contrato + domínio | `@fonte/types`, `@fonte/api-client`, `features/<d>/constants.ts`, `features/<d>/lib/` | Sem React. Tipos, chamadas HTTP, regras puras. |
| **ViewModel** | estado + lógica + I/O | `features/<d>/hooks/` | Todo `useQuery`/`useMutation`/`useForm`/estado derivado vive aqui. Expõe dados prontos + handlers. Um hook por responsabilidade. |
| **View** | UI | `features/<d>/pages/` (orquestração) + `features/<d>/components/` (apresentação) | **Não** faz fetch, **não** tem regra de negócio. Lê do ViewModel e renderiza. |

Fluxo: **View → chama hook (ViewModel) → hook usa Model (api-client/types)**. Nunca a View pula direto para o Model.

#### O que isso proíbe (já no AGENTS.md — reforçado aqui)

- ❌ `useQuery`/`useMutation`/`useForm` importados numa **page**. Page só compõe hooks + componentes.
  ```ts
  // ✅ ViewModel
  // features/residents/hooks/useResidents.ts
  export function useResidents() { return useQuery({ queryKey: queryKeys.residents.all, queryFn: api.residents.list }); }

  // ✅ View de orquestração
  // features/residents/pages/ResidentsPage.tsx
  export function ResidentsPage() {
    const { data, isLoading } = useResidents();        // ViewModel
    if (isLoading) return <LoadingState />;
    return <ResidentList residents={data ?? []} />;    // View de apresentação
  }
  ```
- ❌ Fetch/regra dentro de componente de apresentação. Componente recebe props, emite callbacks.
- ❌ Query key como string literal fora de `lib/queryKeys.ts`.
- ❌ `useState` para campo de formulário — usar `react-hook-form` + `zod` (no RN sempre `Controller`). A lógica do form (schema, `useForm`, submit) é ViewModel; o JSX do form é View.
- ❌ Cast manual de erro de API — usar `getErrorMessage(error, fallback?)`.
- ❌ Loading/empty/error ad-hoc — usar os componentes de estado compartilhados (`LoadingState`/`EmptyState`/`ErrorState` no adm; equivalentes no ops/app).
- ❌ Componente > ~150 linhas ou com mais de uma responsabilidade visual — quebrar (extrair o item de lista, o header, o card).

#### Dialogs autossuficientes

Dialog é uma View que tem seu próprio ViewModel: busca seus dados via hook do slice (`{ enabled: open }`), sem prop drilling de dados que só ele usa.

---

## Cliente HTTP compartilhado (Model)

`packages/api-client`:

- Entrada: `packages/api-client/src/client.ts`.
- Módulos por domínio: `packages/api-client/src/modules/*`.
- Tipos auxiliares do cliente: `packages/api-client/src/types.ts`.

Antes de criar uma chamada HTTP no app, verifique se ela já existe (ou deveria existir) no `@fonte/api-client` — é a camada Model compartilhada entre web e mobile. Não duplicar fetch por app.

---

## `adm.fonte`

- Slices: `apps/adm.fonte/src/features/*` (auth, residents, billing, houses, messages, notifications, census, dashboard, bible-courses, backup…).
- Rotas/layout: `apps/adm.fonte/src/App.tsx` e `src/components/layout/*`.
- Componentes base (design system, cross-slice): `apps/adm.fonte/src/components/ui/*`; estados compartilhados em `src/components/shared/*`.
- Query keys: `apps/adm.fonte/src/lib/queryKeys.ts`. Erros: `src/lib/errors.ts`. API: `src/lib/api.ts`. Auth: `src/contexts/AuthContext.tsx`.

Padrões:

- Use `components/ui` antes de criar componente visual novo.
- Formulários: `react-hook-form` + `zod` + `@hookform/resolvers` (lógica no hook/ViewModel, JSX na View).
- Tela precisa de dado novo → adicionar método no `@fonte/api-client` → consumir via hook do slice → page orquestra.

---

## `portal.fonte`

Portal público em React + Vite (porta dev 5175). **Sem login e sem `AuthContext`**: a credencial é o
token da URL, enviado pelo backend em link de WhatsApp.

- Rotas (`src/App.tsx`): `/p/:token` e `/:token` (pagamento de associado), `/cancelar/:token`
  (autocancelamento de assinatura), `/eventos` + `/eventos/:id` (eventos públicos),
  `/pagamento/:token` (inscrição em evento pago). Raiz e rota desconhecida caem em `InvalidLinkPage`.
- Slices: `src/features/payment`, `src/features/cancel`, `src/features/events` — mesma estrutura
  vertical slice + MVVM do `adm.fonte`.
- Compartilhado: `src/lib/api.ts`, `queryKeys.ts`, `errors.ts`, `money.ts`, `cardTokenizer.ts`
  (tokenização de cartão no cliente — o PAN nunca vai para a API do fonte),
  `src/components/BrandHeader.tsx` e `StateScreens.tsx` (loading/erro/link inválido).
- Não tem design system próprio como `components/ui` do adm; componentes visuais ficam no slice ou
  em `src/components/`.

Padrões:

- Token sempre vem de `useParams` e é repassado ao hook do slice — nunca guarde em contexto global.
- Toda página precisa tratar token inválido/expirado → `StateScreens`, não crash.
- Formulários: `react-hook-form` + `zod`, igual ao `adm.fonte`.

---

## `ops.fonte` e `app.fonte`

- Slices: `apps/ops.fonte/features/*` e `apps/app.fonte/features/*`.
- Rotas via Expo Router em `app/` (`app/(app)` autenticadas, `app/(auth)` autenticação).
- Auth em `lib/auth.tsx`; API em `lib/api.ts`; query keys em `lib/queryKeys.ts`.

Padrões:

- React Native: `className` (NativeWind) para estilo; `Controller` obrigatório em form (`TextInput` não aceita `register`).
- Ambiente: Android usa `10.0.2.2` como fallback local da API.
- Preserve o fluxo de senha obrigatória ao tocar login/troca de senha.
- Use o cliente compartilhado para manter paridade entre os apps.

### Modo Resident no ops.fonte

Residents (role `RESIDENT`) fazem login no ops.fonte com acesso restrito:

- `lib/auth.tsx` detecta `profileType: RESIDENT` no login e busca `api.residents.me()` em vez de `api.staff.me()`. `AuthContext` expõe `resident: ResidentMe | null` e `isResident: boolean`.
- `app/(app)/_layout.tsx` oculta as tabs normais para residents (`href: null`), exibindo só: **Início** (`resident-home`), **Mensagens**, **Pedidos**.
- Para residents o layout envolve as tabs com `UsageTimerProvider` (`lib/UsageTimerContext.tsx`) — o ViewModel do timer:
  - Busca `getToday()` uma vez no mount (sem re-fetch por navegação).
  - Usa `Date.now()` para medir tempo real — sem drift de `setInterval`.
  - Heartbeat a cada 10 s com segundos decorridos; o backend retorna o total acumulado (todos os devices) e o contexto sincroniza.
  - Resync completo via `getToday()` a cada 60 s.
  - Flush automático ao sair das telas cronometradas.
- `components/TimeLimitedScreen.tsx` consome `useUsageTimerContext()` (não cria timer próprio): banner de countdown + bloqueio ao atingir o limite.
- Mensagens e Pedidos envolvem o conteúdo em `TimeLimitedScreen` quando `isResident`; Início (`resident-home`) fica fora — navegar para ela pausa o timer.

### Offline-first no ops.fonte (invariante do app)

O `ops.fonte` é usado **dentro das casas, sem sinal confiável**. Offline-first não é feature
opcional dele: é requisito permanente. Toda mudança no app preserva isso.

> **Estado:** a infraestrutura está planejada no epic `stories/167-ops-offline-first-epic.md`
> (filhas 168–171) e **pode ainda não estar implementada**. Antes de aplicar as regras abaixo,
> confira se `apps/ops.fonte/lib/offline/` existe. Se não existir, a infra é a story 168 —
> não improvise uma solução paralela; implemente/estenda o que o epic desenhou.

Regras ao tocar `apps/ops.fonte`:

- **Leitura**: cache do React Query é persistido em AsyncStorage (`PersistQueryClientProvider`).
  Query key nova que o operador consome em campo entra na allowlist de
  `lib/offline/constants.ts` — o que fica fora **não** vai para o disco. A allowlist é decisão de
  LGPD (dado pessoal de filho no dispositivo), não detalhe técnico: não transformar em denylist.
- **Escrita de campo** (censo, ocorrências, almoxarifado, despensa, venda de rua, atividades):
  mutation **nunca** com `mutationFn` inline. Declare `mutationKey` de `OUTBOX_MUTATION_KEYS` e
  registre `mutationFn` + invalidação em `lib/offline/mutationDefaults.ts` com
  `networkMode: 'offlineFirst'`. `mutationFn` inline não é serializável ⇒ o lançamento feito em
  campo se perde no restart. Chave nova também precisa de rótulo em `features/sync/constants.ts`
  (há teste de catálogo que quebra sem isso).
- **Escrita fora dos fluxos de campo** (mensagens/socket.io, wishlist, grupos de apoio, curso
  bíblico, ministérios, house-settings): continua exigindo rede — desabilite a ação com aviso via
  `useIsOnline()`, nunca deixe estourar erro genérico de axios na cara do operador.
- **Falha no replay**: rejeição do servidor (4xx de negócio) vai para a dead-letter e aparece na
  tela de pendências (`/sync`) com a mensagem do backend. Erro de rede **não** é falha — o item
  continua na fila. Nunca descartar item de fila em silêncio.
- **Sem rede ≠ sessão expirada.** O handler de 401 (`lib/api.ts`) só dispara em 401 real; erro sem
  `response` jamais pode derrubar a sessão (story 165).
- **Anexo em mutation enfileirada** guarda o arquivo copiado em `documentDirectory/outbox/`, não o
  URI do picker (o SO evict o temporário antes do replay).
- **Teste de offline mora no Playwright web** (`apps/ops.fonte/e2e-web/`, `context.setOffline`) —
  o Maestro não controla rede. Fluxo de campo novo ganha caso offline lá.

### Rodar a suíte Maestro do ops.fonte (`pnpm test:ops`) — story 184

Receita, na ordem:

1. AVD em **API 34** (obrigatório, ver abaixo):
   `sdkmanager "system-images;android-34;google_apis;x86_64"` +
   `avdmanager create avd -n Maestro_API34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6`
   → `emulator -avd Maestro_API34`.
2. `pnpm test:setup` + `pnpm dev:api:test` (API de teste na 3001) + `pnpm dev:ops` (Metro).
3. `pnpm --filter ops.fonte build:e2e:android` — usa `ANDROID_HOME`, aborta se o API level for > 34,
   lê a ABI do aparelho (`ro.product.cpu.abi`) e exporta as env vars do release. Com mais de um
   aparelho conectado, passe `--device <serial>` (ou `ANDROID_SERIAL`): `adb shell` sem serial falha
   com "more than one device/emulator".
4. `adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk`.
5. `maestro test --device <serial> e2e/` (`--device` é opção do subcomando `test`; antes de `test`
   o CLI trava sem saída).

**Três sintomas que apontam para o lugar errado** — é o que se perde entre sessões:

| Sintoma | Causa real |
|---|---|
| Login diz **"WhatsApp/e-mail ou senha incorretos"** | Cleartext bloqueado: release não fala `http://`. `usesCleartextTraffic` sai de `app.config.js` e só liga quando `EXPO_PUBLIC_API_URL` é `http://` — build feito sem essa env, ou manifest editado à mão (evapora no prebuild, `android/` é CNG). Não é senha nem seed. |
| **Spinner infinito** no login | `onlineManager` desligado: `lib/offline/network.ts` marca offline enquanto `isInternetReachable === false`, e o React Query com `networkMode: 'online'` **pausa** a mutation. Emulador recém-bootado ainda não validou a rede — espere aquecer. Comportamento correto do app. |
| `gRPC ... UNAVAILABLE` / `Not able to reach the gRPC server` / loop de `Failed to record heartbeat` | **API level do emulador**. Maestro 2.6.x não opera em SDK 36/37. Checar isso **antes** de investigar o app. |

Outros detalhes que custaram tempo: ABI errada gera APK sem as libs dos módulos compilados do fonte
(`libexpo-modules-core.so` etc.); `SENTRY_DISABLE_AUTO_UPLOAD=true` é obrigatório no release (sem
org/slug o build **falha**); `inputText` do Maestro não digita não-ASCII e o match de texto é regex
de correspondência total (`"Aprovados"` não casa `"Aprovados (1)"`).

---

## Tipos compartilhados (Model)

`packages/types/src/index.ts` é o contrato comum. Ao alterar tipos:

1. Atualize consumidores backend/frontend do contrato.
2. `pnpm build:types`.
3. `pnpm build:api-client` se o cliente depender dos novos tipos.

---

## Validação recomendada

- Admin web: `pnpm --filter adm.fonte build`.
- Portal: `pnpm build:portal` (ou `pnpm test:portal` para os unit tests).
- Ops/app: sem script de build; valide TypeScript (`pnpm --filter ops.fonte exec tsc --noEmit`) e rotas, ou suba com `pnpm dev:ops` / `pnpm dev:app`.
- Cliente compartilhado: `pnpm build:api-client`.
