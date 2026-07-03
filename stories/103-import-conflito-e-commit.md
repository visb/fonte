# Plan: Detecção de conflito e commit atômico do import

> **Status: PLANEJAMENTO.** Story-filha 3 de [[100]]. Implementar após aprovação.

## Context

Filha 3 do epic [[100]]. Duas responsabilidades do backend no momento de aprovar cada filho:

1. **Checar conflito** com filhos já cadastrados — por **nome (normalizado, sem acento) ou CPF** —
   para avisar antes de importar (o front usa isso para o alerta inline).
2. **Persistir o import aprovado** de forma atômica: cria o `Resident`, seus `Relative`s e as
   **contribuições retroativas** (histórico da planilha) numa única transação.

### Decisões travadas

- **Conflito avisa e bloqueia; não faz merge/atualização** de filho existente (decisão do epic
  [[100]]). Match por CPF (dígitos) **ou** nome normalizado (util da story [[32]]).
- **Commit reusa a lógica existente**, não reimplementa: criação de resident via a mesma regra do
  `ResidentService.create`; contribuições via a lógica de
  `ResidentFollowUpService.bulkCreateContributions` (lista de meses → lançamentos). Tudo numa
  transação (`dataSource.transaction`) para não deixar filho meio-importado.
- **Idempotência:** o commit revalida o conflito por CPF no servidor e recusa (`409`) se já existir,
  mesmo que o front não tenha barrado — evita duplicidade em corrida.
- Foto (`photoBase64` da ficha) é anexada ao resident no commit, reusando o caminho de upload de
  foto já existente.

## Desenho

### Backend (`services/api`, módulo `resident`)

- **Endpoint de conflito** `GET /residents/import/check-conflict?name=&cpf=` (guard ADMIN,
  COORDINATOR). Retorna `{ conflicts: Array<{ id; name; cpf; status; houseName }> }` — filhos
  existentes que batem por nome normalizado **ou** cpf. Reusa a busca sem acento da story [[32]].
- **Endpoint de commit** `POST /residents/import/commit` (guard ADMIN, COORDINATOR), body
  `CommitImportDto`:
  ```ts
  {
    resident: CreateResidentDto-like;      // ficha completa revisada
    relatives: { name; phone; relationship }[];
    contributionMonths: string[];          // ISO YYYY-MM-01
    photoBase64?: string | null;
  }
  ```
  `ImportService.commit(dto)` numa transação:
  1. Revalida conflito por cpf → `ConflictException` se existir.
  2. Cria resident + relatives (regra do `ResidentService.create`).
  3. Anexa foto se presente.
  4. Cria contribuições retroativas (lógica de `bulkCreateContributions`), retornando
     `{ created, skipped }`.
  - Retorno: `{ resident, contributionsCreated }`.
- DTO com `class-validator` (nested `@ValidateNested`, datas ISO, arrays).

### Tipos / api-client compartilhados

- `packages/types`: `CommitImportDto`/`ImportConflict`, resposta do commit.
- `packages/api-client/src/modules/residents.ts`: `checkImportConflict(name, cpf)`,
  `commitImport(payload)`.

### Postman

- Adicionar `GET /residents/import/check-conflict` e `POST /residents/import/commit`.

## Validação

Gate: **código novo sem teste não fecha a story** (`pnpm test:api:cov`; sem
`skip`/`only`/`xfail` injustificado).

- **`pnpm test:api`** (unit):
  - `checkConflict`: acha por CPF; acha por nome sem acento; retorna vazio quando não há; ignora
    soft-deleted conforme regra.
  - `commit`: cria resident + relatives + contribuições numa transação; conflito por cpf existente
    → `ConflictException` **e rollback** (nada persistido); `contributionMonths` vazio não cria
    contribuição; foto anexada quando presente.
- **`pnpm test:api:e2e`** (`resident-import.e2e-spec.ts`):
  - `GET /import/check-conflict` reflete filho existente; guard 403.
  - `POST /import/commit` cria o filho e as contribuições (conferir via `GET /residents/:id` e
    `GET /residents/:id/receivables`/follow-ups); segundo commit do mesmo cpf → 409.
- `pnpm build:types && pnpm build:api-client` (mexeu em contratos).

## Fora de escopo

- Extração/cross-match (fica em [[101]]/[[102]]).
- Atualizar/mesclar filho já existente (conflito só bloqueia).
- UI (fica em [[104]]/[[105]]).
