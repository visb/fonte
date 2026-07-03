# Plan: Sugerir matrícula de filhos elegíveis ao criar turma do curso

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

Ao criar uma nova turma do curso bíblico, hoje o coordenador escolhe manualmente quem matricular.
Como quase todo interno com tempo de casa suficiente entra no curso, essa seleção manual é repetitiva
e sujeita a esquecer alguém. Esta story adiciona **sugestão automática de matrícula** para os filhos
que já estão **há 3 meses ou mais em tratamento** e ainda não estão numa turma.

Estende o epic do curso bíblico ([[33]], [[34]], [[35]] — todos em `done/`). O modelo já existe:
- `BibleCourseClass` (`bible_course_classes`): `name`, `houseId`, `startDate`, `endDate`, `status`, `notes`.
- `BibleCourseEnrollment` (`bible_course_enrollments`): `classId`, `residentId`, `status`, `enrolledAt`.
- `Resident`: `entryDate` (date), `status` (`ResidentStatus`), `houseId`, `exitDate`.
- Criação de turma: `POST /bible-course/classes` (ADMIN, COORDINATOR). Matrícula:
  `POST /bible-course/classes/:id/enrollments` (um residente por chamada).

### Decisões travadas

1. **UX = painel de sugeridos pós-criação da turma.** Cria-se a turma normalmente; em seguida um
   painel lista os filhos elegíveis para matrícula, cada um com botão/checkbox, e o coordenador
   confirma quem matricular. Não acopla a matrícula ao formulário de criação.
2. **Elegíveis vêm de TODAS as casas**, não só da casa da turma. Internos são **realocados** para a
   casa do curso ao serem matriculados, então a sugestão não deve filtrar por `houseId`. (Corrige a
   suposição inicial de escopo por casa.)
3. **"Em tratamento" = interno ativo:** `status ∈ {ACTIVE, DISCIPLINE}` **e** `exitDate` nulo.
   DISCIPLINE entra (interno em disciplina também pode cursar).
4. **Tempo mínimo = `entryDate <= hoje − 3 meses`.** Limiar numa **constante configurável** no
   backend (`ELIGIBLE_TREATMENT_MONTHS = 3`), exposta como query param opcional `months` (default 3)
   para ajuste futuro sem redeploy.
5. **Exclui quem já está matriculado** numa turma não cancelada (evita duplicidade). Elegível = sem
   `BibleCourseEnrollment` ativo em turma com status ≠ cancelada.
6. **Matrícula em lote atômica:** novo endpoint bulk recebe `residentIds[]` e matricula todos na
   mesma transação — o painel dispara uma chamada só com os selecionados.

## Desenho

### Backend (`services/api`, módulo `bible-course`)

- **Novo endpoint** `GET /bible-course/classes/eligible-residents?months=<int>` (guard ADMIN,
  COORDINATOR). Retorna elegíveis de **todas as casas**: ativos (regra decisão 3),
  `entryDate <= hoje − months` (default 3), **sem** matrícula ativa. Payload por item:
  `{ id, name, photoThumbUrl, entryDate, monthsInTreatment, houseId, houseName }` (casa atual ajuda
  o coordenador a saber quem será realocado).
- **Service** `BibleCourseService.findEligibleResidents(months)`: query no repo de residentes com
  `NOT EXISTS` em enrollments ativos, join na casa para o nome. Constante
  `ELIGIBLE_TREATMENT_MONTHS = 3`. Ordenar por `entryDate` (mais antigo primeiro).
- **Novo endpoint bulk** `POST /bible-course/classes/:id/enrollments/bulk` (guard ADMIN, COORDINATOR),
  body `{ residentIds: string[] }` (`@IsArray`, `@IsUUID('4', { each: true })`, `@ArrayNotEmpty`).
  Service `enrollBulk(classId, residentIds)`: matricula todos numa transação; deduplica ids
  repetidos; ignora (ou 409) residente já matriculado nessa turma; valida que cada residente existe.
  A realocação de casa fica **fora de escopo** desta story (ver abaixo) — só cria a matrícula.

### Tipos / api-client compartilhados

- `packages/types`: tipo `EligibleResident` (`id`, `name`, `photoThumbUrl`, `entryDate`,
  `monthsInTreatment`, `houseId`, `houseName`).
- `packages/api-client/src/modules/bible-course.ts`: `listEligibleResidents(months?)`,
  `enrollBulk(classId, residentIds)`.

### Frontend (`adm.fonte`, feature `bible-courses`)

- Hook em `features/bible-courses/hooks/`: `useEligibleResidents({ enabled })` e
  `useEnrollBulk(classId)`. Query keys em `lib/queryKeys.ts` (nunca literal).
- Após criar a turma (na `BibleClassDetailPage` ou logo no retorno do dialog), exibir painel
  **`EligibleResidentsPanel`** (componente próprio, ~150 linhas máx): lista de
  `EligibleResidentRow` com checkbox marcado por padrão (foto, nome, tempo de casa, casa atual).
  Ação "Matricular selecionados" → `enrollBulk`. Estados via
  `LoadingState`/`EmptyState`/`ErrorState`; `EmptyState` "Nenhum filho elegível". Erros via
  `getErrorMessage`.
- O painel também deve ser acessível ao abrir uma turma existente que ainda não tem matrículas (não
  só no instante da criação), já que o fluxo é pós-criação.

### Postman

- Adicionar `GET /bible-course/classes/eligible-residents` e
  `POST /bible-course/classes/:id/enrollments/bulk` em `fonte-api.postman_collection.json`.

## Validação

Gate: **código novo sem teste não fecha a story.** Rodar `pnpm test:api:cov` + runner de cobertura
do `adm.fonte`; sem `skip`/`only`/`xfail` injustificado.

- **`pnpm test:api`** (unit `BibleCourseService`):
  - `findEligibleResidents`: inclui ativo com `entryDate` de 4 meses; inclui DISCIPLINE; exclui
    recém-entrado (1 mês); exclui com `exitDate`; exclui status não-ativo (ex: ALUMNI/saída); exclui
    já matriculado em turma ativa; inclui de qualquer casa; respeita param `months` custom; ordena
    por `entryDate`.
  - `enrollBulk`: matricula N residentes numa transação; deduplica ids repetidos; trata residente já
    matriculado (skip/409 conforme decidido); rollback se residente inexistente.
- **`pnpm test:api:e2e`** (estender `test/bible-course.e2e-spec.ts`):
  - `GET /classes/eligible-residents` retorna elegíveis; guard 403 p/ role sem permissão.
  - `POST /classes/:id/enrollments/bulk` cria as matrículas; conferir enrollments persistidos.
- **`pnpm test:adm`** (estender spec Playwright de bible-courses): criar turma → painel de sugeridos
  aparece com elegíveis marcados → desmarcar um → matricular → matrículas refletidas na turma.
- `pnpm build:types && pnpm build:api-client` (mexeu em contratos).

## Fora de escopo

- **Realocar a casa do interno** ao matricular (mudar `resident.houseId` para a casa do curso) — o
  usuário mencionou que os filhos são realocados, mas a mudança de casa é fluxo próprio; esta story
  só cria a matrícula. Avaliar em story futura se a realocação deve ser automática.
- Notificar o filho/família da matrícula.
- Sugerir matrícula fora do fluxo de turma (varredura periódica de novos elegíveis).
- Configurar o limiar de meses pela UI (fica em constante/param backend).
- Regras de reprovação/repetência ou pré-requisito de módulo anterior.
