# Plan: Cobertura de testes — `app.fonte` (React Native) 4.61→80%

> Filha do epic **78**. App pequeno (47 arquivos, 25 em features). Curta — alvo de 1–2 PRs.
> Separada de `ops.fonte` (story **81**) por porte muito diferente.

## Context

`app.fonte` media **4.61%** (20 tests, 47 arquivos) com `preset: jest-expo`. `collectCoverageFrom`
já configurado (story 78) sobre `app/components/features/lib`. Dep `@testing-library/react-native` já
instalada.

7 features: `auth checkin home messages privacy profile wishlist` (25 arquivos em `features/`, 14 em
rotas `app/`).

> **Re-baseline:** os 4.61% incluíam rotas `app/**`; com `app/**` fora do denominador, medir o ponto
> de partida real sobre `features+lib+components` antes de começar. Excluir rota não é progresso de
> teste (caveat do 78).

### Decisões travadas

- Mesma stack/decisões da 81 (RTL-native, hooks com QueryClient + mock api-client, `Controller`,
  rotas fora do denominador).
- **`checkin`** tem regra (presença em grupo de apoio) — cobrir bem (lib + hook).
- **`privacy`** (LGPD/consentimento no app do familiar) — cobrir fluxos de consentimento.

## Desenho — 1–2 PRs, camadas lib → hooks → componentes

- **84a** — `checkin` + `wishlist` + `messages` (núcleo de uso do familiar).
- **84b** — `auth` + `home` + `profile` + `privacy` (fecham o piso).

Telas/rotas fora; assert real em cada caminho. Meta **80% statements**.

## Fora de escopo

- E2E Maestro; `ops.fonte` (story 81); `resident.fonte`.

## Validação

- `pnpm --filter app.fonte test:unit -- --coverage` ≥ piso vigente; **80%** ao final.
- Maestro existente não regredir.
- Sem `skip/only` sem justificativa.
