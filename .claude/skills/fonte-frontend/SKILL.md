---
name: fonte-frontend
description: Padrões dos apps adm.fonte (React/Vite) e ops.fonte (Expo Router/React Native) — cliente HTTP @fonte/api-client compartilhado, rotas/auth/config de API de cada app, modo Resident e timer de uso no ops.fonte, tipos compartilhados. Use ao editar apps/adm.fonte ou apps/ops.fonte.
---

# Guia dos frontends para IA

## Apps

- `apps/adm.fonte` — React + Vite para gestão administrativa.
- `apps/ops.fonte` — Expo Router/React Native para operadores.

Ambos consomem:

- `@fonte/types` para contratos compartilhados.
- `@fonte/api-client` para chamadas HTTP.

## Cliente HTTP compartilhado

O cliente fica em `packages/api-client`.

- Entrada: `packages/api-client/src/client.ts`.
- Módulos por domínio: `packages/api-client/src/modules/*`.
- Tipos auxiliares do cliente: `packages/api-client/src/types.ts`.

Antes de criar uma chamada HTTP diretamente no app, verifique se ela pertence ao `@fonte/api-client`. Isso evita duplicação entre web e mobile.

## `adm.fonte`

Pontos principais:

- Rotas/layout: `apps/adm.fonte/src/App.tsx` e `src/components/layout/*`.
- Páginas: `apps/adm.fonte/src/pages/*`.
- Componentes base: `apps/adm.fonte/src/components/ui/*`.
- API configurada em `apps/adm.fonte/src/lib/api.ts`.
- Auth em `apps/adm.fonte/src/contexts/AuthContext.tsx`.

Padrões:

- Use componentes existentes em `components/ui` antes de criar novos componentes visuais.
- Preserve padrões de formulário existentes (`react-hook-form`, `zod`, `@hookform/resolvers`) quando mexer em telas com validação.
- Se uma tela administrativa precisa de dado novo, prefira adicionar método no `@fonte/api-client` e consumir a partir da página.

## `ops.fonte`

Pontos principais:

- Rotas via Expo Router em `apps/ops.fonte/app`.
- Auth em `apps/ops.fonte/lib/auth.tsx`.
- API configurada em `apps/ops.fonte/lib/api.ts`.
- Rotas autenticadas ficam em `app/(app)`; rotas de autenticação ficam em `app/(auth)`.

Padrões:

- Considere diferenças de ambiente: Android usa `10.0.2.2` como fallback local da API.
- Preserve o fluxo de senha obrigatória quando tocar em login/troca de senha.
- Use o cliente compartilhado para manter paridade com `adm.fonte`.

### Modo Resident no ops.fonte

Residents (role `RESIDENT`) fazem login no ops.fonte com acesso restrito:

- `lib/auth.tsx` detecta `profileType: RESIDENT` na resposta de login e busca `api.residents.me()` em vez de `api.staff.me()`. O estado `AuthContext` expõe `resident: ResidentMe | null` e `isResident: boolean`.
- `app/(app)/_layout.tsx` oculta todas as tabs normais para residents (`href: null`), exibindo apenas: **Início** (`resident-home`), **Mensagens** e **Pedidos**.
- Para residents o layout envolve as tabs com `UsageTimerProvider` (`lib/UsageTimerContext.tsx`), que:
  - Busca `getToday()` uma única vez no mount (sem re-fetch por navegação entre telas).
  - Usa `Date.now()` para medir tempo real — sem drift de `setInterval`.
  - Envia heartbeat a cada 10 s com os segundos decorridos; o backend retorna o total acumulado (incluindo outros devices) e o contexto sincroniza o estado local.
  - Faz resync completo via `getToday()` a cada 60 s para pegar uso de outros devices.
  - Flush automático ao navegar para fora das telas cronometradas.
- `components/TimeLimitedScreen.tsx` consome `useUsageTimerContext()` (não cria timer próprio). Exibe banner de countdown e bloqueia a tela quando limite atingido.
- Telas de Mensagens e Pedidos envolvem seu conteúdo em `TimeLimitedScreen` quando `isResident`. A tela Início (`resident-home`) fica fora — navegar para ela para o timer.

## Tipos compartilhados

`packages/types/src/index.ts` é o contrato comum. Ao alterar tipos:

1. Atualize consumidores backend/frontend que dependem do contrato.
2. Rode `pnpm build:types`.
3. Rode `pnpm build:api-client` se o cliente depender dos novos tipos.

## Validação recomendada

- Admin web: `pnpm --filter adm.fonte build`.
- Ops app: não há script de build no package; valide TypeScript/rotas pelo comando específico disponível ou suba com `pnpm dev:ops` quando necessário.
- Cliente compartilhado: `pnpm build:api-client`.
