# Plan: Cobertura de testes — piso de 80% por pacote

## Context

Até agora os relatórios de cobertura dos frontends **mentiam para cima**: vitest/jest só
instrumentavam os arquivos **importados pelos testes** (sem `all: true`), então um `adm.fonte` com
1 punhado de helpers testados aparecia como "86%". Ao ligar `all: true` (vitest) e
`collectCoverageFrom` (jest) sobre todo o `src`, a cobertura **real** apareceu.

### Cobertura real medida em 2026-06-22 (após `all: true`)

| Pacote | % Stmts | Coberto/Total | Tests | Ferramenta | Δ p/ 80% |
|---|---:|---:|---:|---|---:|
| **services/api** | 46.64% | ~3950/8466 | 672 | Jest (já media src inteiro) | +33 pp |
| **adm.fonte** | **6.00%** | 1039/17300 | 169 | Vitest | +74 pp |
| **portal.fonte** | 64.26% | 723/1125 | 53 | Vitest | +16 pp |
| **ops.fonte** | **2.87%** | — | 70 | Jest | +77 pp |
| **app.fonte** | **4.61%** | — | 20 | Jest | +75 pp |
| **api-client** | 59.62% | 446/748 | 42 | Vitest | +20 pp |
| **resident.fonte** | — | — | 0 | — | (não scaffoldado) |

Tamanho do código-fonte (arquivos `.ts/.tsx`, sem testes): api 344 · adm 281 · ops 213 · app 47 ·
portal 31.

**Diagnóstico:** os 3 maiores ofensores (`adm.fonte` 6%, `ops.fonte` 2.87%, `app.fonte` 4.61%) são
justamente os de maior superfície de UI. Quase toda a lógica de hooks/services/helpers desses apps
está **sem rede**. `portal.fonte` e `api-client` já estão perto; `api` está na metade.

### Mudanças já aplicadas nesta story (config)

- `apps/adm.fonte/vitest.config.ts` — `coverage.all = true`, `include: src/**`, exclui
  testes/d.ts/`main.tsx`. (Antes o `include` era só `features/activities/lib/**`.)
- `apps/portal.fonte/vitest.config.ts` — bloco `coverage` com `all: true`.
- `packages/api-client/vitest.config.ts` — bloco `coverage` com `all: true`.
- `apps/ops.fonte/jest.config.js` e `apps/app.fonte/jest.config.js` — `collectCoverageFrom`
  cobrindo `app/components/features/lib`, excluindo testes/d.ts/`_layout.tsx`.

Essas mudanças **só medem** a verdade; não sobem a cobertura. O resto da story é o trabalho de
escrever testes + travar o piso.

## Meta

Piso de **80% de statements** por pacote (e não regredir branches/functions), aplicado via
`coverageThreshold`/`thresholds` na config de cada pacote, gateado em CI. Subida por **catraca**:
a cada PR de teste, sobe o piso para o valor atingido — nunca desce.

### Decisões travadas

- **Pirâmide de testes.** Prioridade de esforço por ROI de cobertura:
  1. **Lógica pura** (`lib/`, `features/*/lib`, `utils`, schemas zod, `queryKeys`, formatadores) —
     unit puro, rápido, alto retorno.
  2. **Hooks** (`features/*/hooks`) — React Query com `QueryClientProvider` de teste + mock do
     `@fonte/api-client` (web: vitest mock; RN: jest mock). Cobre o grosso da lógica de fetch/mutação.
  3. **Componentes de apresentação** — React Testing Library (web) / `@testing-library/react-native`
     (RN). Foco em branches de render (estados loading/empty/error, variantes de badge/card).
  4. **Services/controllers backend** — unit com repositórios mockados; e2e onde já há harness.
- **Pages/Screens de orquestração NÃO são alvo de unit.** São cobertas por E2E (Playwright no
  adm/portal, Maestro no ops/app). Ficam **excluídas** do denominador de cobertura unit (via
  `exclude`/`!` glob em `pages/**` e `app/**/*.tsx` de rota) para o piso de 80% ser honesto e
  alcançável — senão estaríamos exigindo unit de código que é E2E por natureza.
- **Excluir do denominador:** arquivos gerados, `*.d.ts`, `main.tsx`/`main.ts.x`, `_layout.tsx`,
  `sentry.ts`/`instrument.ts` (init de observabilidade), `vite-env.d.ts`, barrels (`index.ts`) puros,
  rotas Expo Router (`app/**` que só montam telas), constants/labels estáticos.
- **api-client:** o "service layer" são wrappers HTTP finos; cobrir com testes de contrato (mock do
  axios/fetch) verificando método+URL+body+desserialização. Muitos já existem; faltam ~20pp.
- **Sem baixar a meta para passar.** Se um módulo não dá para chegar a 80% sem testar UI de
  orquestração, mover esse arquivo para `exclude` **com justificativa em comentário** — não inflar
  com testes de fumaça sem assert (proibido por CLAUDE.md).

## Desenho — plano faseado

Ordem por risco × esforço. Cada fase é mergeável e sobe a catraca do piso do pacote tocado.

### Fase 0 — Instrumentação e baseline (esta story)
- `all: true` ligado (feito). Rodar cada `*:cov`/`--coverage` e **registrar baseline** no topo de
  cada config como comentário (valores da tabela acima).
- Adicionar scripts `test:cov` faltantes onde não houver (adm/portal/ops/app já têm `test:unit`;
  adicionar variante `--coverage`).
- **Ainda sem `coverageThreshold`** (senão CI quebra já). Catraca entra ao fim de cada fase.

### Fase 1 — Backend `services/api` 46→80% (maior valor de negócio)
- Mapear módulos por cobertura (rodar `pnpm test:api:cov`, ler `coverage/lcov-report`).
- Alvos de maior buraco primeiro: services com regra de domínio (transições de status de resident,
  alta, routine-entry 24h, storeroom sem estorno, resident-session limite diário, support-groups,
  consents/LGPD). Unit com repos mockados — sem tocar banco.
- Controllers finos: cobrir guards/roles via e2e já existente; expandir e2e onde falta (ver story 77
  como padrão de harness).
- Travar `coverageThreshold` de `services/api` em 80% no `jest --coverage`.

### Fase 2 — `adm.fonte` 6→80% (maior superfície)
- **Excluir `pages/**` do denominador** (orquestração → Playwright).
- Onda 1 — `lib/` + `features/*/lib` + `lib/queryKeys.ts` + schemas zod de cada feature (alto
  volume, baixo custo).
- Onda 2 — todos os `features/*/hooks` com `QueryClientProvider` de teste + mock `@fonte/api-client`.
  Um arquivo de teste por hook-file. Este é o grosso dos 17300 stmts.
- Onda 3 — componentes de apresentação (cards/rows/badges/forms) via RTL: render + branches de
  estado + submit de form (react-hook-form/zod). Reusar `LoadingState/EmptyState/ErrorState`.
- Catraca: subir piso conforme cada onda fecha (ex.: 30% → 55% → 80%).

### Fase 3 — `ops.fonte` 2.87→80% e `app.fonte` 4.61→80% (React Native)
- `@testing-library/react-native` + jest-expo (preset já configurado).
- Excluir `app/**` (rotas Expo Router) e `_layout.tsx` do denominador; focar em
  `features/*/{hooks,lib,components}` e `lib/`.
- Mesma sequência da Fase 2 (lib → hooks → componentes). Atenção ao `Controller` do react-hook-form
  (RN) e ao timer de uso do modo Resident no `ops.fonte` (testar a lógica do contador, não a tela).
- Catraca por onda.

### Fase 4 — `portal.fonte` 64→80% e `api-client` 60→80% (curtos)
- Buracos pontuais: no portal, `payment/pages` e `hooks` de pagamento (mockar tokenizer/cardTokenizer
  já testável); no api-client, os service-wrappers com 40-55% (events, houses, messages,
  notifications, residents, staff, support-groups).
- Travar piso 80% em ambos.

### Fase 5 — Catraca global + CI gate
- `coverageThreshold` (jest) / `coverage.thresholds` (vitest) em **todos** os pacotes a 80%
  statements (e branch/function no valor atingido, para não regredir).
- Garantir que o CI roda `*:cov` e falha abaixo do piso.
- Documentar no `CONTRIBUTING.md`/skill `fonte-workflow`: "novo código vem com teste; piso 80% trava
  o merge".

## Fora de escopo

- `resident.fonte` — ainda não scaffoldado; entra quando existir.
- E2E novos além do necessário para guards/rotas backend (E2E tem suas próprias stories, ex. 77).
- Subir cobertura de **pages/screens de orquestração** via unit — ficam em E2E.
- Mudar `.env.test`/infra de teste (S3/MinIO) — story própria se necessário.
- Testes de PDF/puppeteer (não rodam em unit leve).

## Validação

- Por fase: rodar o `*:cov` do pacote tocado e **não regredir** o piso já travado.
  - `pnpm test:api:cov` · `pnpm --filter adm.fonte test:unit -- --coverage` ·
    `pnpm --filter portal.fonte test:unit -- --coverage` ·
    `pnpm --filter ops.fonte test:unit -- --coverage` ·
    `pnpm --filter app.fonte test:unit -- --coverage` ·
    `pnpm --filter @fonte/api-client test -- --coverage`.
- Nenhum `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
- Todo arquivo movido para `exclude` tem comentário justificando (é orquestração/gerado/init).
- Sem teste de fumaça sem assert — cada caminho coberto tem asserção.
- Fase 5: CI falha se qualquer pacote cair abaixo do piso.

### Estimativa de esforço (grosseira)

| Pacote | Δ pp | Files src | Risco de tempo |
|---|---:|---:|---|
| services/api | +33 | 344 | Alto (regra de domínio) |
| adm.fonte | +74 | 281 | Muito alto (hooks+componentes) |
| ops.fonte | +77 | 213 | Alto (RN) |
| app.fonte | +75 | 47 | Médio |
| api-client | +20 | ~50 | Baixo |
| portal.fonte | +16 | 31 | Baixo |

Sugestão de fatiar em PRs por **feature** dentro de cada app (não um PR gigante), com a catraca
subindo a cada merge.
