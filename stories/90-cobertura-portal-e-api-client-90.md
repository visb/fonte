# Plan: Cobertura `portal.fonte` 83.17% → **90%** + `api-client` 99% → trava 90%

> Filha do epic **85**. As duas curtas juntas (como a 82): portal +~59 statements; api-client já em
> 99% (só subir a catraca). Toca só esses dois pacotes.

## Context

A story 82 levou portal a 83.17% (717/862 statements; branches 77.48 / functions 87.71 / lines
83.17) e api-client a 99.06% (741/748), ambos com catraca em 80.

- **portal:** faltam ~59 statements para 90% — branches descobertos em `payment`/`cancel`/`events`
  hooks e libs.
- **api-client:** já ≥ 90% (99,06%). **Só subir** `thresholds.statements` de 80 para 90; sem teste
  novo esperado (branch/fn/lines mantêm o valor alto atual).

### Decisões travadas (herdadas do epic 85)

- TESTES-ONLY. portal: mock central do `@fonte/api-client` via `vi.mock`; forms rhf+zod.
- api-client: testes de contrato mockando o transport (helper `createHttpMock` da 82) se algum ramo
  residual faltar — mas o esperado é só travar.
- Honestidade: manter exclusões da 82 (portal `src/**/pages/**` + `src/lib/sentry.ts`; api-client
  barrel `src/index.ts`). Não ampliar para inflar.
- Catraca sobe para statements:90 em ambos (branch/fn/lines no valor atingido); nunca desce.

## Desenho

- **portal:** medir com `pnpm test:portal:cov`; cobrir os ~59 statements restantes — branches de
  erro/estado dos hooks de pagamento/cancelamento/eventos e libs (`cardTokenizer`, `money`,
  `queryKeys`) ainda descobertos.
- **api-client:** subir `coverage.thresholds.statements` para 90 no `vitest.config.ts`. Se a medição
  acusar algum statement faltante para manter ≥ 90 com folga, adicionar o teste de contrato do método
  descoberto.

## Validação

- `pnpm test:portal:cov` — **≥ 90% statements**, sem regressão de branches/functions/lines vs 82.
- `pnpm test:api-client:cov` — **≥ 90% statements** (já 99%), threshold travado em 90.
- E2E portal (`pnpm test:portal:e2e`) não regride.

### Casos a cobrir

portal: ramos de erro/estado dos hooks (loading/erro/sucesso, enabled), branches de lib
(tokenização cartão, formatação de moeda, chaves de query). api-client: contrato dos métodos
públicos (método+URL+body+desserialização) já coberto — só fechar resíduo se houver.

> **Gate de cobertura (trava a story):** todo branch novo coberto tem assert real. Rodar
> `pnpm test:portal:cov` e `pnpm test:api-client:cov`; **não reduzir** a cobertura; catraca dos dois
> sobe para 90 e não desce. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Pages do portal (E2E). Mudança de contrato/endpoint do api-client.
- Outros pacotes (cada um na sua filha).
