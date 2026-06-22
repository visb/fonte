# Plan: Catraca de cobertura + gate CI a 80%

> Filha do epic **78**. **Depende de 79–82** (todos os pacotes ≥ 80%). Última a mergear.

## Context

Com 79–82 entregues, todos os pacotes testáveis estão ≥ 80% statements. Falta **travar** o piso para
que regressões quebrem o build, fechando o ciclo do epic 78.

### Decisões travadas

- **Threshold por pacote** (não global único): cada `coverageThreshold` (jest) /
  `coverage.thresholds` (vitest) com `statements: 80` e `branches`/`functions` no **valor atingido**
  (lido do relatório no momento), para não regredir o que já existe.
- **Gate em CI**: o passo de testes roda com `--coverage` e falha se abaixo do piso. Sem piso só em
  watch/local.
- **Catraca documentada**: subir o piso é PR explícito; nunca baixar sem justificativa registrada.

## Desenho

### Configs
- jest (`services/api`, `ops.fonte`, `app.fonte`): adicionar
  ```js
  coverageThreshold: { global: { statements: 80, branches: <atingido>, functions: <atingido>, lines: 80 } }
  ```
- vitest (`adm.fonte`, `portal.fonte`, `api-client`): adicionar
  ```ts
  coverage: { thresholds: { statements: 80, branches: <atingido>, functions: <atingido>, lines: 80 } }
  ```

### CI
- Garantir que o workflow roda `*:cov`/`--coverage` de cada pacote e propaga o exit code.
- Falha de threshold = build vermelho.

### Documentação
- `CONTRIBUTING.md` + skill `fonte-workflow`: "novo código vem com teste; piso 80% trava o merge;
  subir piso é PR próprio".

## Fora de escopo

- Escrever testes novos (é nas 79–82).
- Cobertura de E2E no gate.

## Validação

- Rodar cada `*:cov` localmente: todos verdes no piso.
- Forçar regressão proposital (remover 1 teste) e confirmar que o threshold quebra o build.
- CI executa e falha corretamente abaixo do piso.
