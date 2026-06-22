# Plan: Cobertura de testes — `portal.fonte` 64→80% + `api-client` 60→80%

> Filha do epic **78**. As duas curtas (+16pp / +20pp). Cabem juntas, buracos pontuais.

## Context

- `portal.fonte`: **64.26%** (723/1125 stmts, 53 tests, 31 arquivos). Buracos em `payment/pages`,
  `payment/hooks` e `events/pages` (orquestração), e `sentry.ts` (init).
- `api-client`: **59.62%** (446/748 stmts, 42 tests). Service-wrappers HTTP a 40–55%: `events`,
  `houses`, `messages`, `notifications`, `residents`, `staff`, `support-groups`, `consents`,
  `bible-course`, `census`.

### Decisões travadas

- **portal:** `pages/**` e `sentry.ts` fora do denominador (E2E Playwright cobre páginas). Focar em
  `payment/hooks` e libs (`cardTokenizer`, `money`, `queryKeys`) — `cardTokenizer` já testável e quase
  coberto.
- **api-client:** wrappers são finos — **testes de contrato** mockando o transport (axios/fetch):
  asserir método + URL + body + desserialização da resposta. Um teste por método público faltante.
- Sem mudança de contrato.

## Desenho

### `portal.fonte`
- Excluir `src/**/pages/**` e `src/lib/sentry.ts` no `coverage.exclude`.
- Cobrir `features/payment/hooks` (mock api-client), completar branches de `cardTokenizer` (65-66),
  `queryKeys`.

### `api-client`
- Para cada service com <80%, adicionar testes de contrato dos métodos descobertos sem cobertura
  (lista acima). Mock do transport central num helper.
- Excluir `src/index.ts` (barrel) do denominador.

Catraca: travar 80% em ambos ao fechar.

## Fora de escopo

- Pages do portal (E2E).
- Mudança de contrato/endpoint.

## Validação

- `pnpm --filter portal.fonte test:unit -- --coverage` e
  `pnpm --filter @fonte/api-client test -- --coverage` ≥ **80%** statements, sem regressão de branch.
- E2E portal (`pnpm test:portal:e2e`) não regredir.
- Sem `skip/only` sem justificativa.
