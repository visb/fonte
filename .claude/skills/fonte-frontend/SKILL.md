---
name: fonte-frontend
description: Padrões dos apps adm.fonte (React/Vite) e ops.fonte (Expo Router/React Native) — arquitetura em vertical slices (features/) + MVVM (Model = tipos/api-client, ViewModel = hooks, View = pages/components), cliente HTTP @fonte/api-client compartilhado, rotas/auth/config de cada app, modo Resident e timer de uso no ops.fonte, tipos compartilhados. Use ao editar apps/adm.fonte ou apps/ops.fonte.
---

# Guia dos frontends para IA

## Apps

- `apps/adm.fonte` — React + Vite para gestão administrativa.
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

#### O que isso proíbe (já no CLAUDE.md — reforçado aqui)

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

---

## Tipos compartilhados (Model)

`packages/types/src/index.ts` é o contrato comum. Ao alterar tipos:

1. Atualize consumidores backend/frontend do contrato.
2. `pnpm build:types`.
3. `pnpm build:api-client` se o cliente depender dos novos tipos.

---

## Validação recomendada

- Admin web: `pnpm --filter adm.fonte build`.
- Ops/app: sem script de build; valide TypeScript (`pnpm --filter ops.fonte exec tsc --noEmit`) e rotas, ou suba com `pnpm dev:ops` / `pnpm dev:app`.
- Cliente compartilhado: `pnpm build:api-client`.
