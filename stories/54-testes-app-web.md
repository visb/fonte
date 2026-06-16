# Plan: Testes do app.fonte (jest-expo + Playwright web) — filha do epic 49

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O `app.fonte` (Expo/React Native, familiares —
role RELATIVE) só tem e2e Maestro (exige emulador) e **zero** unit. Mesmo problema do ops: o e2e
nativo raramente roda. Espelha a abordagem da story 53.

Decisões travadas (epic): unit **jest-expo** + RTL native; e2e **web** Playwright contra
`expo export --platform web`; Maestro mantido como e2e nativo opcional.

## Desenho

### Tooling unit (jest-expo)

- Mesma instalação/config da story 53 (`jest-expo` + `@testing-library/react-native`).
- `jest.config.js` preset jest-expo; `test:unit` = `jest` sem coletar os `.yaml` do Maestro.
- Scripts raiz: `test:app:unit`, `test:app:e2e`.

### Unit baseline

- libs/utils puros do app (formatação, helpers de auth/sessão).
- 1 hook de query/mutation com `QueryClientProvider` + api-client mockado.
- 1 componente RN de apresentação (`MessageInput` é grande — testar um menor, ex.: card/badge de
  home/profile) com `@testing-library/react-native`.

### e2e web (Playwright contra Expo web)

- `expo export --platform web` (`build:web`) → `dist/`, servido por `start:web`. Playwright config
  espelhando adm/ops; API de teste no ar para login real.
- Pasta `e2e-web/`. Specs:
  - **login** do familiar (espelha `e2e/auth.yaml` / `helpers/login.yaml`) e first-login set
    password se viável no web.
  - **home** carrega + 1 fluxo simples (ex.: abrir perfil ou lista de mensagens).
- Telas dependentes de nativo (push, checkin por câmera/QR) ficam só no Maestro — documentar.

## Validação

- `pnpm test:app:unit` (jest-expo) verde.
- `pnpm test:app:e2e` (Playwright web) verde — exige `build:web` + API de teste no ar.
- `pnpm --filter app.fonte build:web` gera `dist/` sem erro; `tsc --noEmit` limpo.
- Maestro `e2e/*.yaml` intactos.

## Fora de escopo

- Build nativo / Maestro em emulador.
- Checkin por QR/câmera no e2e web (depende de nativo).
- Cobrir todas as telas (só baseline + 1 fluxo web).
