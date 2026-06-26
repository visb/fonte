# Plan: Cobertura `services/api` 81.69% → **90%** statements

> Filha do epic **85**. ~444 statements a cobrir. Sem mudar contrato. Toca só o próprio pacote.

## Context

A story 79 levou a API a 81.69% (4359/5336 statements; branches 69.76 / functions 78.23 / lines
84.10) com a catraca em 80. Faltam ~444 statements para 90%, concentrados em **ramos de erro,
validação, transição de status e permissões/role** que a primeira passada não fechou.

### Decisões travadas (herdadas do epic 85)

- TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman. Services unit
  com repos/deps mockados (nunca toca banco), nenhuma chamada externa real.
- Catraca sobe para statements:90 (branches/functions/lines no valor atingido, arredondado p/ baixo)
  ao fechar; nunca desce.
- Honestidade: denominador mantém as exclusões de orquestração da 79 (`*.module`/`main`/`instrument`/
  `migrations`/`*.dto`/`*.entity`). Nova exclusão só com comentário justificando — é re-baseline.

## Desenho

Atacar os maiores gaps de statements por módulo (medir com `pnpm test:api:cov` e priorizar):

- **Services de domínio** — ramos de erro/exceção (`NotFound`/`Forbidden`/`Conflict`/`BadRequest`),
  validações de regra de negócio, **transições de status** (resident, activity) ainda descobertas,
  caminhos de role (ADMIN vs SERVANT vs autor/terceiro), branches de cálculo (gross-up, capacidade,
  vencimento/overdue).
- **Controllers finos** restantes — ramos de validação de upload/allowlist, query params opcionais.
- **Utils/helpers** sem cobertura total (parsers, formatadores, guards).

Mock central de repos/gateways já estabelecido na 79 — reusar.

## Validação

- `pnpm test:api:cov` — **≥ 90% statements**, sem regressão de branches/functions/lines vs 79.
- `pnpm test:api:e2e` — sem regressão (suíte e2e verde salvo `payables.e2e` 6✗ pré-existente por
  data — não-regressão conhecida).

### Casos a cobrir

Caminhos de erro de cada service tocado (entidade inexistente → 404, sem permissão → 403, conflito
→ 409, payload inválido → 400); transições de status válidas e barradas; ramos por role; validações
de DTO/`class-validator`; branches de cálculo financeiro/capacidade.

> **Gate de cobertura (trava a story):** todo ramo novo coberto tem assert real. Rodar
> `pnpm test:api:cov`; **não reduzir** a cobertura dos módulos afetados; catraca da api sobe para 90
> e não desce. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Mudança de contrato/endpoint/migration/Postman.
- E2E novo (a não ser ajuste de não-regressão).
- Outros pacotes (cada um na sua filha).
