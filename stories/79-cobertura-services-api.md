# Plan: Cobertura de testes — `services/api` 46→80%

> Filha do epic **78**. Padrões e estratégia em 78; aqui o detalhe do backend.

## Context

`services/api` mede **46.64%** de statements (~3950/8466, 672 tests/51 suites) — já media o `src`
inteiro via `collectCoverageFrom` do Jest, então o número sempre foi honesto. Falta cobrir ~33pp,
concentrados em services com regra de domínio e em controllers/guards sem e2e.

344 arquivos `.ts` em `src` (sem `.spec`/`.module`). 33 módulos:
`activity app-settings associate audit auth bible-course cache consent data-rights document-template
event house incident mail message ministry notification payable relative resident resident-follow-up
resident-receivable resident-session retention staff storage storeroom street-sale support-group
user wishlist`.

### Decisões travadas

- **Unit com repositórios mockados** — nunca tocar banco no unit (CLAUDE.md: nada de DB fora da
  camada de persistência). Controllers/guards/roles cobertos por **e2e** (harness
  `test/helpers/e2e-app.ts`, padrão da story 77).
- **Prioridade por regra de negócio crítica** (BUSINESS_RULES.md), maior risco primeiro.
- **Sem alterar contrato** — só testes. Nenhuma mudança em DTO/endpoint ⇒ sem `build:types`/Postman.
- **Excluir do denominador:** `*.module.ts`, `main.ts`, `instrument.ts`, migrations, `*.dto.ts` sem
  lógica, entities puras. (Configurar `coveragePathIgnorePatterns` no jest da api.)

## Desenho — ondas

Rodar `pnpm test:api:cov`, ler `services/api/coverage/lcov-report` e atacar os maiores buracos.

### Onda 1 — services de domínio crítico (maior risco)
- **resident**: transições de status (só via service), alta exige `ACTIVE|DISCIPLINE` + `exit_date`,
  invariantes (house_id + ≥1 relative).
- **resident-session**: limite 25 min/dia (controlado pelo backend) — testar contador/reset.
- **incident**: não deletável.
- **routine/activity**: RoutineEntry não editável após 24h.
- **storeroom/supply-room**: sem estorno, correção por novo lançamento.
- **consent/data-rights/retention**: base legal e fluxos LGPD (docs/lgpd).

### Onda 2 — demais services
- `associate event house ministry message notification payable relative staff street-sale
  support-group wishlist bible-course document-template user audit`.
- Branches de erro (NotFound/Conflict/Forbidden), soft delete (`deleted_at`), paginação/filtros.

### Onda 3 — controllers/guards via e2e
- Expandir e2e onde falta cobertura de `@Roles`/auth (401/403 por role), reaproveitando o harness.
- Ver story 77 (document-templates e2e) como template de suíte.

Subir catraca de `coverageThreshold` da api a cada onda (ex.: 55% → 68% → 80%).

## Fora de escopo

- E2E de fluxo assinado/S3 (depende de infra — story própria).
- PDF/puppeteer.
- Mudança de contrato/DTO.

## Validação

- `pnpm test:api` e `pnpm test:api:cov` passando; cobertura **≥ 80%** statements ao fim, sem
  regredir branch/function.
- `pnpm test:api:e2e` verde (requer `pnpm test:setup` + `pnpm dev:api:test`).
- Sem `skip/only/xfail` sem justificativa; todo caminho coberto com assert real.
