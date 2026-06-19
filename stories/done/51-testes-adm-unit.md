# Plan: Unit tests no adm.fonte (Vitest + RTL) — filha do epic 49

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O `adm.fonte` tem **só** e2e (Playwright, 15
specs) e **zero** unit. Lógica pura (libs, schemas zod, hooks de query/mutation, helpers de
formatação) não tem teste rápido. Esta story instala o tooling unit e escreve o baseline.

Decisões travadas (epic): Vitest + `@testing-library/react` + `jsdom`; subir o piso.

## Desenho

### Tooling

- `pnpm --filter adm.fonte add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react` (conferir versões compat com o Vite já instalado).
- `vitest.config.ts` (ou `test` no `vite.config.ts`): `environment: 'jsdom'`, `globals: true`,
  `setupFiles` com `@testing-library/jest-dom`. Excluir `e2e/**` (é Playwright).
- Script `apps/adm.fonte/package.json`: `"test:unit": "vitest run"` (+ `"test:unit:watch"`).
- Script raiz: `test:adm:unit`.

### Baseline de testes (`*.test.ts(x)` ao lado do código)

- **libs puras**: `src/lib/masks.ts`, `src/lib/money.ts` (se existir), `src/lib/errors.ts`
  (`getErrorMessage` com vários shapes de erro), `src/lib/queryKeys.ts` (estabilidade das chaves).
- **schema zod**: 1 schema de feature (ex.: `associateSchema`) — aceita válido, rejeita inválido.
- **hook**: 1 hook de query e 1 de mutation com `QueryClientProvider` + api-client mockado
  (`vi.mock('@fonte/api-client')`), checando queryKey e invalidação.
- **componente**: 1 componente de apresentação puro (ex.: um `*Badge` ou `*Row`) — renderiza label
  correto por prop.

## Validação

- `pnpm --filter adm.fonte test:unit` (e `pnpm test:adm:unit`) verde.
- `pnpm --filter adm.fonte build` (tsc -b + vite) sem regressão.
- Playwright (`pnpm test:adm`) ainda verde — não tocar nos specs e2e além de smoke.

## Fora de escopo

- Cobrir todos os componentes/hooks (só baseline; cresce via regra do /issue).
- Mudar a config do Playwright.
- Testes de snapshot.
