# Epic: Cobertura de testes — piso de 80% por pacote

> **Epic guarda-chuva.** Esta story define meta, estratégia e instrumentação. O trabalho de escrever
> testes vive nas stories filhas **79–83**. Mergeie esta primeiro (baseline + medição honesta),
> depois as filhas em paralelo por pacote.

## Context

Os relatórios de cobertura dos frontends **mentiam para cima**: vitest/jest só instrumentavam os
arquivos **importados pelos testes** (sem `all: true`), então `adm.fonte` aparecia "86%" testando um
punhado de helpers. Ligando `all: true` (vitest) e `collectCoverageFrom` (jest) sobre todo o `src`,
a cobertura **real** apareceu.

### Cobertura real medida em 2026-06-22 (após `all: true`)

| Pacote | % Stmts real | Coberto/Total | Δ p/ 80% | Story filha |
|---|---:|---:|---:|---|
| **services/api** | 46.64% | ~3950/8466 | +33 pp | **79** |
| **adm.fonte** | **6.00%** | 1039/17300 | +74 pp | **80** (80a–80e) |
| **ops.fonte** | **2.87%** | — | +77 pp | **81** (81a–81e) |
| **app.fonte** | **4.61%** | — | +75 pp | **84** (84a–84b) |
| **portal.fonte** | 64.26% | 723/1125 | +16 pp | **82** |
| **api-client** | 59.62% | 446/748 | +20 pp | **82** |
| **resident.fonte** | — | — | — | (não scaffoldado) |

> **Caveat — exclusão não é cobertura.** Esses baselines foram medidos com `pages/**` (web) e rotas
> `app/**` (RN) **dentro** do denominador. As filhas excluem orquestração do denominador (justo: é
> alvo de E2E), o que **sobe o %** sem nenhum teste novo. Cada filha deve **re-baselinar** após
> aplicar as exclusões e tratar esse salto como ponto de partida — não como progresso. O número que
> conta é cobertura de `lib/hooks/components/services`.

Tamanho do código (`.ts/.tsx` sem testes): api 344 · adm 281 · ops 213 · app 47 · portal 31.

**Diagnóstico:** os 3 maiores buracos (adm 6%, ops 2.87%, app 4.61%) são os de maior superfície de
UI; quase toda a lógica de hooks/services/helpers está sem rede.

### Já aplicado nesta story (config — só mede, não sobe cobertura)

- `apps/adm.fonte/vitest.config.ts` — `coverage.all=true`, `include: src/**` (antes só
  `features/activities/lib/**`).
- `apps/portal.fonte/vitest.config.ts` e `packages/api-client/vitest.config.ts` — bloco `coverage`
  com `all: true`.
- `apps/ops.fonte/jest.config.js` e `apps/app.fonte/jest.config.js` — `collectCoverageFrom` sobre
  `app/components/features/lib`, excluindo testes/d.ts/`_layout.tsx`.

## Meta

Piso de **80% de statements** por pacote, sem regredir branches/functions, travado via
`coverageThreshold` (jest) / `coverage.thresholds` (vitest) e gateado em CI. Subida por **catraca**:
cada PR de teste sobe o piso ao valor atingido — nunca desce.

## Estratégia (vale para todas as filhas)

- **Pirâmide de testes**, por ROI de cobertura:
  1. **Lógica pura** — `lib/`, `features/*/lib`, schemas zod, `queryKeys`, formatadores. Unit puro.
  2. **Hooks** — `features/*/hooks` com `QueryClientProvider` de teste + mock do `@fonte/api-client`.
  3. **Componentes de apresentação** — RTL (web) / `@testing-library/react-native` (RN); foco em
     branches de render (loading/empty/error, variantes de badge/card) e submit de form (rhf+zod).
  4. **Backend** — services unit com repos mockados; controllers/guards via e2e existente.
- **Pages/Screens de orquestração NÃO são alvo de unit** — cobertos por E2E (Playwright web / Maestro
  RN) e **excluídos do denominador** (`pages/**`, rotas `app/**/*.tsx`). Senão o piso de 80% exigiria
  unit de código que é E2E por natureza.
- **Excluir do denominador:** gerados, `*.d.ts`, `main.tsx`, `_layout.tsx`, `sentry.ts`/`instrument.ts`,
  `vite-env.d.ts`, barrels puros, rotas Expo Router, constants/labels estáticos.
- **Sem baixar a meta com teste de fumaça.** Arquivo que não chega a 80% sem testar orquestração vai
  para `exclude` **com comentário justificando** — proibido inflar com teste sem assert (CLAUDE.md).

## Catraca / gate CI (entregue na 83)

Quando todos os pacotes atingirem 80%, travar `coverageThreshold`/`thresholds` a 80% statements (e
branch/function no valor atingido) e fazer o CI falhar abaixo do piso. Documentar em
`CONTRIBUTING.md` + skill `fonte-workflow`.

## Stories filhas

| # | Escopo | Δ pp | Risco |
|---|---|---:|---|
| **79** | `services/api` 46→80% | +33 | Alto (regra de domínio) |
| **80** | `adm.fonte` 6→80% — sub-fases 80a–80e por feature | +74 | Muito alto |
| **81** | `ops.fonte` 2.87→80% (RN) — sub-fases 81a–81e por feature | +77 | Muito alto |
| **84** | `app.fonte` 4.61→80% (RN) — 84a–84b | +75 | Médio |
| **82** | `portal.fonte` 64→80% + `api-client` 60→80% | +16/20 | Baixo |
| **83** | Catraca global + gate CI (depende de 79–82, 84) | — | Baixo |

## Fora de escopo (epic)

- Escrever os testes em si — vive nas filhas.
- `resident.fonte` (não scaffoldado).
- Mudar infra de teste (S3/MinIO), PDF/puppeteer.

## Validação (epic)

- `all: true` ligado e cada `*:cov` rodando e reportando o número real (feito; baseline na tabela).
- Filhas 79–82 mergeadas sem regressão de piso; 83 ativa o gate.
