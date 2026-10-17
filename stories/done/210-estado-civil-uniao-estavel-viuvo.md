# Plan: estado civil com "União estável" e "Viúvo(a)"

## Context

O estado civil (`MaritalStatus` em `@fonte/types`) só tem `SINGLE`, `MARRIED` e `DIVORCED`.
Boa parte dos filhos vive em união estável, e hoje isso é registrado como "Casado(a)" ou fica
vazio. O mesmo vale para viúvos: não há opção, e no import das fichas `.docx` esses casos caem em
`null`. Backlog: *"o campo 'estado civil' deve incluir 'união estável'"*.

### Decisões travadas (usuário)

1. **Dois valores novos**: `STABLE_UNION` ("União estável") e `WIDOWED` ("Viúvo(a)"). Viúvo
   entrou junto por custar o mesmo (mesma migration) e por ser lacuna real do import.
2. **Vale para filhos e servos**: os dois enums do banco (`residents_marital_status_enum` e
   `staff_marital_status_enum`) ganham os valores, e `MaritalStatus` continua único e compartilhado.

### Decisões de desenho (defaults assumidos no refino)

3. **Ordem de exibição**: Solteiro(a), Casado(a), União estável, Divorciado(a), Viúvo(a).
4. **Rótulos num lugar só no `adm`.** Hoje estão copiados em 7 arquivos (`residents/constants.ts`,
   `OverviewTab`, `StaffOverviewTab`, `PersonalDataFields`, `StaffPersonalTab`, `ReadmissionForm`,
   `documentFields`). Ficam `MARITAL_STATUS_LABELS` e `MARITAL_STATUS_OPTIONS` (ordenadas) num
   módulo compartilhado (`lib/maritalStatus.ts` ou `components/shared/`), e os selects e as
   exibições passam a iterar sobre eles. Assim, um valor novo no futuro é uma linha só.
5. **Documentos**: `ResidentVariablesResolver.MARITAL_PT` ganha `STABLE_UNION → 'União estável'`
   e `WIDOWED → 'Viúvo(a)'` (a variável `{{maritalStatus}}`). A lista de variáveis do editor de
   templates (`templateVariables.ts`) não muda, porque o nome da variável é o mesmo.
6. **Import de fichas `.docx`** (`docx-parser.service.ts`): o prompt/mapeamento passa a reconhecer
   "União estável", "Amasiado(a)", "Convivente" e "Companheiro(a)" → `STABLE_UNION`, e "Viúvo(a)" →
   `WIDOWED`. O tipo literal `'SINGLE' | 'MARRIED' | 'DIVORCED'` do parser passa a usar
   `MaritalStatus`. Fichas já importadas **não** são reprocessadas.
7. **Migration nova**, sem editar a `InitialSchema`:
   - `up`: `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'STABLE_UNION'` / `'WIDOWED'` nos dois tipos
     (Postgres ≥12 aceita dentro da transação da migration, desde que o valor não seja usado na
     mesma transação).
   - `down`: o Postgres não remove valor de enum. Recriar o tipo sem os valores, depois de mover
     linhas com os valores novos para `NULL`, e documentar no código que o `down` perde esse dado.
8. **Sem backfill**: nada é convertido automaticamente. Quem estava como "Casado(a)" e na verdade é
   união estável é corrigido manualmente na ficha.
9. `ops.fonte`/`app.fonte`/`portal.fonte` não exibem nem editam estado civil (conferido). Nada a
   fazer lá, além de recompilar os tipos.

---

## Desenho

### 1. Contratos

- `packages/types/src/index.ts`: `MaritalStatus` ganha `STABLE_UNION` e `WIDOWED`.
  `pnpm build:types` / `pnpm build:api-client`.

### 2. Backend (`services/api`)

- Migration `AddStableUnionAndWidowedToMaritalStatus` (decisão 7).
- As entities `resident.entity.ts`/`staff.entity.ts` já usam o enum compartilhado, então nada muda além do tipo.
  Os DTOs (`create/update/readmit-resident`, `create-staff`) validam com `@IsEnum(MaritalStatus)`.
  Conferir que nenhum usa lista literal.
- `resident-variables.resolver.ts`: `MARITAL_PT` (decisão 5).
- `docx-parser.service.ts`: mapeamento e tipo (decisão 6).
- **Postman**: os exemplos/descrições de body de resident e staff listam os valores aceitos de
  `maritalStatus`.

### 3. `adm.fonte`

- O módulo de rótulos/opções (decisão 4) substitui as 7 cópias.
- Os selects de acolhimento (`PersonalDataFields`), readmissão (`ReadmissionForm`), servo
  (`StaffPersonalTab`) e campos de documento (`documentFields`) mostram as 5 opções.
- As exibições (`OverviewTab`, `StaffOverviewTab`, `summaryFields`) rotulam os valores novos.
- Os schemas zod (`residentSchema`, `staffSchema`) usam `z.nativeEnum(MaritalStatus)`. Conferir
  que não há lista literal.
- Import (`ImportReviewStep`/`importCommit`): aceitam e exibem os valores novos.

---

## Validação

### Backend: `pnpm test:api`

- `ResidentVariablesResolver`: `STABLE_UNION` → "União estável", `WIDOWED` → "Viúvo(a)"
  (`document-template.service.spec.ts`).
- `docx-parser`: ficha com "União estável", "Amasiado" e "Viúvo" mapeia para o valor certo, e as
  existentes (Solteiro/Casado/Divorciado/Separado) seguem iguais.
- DTOs: `maritalStatus: 'STABLE_UNION'` e `'WIDOWED'` passam na validação, e um valor inválido
  continua reprovado.

### Backend: migration

- `pnpm migration:run:test` aplica, e o `down` reverte sem erro no banco de teste.

### Backend: `pnpm test:api:e2e`

- Criar/atualizar resident com `maritalStatus: 'STABLE_UNION'` → 200 e persistido.
- Criar staff com `'WIDOWED'` → 200.
- Valor inválido → 400.
- As fixtures são criadas e removidas por id (story 182).

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- O módulo de rótulos cobre todos os valores do enum. Um teste itera `Object.values(MaritalStatus)`
  e falha se faltar rótulo, travando regressão futura.
- Os selects (`PersonalDataFields`, `StaffPersonalTab`, `ReadmissionForm`) renderizam as 5 opções
  na ordem da decisão 3.
- As exibições (`OverviewTab`, `StaffOverviewTab`, `summaryFields`, `documentFields`) mostram
  "União estável" e "Viúvo(a)". Atualizar os testes existentes (`OverviewTab.test`,
  `StaffOverviewTab.test`, `staffSchema.test`, `documentFields.test`, `summaryFields.test`,
  `MissingFieldsDialog.test`).

### `adm.fonte`: e2e (`pnpm test:adm`)

- `e2e/residents.spec.ts`: no acolhimento ou na edição, selecionar "União estável", salvar e ver o
  rótulo na ficha. A fixture é própria e removida no `afterAll` (story 182).

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir `resident`, `staff` e
`document-template`, e `pnpm test:adm:unit` com cobertura sem reduzir `features/residents` e
`features/staff` (módulo de rótulos ≥90%). Sem `skip`/`only`/`xfail` sem justificativa explícita no
código (CLAUDE.md).

---

## Fora de escopo

- Outros valores (separado judicialmente etc.). "Separado" continua mapeado para `DIVORCED` no
  import.
- Backfill/reclassificação de registros existentes (decisão 8).
- Reprocessar fichas já importadas.
- Estado civil de familiares (`Relative`), que não tem o campo.
