# Plan: Unit tests do @fonte/api-client (Vitest) — filha do epic 49

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O `packages/api-client` é o cliente HTTP
compartilhado por **todos** os fronts. Um bug aqui (param errado, path errado, parse de erro)
quebra todos os apps de uma vez, e hoje não há **nenhum** teste. Esta story dá o baseline.

Decisões travadas (epic): Vitest, com o transporte HTTP (`axios`/`fetch`) **mockado** — testes de
contrato do cliente, não chamada de rede real.

## Desenho

### Tooling

- `pnpm --filter @fonte/api-client add -D vitest` (+ `@types/node` se preciso). `environment: 'node'`.
- Script `test` no `packages/api-client/package.json` = `vitest run`; script raiz `test:api-client`.
- Como o pacote builda com `tsc`, garantir que os `*.test.ts` não entrem no `dist` (excluir no
  `tsconfig` de build / `vitest` lê os fontes direto).

### Baseline de testes

- Para 2–3 recursos representativos (ex.: `associates`, `associates.public`, `residents`):
  - método de **list** repassa `params` e chama o path certo;
  - **getById**/**create**/**update** montam URL e body corretos;
  - erro HTTP propaga no shape que `getErrorMessage` dos apps espera.
- Mock do transporte: `vi.mock` do módulo http/axios usado internamente; asserir os argumentos da
  chamada (método, url, params/body).
- Garantir que o `index.ts` exporta todos os recursos esperados (teste de superfície).

## Validação

- `pnpm test:api-client` verde.
- `pnpm build:api-client` (tsc) sem regressão — `dist/` continua válido para os apps.

## Fora de escopo

- Testar contra a API real (é o papel do e2e dos apps / do backend).
- `packages/types` e `packages/doc-styles` (só tipos/CSS).
