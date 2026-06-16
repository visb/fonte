# Plan: Lançamento de notas (prova/trabalho) por módulo

> **Status: PLANEJAMENTO.** Story-filha de [[33]]. Depende de [[34]] (catálogo de módulos).
> Implementar só após aprovação do usuário.

## Context

Filha 2 do epic [[33]]. Permite o ADMIN **lançar e editar as notas** de cada filho matriculado:
duas notas por módulo (prova e trabalho), escala 0–10, com médias calculadas.

### Decisões (herdadas de [[33]])

- Por módulo do catálogo [[34]]: **nota de prova** + **nota de trabalho** (fixas).
- **Escala 0–10**, decimal (uma casa). Notas podem ficar vazias (ainda não avaliado).
- **ADMIN só** lança/edita.
- Média por módulo = média(prova, trabalho) ignorando vazios; média do aluno na turma = média
  das médias de módulo.

## Desenho

### Backend (`services/api`)
- **Entity** `bible_course_grades` (`BibleCourseGrade`): `id`, `enrollment_id` (FK
  `bible_course_enrollments`, onDelete CASCADE), `module_id` (FK `bible_course_modules`),
  `exam_grade` numeric(4,2) null, `work_grade` numeric(4,2) null, timestamps, `deleted_at`.
  **Unique (enrollment_id, module_id).**
- **Migration** `NN-BibleCourseGrades.ts`: tabela + unique + FKs.
- **DTO** `UpsertGradeDto`: `moduleId` uuid, `examGrade?` number 0–10, `workGrade?` number 0–10
  (`class-validator`: `@Min(0) @Max(10)`, decimal permitido).
- **Endpoints** (guard ADMIN):
  - `GET   /bible-courses/classes/:classId/grades` — matriz da turma: por matrícula, lista de
    módulos com {examGrade, workGrade, moduleAverage} + average do aluno. Backend calcula médias.
  - `PUT   /bible-courses/enrollments/:enrollmentId/grades/:moduleId` — upsert da nota
    (cria a linha se não existe; edita se existe). Idempotente.
- **Service**: `getClassGrades(classId)` (join enrollments × modules × grades, monta a matriz e
  médias), `upsertGrade(enrollmentId, moduleId, dto)`.
- Reaproveitar `BibleCourseService` / `bible-course.module.ts`.

### Tipos / api-client
- `packages/types`: `BibleClassGrades` (matriz), `BibleCourseGrade`.
- `api-client/src/modules/bible-course.ts`: `getClassGrades(classId)`,
  `upsertGrade(enrollmentId, moduleId, payload)`.

### Frontend (`adm.fonte`)
- Tela alvo: `features/bible-courses/pages/BibleClassDetailPage.tsx` — nova aba/seção **"Notas"**.
- Hooks: `useBibleClassGrades(classId)` + `useUpsertBibleGrade(classId)` (invalida a query da
  matriz). Query keys em `lib/queryKeys.ts`.
- Componente **grade de notas**: linhas = filhos matriculados, colunas = módulos (prova/trabalho)
  + coluna de média. Input numérico 0–10 por célula, salva no blur (upsert). Decompor:
  `BibleGradesTable` → `BibleGradeRow` → `BibleGradeCell`. Respeitar limite de ~150 linhas e
  "nunca FlatList/Table com item inline complexo" do CLAUDE.md.
- Validação de célula via `zod` (0–10). Erros via `getErrorMessage`. Estados compartilhados.
- **Decisão de UX pendente** (confirmar ao implementar): editar célula a célula (autosave) vs.
  formulário por aluno. Sugestão: autosave por célula (menos cliques para o admin).

### Postman
- Atualizar `fonte-api.postman_collection.json` com os 2 endpoints.

## Validação

- `pnpm test:api` — `BibleCourseService`: upsert cria e depois edita a mesma linha (não
  duplica); `getClassGrades` calcula média por módulo e do aluno ignorando vazios; rejeita nota
  fora de 0–10.
- `pnpm test:api:e2e` — `bible-courses.e2e-spec.ts`: lançar prova/trabalho via HTTP, reler a
  matriz, conferir médias; guard ADMIN (não-admin 403).
- `pnpm test:adm` — Playwright: abrir turma, lançar notas, ver média atualizar.
- `pnpm build:types && pnpm build:api-client`.

## Fora de escopo

- Avaliações além de prova/trabalho (peso, múltiplas).
- Aprovação/situação final, boletim/PDF, exportação.
- Edição por coordenador/servo.
- Exibição de notas para familiar/interno.
