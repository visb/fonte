# PROGRESS — rodada 173 + 174 (encerrada)

Rodada de autorun **173 + 174** — UX de senha e safe area dos apps mobile. Encerrada em 2026-08-10.

## Config da rodada

- **Tema:** UX de entrada de dados nos apps — toggle "ver senha" em todo campo de senha (173) e
  correção do header cortado pela status bar no `ops.fonte` (174).
- **Ordem:** 173 → 174.
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma dep de conteúdo, mas a **ordem foi obrigatória**: a 173 reescreveu
  `apps/ops.fonte/app/(auth)/login.tsx` e `change-password.tsx` (migração p/ react-hook-form) e a 174
  tocou `app/(auth)/_layout.tsx` e `app/(app)/_layout.tsx`. Rodar em paralelo conflitaria na mesma pasta.
- **Escopo técnico:** frontend-only nas duas. Sem migration, sem mudança em
  `packages/types`/`api-client`, sem alteração no `fonte-api.postman_collection.json`.
- **Cuidados da rodada:**
  - `accessibilityLabel` `input-senha` / `input-email` (ops e app) não podia mudar — Maestro e
    Playwright web dependem deles. `fill-test-credentials` (`__DEV__`) do `app.fonte` preservado.
  - E2E web (`apps/ops.fonte/e2e-web/`, `apps/app.fonte/e2e-web/`) verdes **sem edição**.
  - 174: o inset passa a ser pago **uma vez** no wrapper de `(app)/_layout.tsx`; `OfflineBanner` e
    `ResidentDetailHeader` perderam o `insets.top` próprio (senão vira gap duplo offline).
  - Gate de cobertura ≥ 90 no escopo tocado.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 173 — botão "ver senha" em todos os campos de senha | [OK] | adm 1610 / ops 948 / app 137 · e2e-web 14+4 | ba1e9cf | 98bf58c |
| 2 | 174 — header do ops.fonte cortado pela status bar | [OK] | ops 956 · e2e-web 14/14 | e9c1f12 | 79e57ff |

## Log

[OK] 173 — testes: adm:unit 1610 ✓, ops:unit 948 ✓, app:unit 137 ✓, e2e-web ops 14/14 e app 4/4 sem
edição; cobertura 93.19/93.43/92.56 (PasswordInput 100% nos 3 apps). Playwright adm 176 pass / 3 fail
pré-existentes (`resident-attachments.spec.ts`, falha 4 na main limpa). — commit: ba1e9cf —
merge: 98bf58c — 2026-08-10 — PENDENTE-MANUAL: Maestro (`adb devices` vazio, sem emulador) e
verificação visual do toggle em device Android.

[OK] 174 — testes: ops:unit 956/956 (93 suítes, +1 suíte / +8 casos), e2e-web ops 14/14 sem edição;
cobertura ops 93.43 stmt / 83.6 br / 92.23 fn / 94.73 ln. — commit: e9c1f12 — merge: 79e57ff —
2026-08-10 — PENDENTE-MANUAL: Maestro e verificação visual Android (o sintoma original é invisível
para os gates: `insets.top` é 0 no jsdom e em web).

## Resumo final

**As duas stories fecharam OK e estão mergeadas na `main` local. Sem push, sem PR.**

### O que passou

- **173** — `PasswordInput` extraído em `adm.fonte/src/components/shared/` e duplicado em RN
  (`ops.fonte/components/shared/` e `app.fonte/components/shared/`, 100% de cobertura nos três). A
  `LoginPage` do `adm.fonte` ganhou o toggle que faltava e os 4 blocos inline duplicados passaram a
  consumir o componente. `ops.fonte/app/(auth)/login.tsx` e `change-password.tsx` migrados para
  react-hook-form + zod + Controller, com o schema extraído para `ops.fonte/lib/passwordSchema.ts`.
- **174** — safe area consumida num ponto único, o wrapper de `ops.fonte/app/(app)/_layout.tsx`
  (`paddingTop: insets.top` + `#272950`). Os três paddings chutados (`pt-6`/`pt-8`/`pt-12`) viraram
  `pt-4`; `OfflineBanner` e `ResidentDetailHeader` perderam o `insets.top` próprio. Grupo `(auth)`
  ganhou `<StatusBar style="dark" />`; o `(app)` perdeu o `backgroundColor` (Android-only, no-op sob
  edge-to-edge).

### PENDENTE-MANUAL (nas duas stories, mesma causa)

1. **Maestro** (`pnpm test:ops` / `pnpm test:app`) não rodou — `adb devices` vazio, nenhum
   emulador/device conectado durante a rodada. Risco baixo na 173: os fluxos dependem só de
   `input-email`/`input-senha`, preservados e cobertos pelos e2e-web equivalentes.
2. **Verificação visual em device/emulador Android** — insubstituível, porque `insets.top` é `0` no
   jsdom e em web, então nenhum gate automatizado enxerga o sintoma original da 174. Conferir:
   - 173: tocar no olho revela o texto, **o valor não se perde** e o teclado não fecha (cuidado
     conhecido de alternar `secureTextEntry` em campo focado no Android);
   - 174: Dashboard com "Bem-vindo," inteiro e avatar descolado do topo; **sem gap duplo** com a rede
     desligada; mesmo respiro em Perfil, Grupos de Apoio e detalhe do filho; ícones da status bar
     legíveis sobre `#272950`; telas de login com ícones escuros sobre fundo branco. De preferência
     em **Android 15**, pela hipótese de edge-to-edge da decisão 4 da 174.

### Falhas pré-existentes (não introduzidas pela rodada)

- `pnpm test:adm` (Playwright): 3 falhas em `apps/adm.fonte/e2e/resident-attachments.spec.ts` — na
  `main` limpa o mesmo spec falha 4 vezes.
- `npx tsc --noEmit` em `ops.fonte`/`app.fonte`: 19 e 3 erros, todos em arquivos `*.test.tsx` de
  outras features, contagem idêntica à da `main`. Não há script `typecheck` nesses pacotes.

### Desvios de plano aceitos

- **173** — `getByLabel('Senha')` do adm virou `exact: true` em `e2e/auth.spec.ts` e
  `e2e/helpers/auth.ts`: o `aria-label="Mostrar senha"` do botão novo casaria no modo substring do
  Playwright e estouraria o strict mode. `change-password.tsx` do ops ganhou `input-nova-senha` /
  `input-confirmar-senha` (aditivo; os dois campos compartilhavam o placeholder `••••••••`).
- **174** — o spec do wrapper ficou em `apps/ops.fonte/tests/AppLayout.test.tsx`, não em
  `app/(app)/_layout.test.tsx` como o plano pedia. O expo-router trata todo arquivo sob `app/` como
  rota e reduz `_layout.test.tsx` para `_layout`, carregando-o ansiosamente — o `expo export
  --platform web` quebrava com `ReferenceError: jest is not defined`. Motivo comentado no topo do
  arquivo e no corpo do commit.

### Branches (preservadas, sem push)

- `feat/story-173-password-input-toggle` → merge `98bf58c`
- `fix/story-174-ops-header-safe-area` → merge `79e57ff`

### Reproduzir os gates

```bash
pnpm docker:up && pnpm test:setup
pnpm build:types && pnpm build:api-client
pnpm dev:api:test                      # porta 3001
pnpm --filter adm.fonte dev:test       # porta 5174

pnpm test:adm:unit
pnpm test:ops:unit
pnpm test:app:unit
pnpm test:adm                          # Playwright
pnpm --filter ops.fonte test:e2e       # e2e-web
pnpm --filter app.fonte test:e2e       # e2e-web
```
