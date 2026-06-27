# Plan: Catraca de cobertura + gate CI a **90%**

> Filha do epic **85**. **Depende de 86, 87, 88, 89 e 90** (todos os pacotes ≥ 90%). Última a mergear.

## Context

Com 86–90 entregues, todos os pacotes testáveis estão ≥ 90% statements. Falta **travar** o novo piso
para que regressões quebrem o build, fechando o ciclo do epic 85. A infra de gate já existe (story
83): scripts `*:cov`, agregador `pnpm test:cov:all` e `.github/workflows/ci.yml`. Esta story só
**sobe os thresholds** de 80 para 90 e atualiza a documentação.

### Decisões travadas (herdadas do epic 85)

- **Threshold por pacote** (não global único): cada `coverageThreshold` (jest: api/ops/app) /
  `coverage.thresholds` (vitest: adm/portal/api-client) com `statements: 90` e
  `branches`/`functions`/`lines` no **valor atingido** ao fechar cada filha (lido do relatório).
- **Gate em CI**: `test:cov:all` já roda cada pacote com `--coverage` e propaga exit code; só os
  números do piso mudam. Falha de threshold = build vermelho.
- **Catraca documentada**: subir o piso é PR explícito; nunca baixar sem justificativa registrada.

## Desenho

### Configs (subir 80 → 90)
- jest (`services/api`, `ops.fonte`, `app.fonte`): `coverageThreshold.global.statements: 90`
  (+ branches/functions/lines no valor atingido por cada filha).
- vitest (`adm.fonte`, `portal.fonte`, `@fonte/api-client`): `coverage.thresholds.statements: 90`
  (idem branch/function/lines).

### CI
- `.github/workflows/ci.yml` já roda `pnpm test:cov:all` em push/PR na main — nada a mudar além dos
  thresholds. Confirmar que falha abaixo de 90.

### Documentação
- `CONTRIBUTING.md` + skill `fonte-workflow`: atualizar o piso de **80% → 90%** na seção de catraca.

## Validação

- `pnpm test:cov:all` — todos os 6 pacotes **verdes no piso de 90%**.
- Forçar regressão proposital (subir um threshold acima do atingido, ou remover 1 teste de um pacote
  no limite) e confirmar que o gate **quebra o build** (exit ≠ 0).
- Conferir que nenhum threshold foi **baixado** vs o estado pós-86–90.

> **Gate de cobertura (trava a story):** o gate só fecha com todos os pacotes ≥ 90% e o build
> vermelho abaixo do piso comprovado. Sem `skip`/`only`/`xfail` sem justificativa (CLAUDE.md).

## Fora de escopo

- Escrever testes novos (é nas 86–90).
- Cobertura de E2E no gate.
- Reescrever a infra de gate (já existe da 83) — só ajustar os números.
