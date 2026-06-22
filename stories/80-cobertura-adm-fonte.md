# Plan: Cobertura de testes — `adm.fonte` 6→80%

> Filha do epic **78**. A maior fatia: +74pp sobre 281 arquivos / 17300 statements. **Não cabe em 1
> PR** — subdividir por feature (80a/80b/…) conforme a catraca sobe.

## Context

`adm.fonte` media **6.00%** real (1039/17300 stmts, 169 tests) — o `all:true` revelou que só os
helpers de `activities/lib` e alguns badges estavam testados. 17 features:
`activities associates auth backup bible-courses billing census dashboard events houses messages
notifications payables residents settings staff support-groups`.

> **Re-baseline:** os 6.00% incluem `pages/**` (39 dos 281 arquivos) no denominador. Ao adicionar
> `src/**/pages/**` ao `coverage.exclude`, o denominador cai e o % **sobe sem testar nada** — medir e
> registrar o novo ponto de partida no 1º PR. Excluir page **não** é progresso de teste (caveat do 78).

### Decisões travadas

- **`pages/**` fora do denominador** (orquestração → Playwright E2E). Configurar `coverage.exclude`
  com `src/**/pages/**` + os exclui já existentes (test/d.ts/`main.tsx`).
- **Ordem por feature**, cada uma vira um PR pequeno (`80a residents`, `80b activities`, …). A catraca
  de `coverage.thresholds` sobe a cada merge — nunca desce.
- **Mock central do `@fonte/api-client`** num helper de teste reutilizável (factory de
  `QueryClient` + provider) para os hooks. Evita repetição entre features.
- Formulários: testar via `react-hook-form` + `zod` (submit válido/ inválido), não `fireEvent` campo
  a campo sem assert de schema.

## Desenho — por feature, em 3 camadas cada

Para cada feature, na ordem: **lib → hooks → componentes** (pages ficam de fora).

1. **lib pura** (`features/*/lib`, schemas, `lib/queryKeys.ts`, formatadores `payables/lib/money`,
   `errors.ts`) — volume alto, custo baixo. Começar por aqui em todas as features.
2. **hooks** (`features/*/hooks`) — `QueryClientProvider` de teste + mock api-client; testar
   query keys, `enabled`, invalidação, mapeamento de erro (`getErrorMessage`). **Grosso dos 17300.**
3. **componentes de apresentação** (cards/rows/badges/forms) — RTL; branches de estado
   (`LoadingState/EmptyState/ErrorState`), variantes, submit de form.

### Sub-fases (cada uma um PR; ordem por risco × tamanho)

- **80a** — `residents` + `activities` + `staff` (núcleo administrativo, maior superfície).
- **80b** — `houses` + `payables` + `billing` (financeiro/casas).
- **80c** — `events` + `support-groups` + `associates` + `census`.
- **80d** — `messages` + `notifications` + `bible-courses`.
- **80e** — `backup` + `settings` + `dashboard` + `auth` (menores, fecham o piso).

Cada PR de sub-fase sobe a catraca. Meta agregada: **80% statements** com `pages/**` excluído.

## Fora de escopo

- Pages/telas de orquestração (E2E Playwright — stories próprias).
- Mudar componentes para serem testáveis além do necessário (refactor é à parte).

## Validação

- `pnpm --filter adm.fonte test:unit -- --coverage` ≥ piso vigente a cada PR; **80%** ao final.
- E2E Playwright existente (`pnpm test:adm`) não regredir.
- Sem `skip/only` sem justificativa; cada caminho com assert.
