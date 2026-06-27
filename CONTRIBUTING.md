## Commit Convention (Conventional Commits)

Formato obrigatório:

type(scope): descrição curta

Regras:

- descrição em português
- usar verbo no infinitivo (ex: adicionar, corrigir, atualizar)
- ser objetivo (máx ~70 caracteres)
- não usar ponto final

Tipos permitidos:

- feat -> nova funcionalidade
- fix -> correção de bug
- chore -> manutenção / infra
- docs -> documentação
- style -> formatação (sem impacto funcional)
- refactor -> refatoração sem mudança de comportamento
- perf -> melhoria de performance
- test -> testes
- build -> build / dependências
- ci -> CI/CD
- revert -> reverter commit

Scope:

- deve indicar o módulo do monorepo:
  - apps/adm
  - apps/ops
  - services/api
  - packages/types

Exemplos válidos:

- feat(services/api): adicionar endpoint de login
- fix(apps/adm): corrigir validação de formulário
- chore(packages/types): atualizar tipagens

Exemplos inválidos:

- "update stuff"
- "fix bug"
- "feat: coisa nova"

## Catraca de cobertura (gate 90%)

Piso de **90% statements** travado por pacote (epic 85 / stories 86–91; sucede o piso de 80% do
epic 78 / story 83). Vale como gate de merge:

- **Novo código vem com teste.** PR que derruba a cobertura abaixo do piso **quebra o build** e
  não mergeia. Cada pacote tem o threshold no seu config:
  - jest (`services/api`, `ops.fonte`, `app.fonte`): `coverageThreshold.global`.
  - vitest (`adm.fonte`, `portal.fonte`, `@fonte/api-client`): `coverage.thresholds`.
  - `statements: 90` (piso); `branches`/`functions`/`lines` travados no valor já atingido.
  - **Exceção `adm.fonte`** (story 87 BLOQUEADA): segue em `statements: 80`. A cobertura do
    pacote **não pôde ser medida nesta máquina** — o provider v8 com `all:true` degenera (remap
    CPU-bound que não conclui) e o istanbul derruba o worker (OOM em paralelo; single-fork lento
    demais para o ciclo medir-escrever-medir). Subir o piso do adm para 90 depende de medir a
    cobertura num ambiente onde o runner conclua (CI Linux ou máquina mais rápida). Ver
    `stories/PROGRESS.md`.
- **Rodar o gate local:** `pnpm test:cov:all` roda os 6 pacotes com `--coverage`; sai com código
  != 0 (build vermelho) se algum cair abaixo do piso. CI (`.github/workflows/ci.yml`) roda o mesmo
  em push/PR na `main`. E2E **não** entra no gate. (Em máquinas onde o coverage do `adm.fonte` não
  conclui — ver exceção acima — rode os outros 5 pacotes individualmente: `pnpm test:api:cov`,
  `pnpm test:api-client:cov`, `pnpm test:portal:cov`, `pnpm test:ops:unit:cov`, `pnpm test:app:unit:cov`.)
- **Subir o piso é PR próprio**; **nunca baixar** um threshold sem justificativa registrada no PR
  (a catraca só sobe).
- Re-baseline honesto: excluir orquestração do denominador (`pages/**`/rotas `app/**`/`sentry.ts`)
  sobe o % **sem teste novo** — não conta como progresso de cobertura.
