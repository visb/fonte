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

## Tipos compartilhados

`packages/types/src/index.ts` é o contrato comum. Ao alterar tipos:

1. Atualize consumidores backend/frontend que dependem do contrato.
2. Rode `pnpm build:types`.
3. Rode `pnpm build:api-client` se o cliente depender dos novos tipos.

## Validação recomendada

- Admin web: `pnpm --filter adm.fonte build`.
- Ops app: não há script de build no package; valide TypeScript/rotas pelo comando específico disponível ou suba com `pnpm dev:ops` quando necessário.
- Cliente compartilhado: `pnpm build:api-client`.
