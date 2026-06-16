# Plan: Testes do ops.fonte (jest-expo + Playwright web) — filha do epic 49

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O `ops.fonte` (Expo/React Native, operadores da
casa) só tem e2e Maestro, que **exige emulador nativo** e está cronicamente bloqueado por infra de
build (ver PROGRESS stories 19 e 25: NativeWind×NewArch, Kotlin, AppRegistry). Resultado: o e2e do
ops quase nunca roda. **Zero** unit.

Decisões travadas (epic): unit com **jest-expo** + `@testing-library/react-native` (roda sem
device); e2e **web** com Playwright contra o build web do Expo (`expo export --platform web`),
determinístico e sem emulador. Maestro permanece no repo como e2e nativo **opcional** (não apagar
`e2e/*.yaml`); o gate de DoD passa a ser o e2e web.

## Desenho

### Tooling unit (jest-expo)

- `pnpm --filter ops.fonte add -D jest jest-expo @testing-library/react-native @types/jest`
  (versões compat com o SDK Expo instalado — usar a major que o `expo` corrente recomenda).
- `jest.config.js`: `preset: 'jest-expo'`, `transformIgnorePatterns` padrão do jest-expo (libs RN/Expo),
  `setupFilesAfterEnv` com `@testing-library/react-native` (e jest-native se a versão exigir).
- Coexistência com Maestro: o script `test:maestro` permanece; novo `test:unit` = `jest`. Garantir
  que o `jest` **não** colete os `.yaml` do Maestro.
- Scripts raiz: `test:ops:unit` e `test:ops:e2e`.

### Unit baseline

- libs puras: `features/storeroom`/`supply-room` → `lib/inventoryUtils.ts`
  (`toNumber/formatQuantity/formatDateBR/movementLabel`).
- 1 hook de query/mutation com `QueryClientProvider` + api-client mockado.
- 1 componente RN de apresentação (ex.: um card/badge) — render com `@testing-library/react-native`,
  checando texto exibido. `Controller`/RHF onde aplicável.

### e2e web (Playwright contra Expo web)

- Build web: `expo export --platform web` (já existe `build:web`) → `dist/`, servido por
  `npx serve dist` (já existe `start:web`). Playwright sobe esse server (`webServer` no config) ou
  consome um já no ar.
- `pnpm --filter ops.fonte add -D @playwright/test`; `playwright.config.ts` espelhando o do
  `adm.fonte` (baseURL na porta do `serve`; precisa da **API de teste** no ar para login real).
- Pasta `e2e-web/` (separada de `e2e/` do Maestro). Specs:
  - **login** do operador (espelha `e2e/auth.spec.yaml` / `helpers/login-operator.yaml`).
  - **1 fluxo** central que funcione no web (ex.: dashboard carrega, ou listar residentes) — evitar
    fluxos que dependam de API nativa (câmera/notificação push) que não existem no web.
- Documentar no spec quais telas dependem de nativo e ficam só no Maestro.

## Validação

- `pnpm test:ops:unit` (jest-expo) verde.
- `pnpm test:ops:e2e` (Playwright web) verde — exige `build:web` + API de teste no ar.
- `pnpm --filter ops.fonte build:web` gera `dist/` sem erro; `tsc --noEmit` limpo.
- Maestro `e2e/*.yaml` intactos (não deletados).

## Fora de escopo

- Resolver o build nativo do Maestro (bloqueio de infra pré-existente — fora desta story).
- Telas que só existem em nativo (câmera, push) no e2e web.
- Cobrir todas as features do ops (só baseline + 1 fluxo web).
