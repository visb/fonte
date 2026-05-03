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
