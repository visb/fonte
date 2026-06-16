# Plan: Catálogo de módulos do curso bíblico

> **Status: PLANEJAMENTO.** Story-filha de [[33]]. Implementar só após aprovação do usuário.

## Context

Filha 1 do epic [[33]]. Cria o **catálogo compartilhado de módulos** do curso bíblico —
cadastrados uma vez, reusados por toda turma. Pré-requisito de [[35]] (notas referenciam módulo).

### Decisões (herdadas de [[33]])

- Catálogo **global** (não por turma).
- **ADMIN só** gerencia (criar/editar/reordenar/remover).
- Módulo tem `name`, `sequence` (ordem de exibição) e `notes?` opcional.

## Desenho

### Backend (`services/api`) — novo módulo `bible-course` reaproveitado
- **Entity** `bible_course_modules` (`BibleCourseModule`): `id` uuid, `name`, `sequence` int,
  `notes` text null, timestamps, `deleted_at` (soft delete, padrão do repo).
- **Migration** `NN-BibleCourseModules.ts`: cria tabela.
- **DTOs** `CreateModuleDto` / `UpdateModuleDto` (`class-validator`: `name` obrigatório,
  `sequence` int ≥ 0 opcional, `notes` opcional).
- **Endpoints** no `bible-course.controller.ts` (guard ADMIN, padrão dos já existentes):
  - `GET    /bible-courses/modules`            — lista ordenada por `sequence, name`.
  - `POST   /bible-courses/modules`            — cria.
  - `PATCH  /bible-courses/modules/:id`        — edita (inclui reordenar via `sequence`).
  - `DELETE /bible-courses/modules/:id`        — soft delete.
- **Service**: métodos CRUD no `BibleCourseService` (reusa repos do módulo). Bloquear nome
  duplicado (ConflictException) — opcional, confirmar com usuário se quer unicidade.
- Registrar `BibleCourseModule` no `bible-course.module.ts` (TypeOrmModule.forFeature).

### Tipos / api-client compartilhados
- `packages/types`: `BibleCourseModule` (se houver enums/contratos).
- `packages/api-client/src/modules/bible-course.ts`: `listModules`, `createModule`,
  `updateModule`, `deleteModule`.

### Frontend (`adm.fonte`)
- Feature `bible-courses` já existe. Onde colocar a gestão do catálogo: **decisão de UX** —
  sugestão: aba/seção "Módulos" dentro de `BibleCoursesPage` ou item em Configurações. Confirmar
  com usuário ao implementar.
- Hooks em `features/bible-courses/hooks/useBibleCourses.ts` (ou novo `useBibleModules.ts`):
  `useBibleModules`, `useCreateBibleModule`, `useUpdateBibleModule`, `useDeleteBibleModule` —
  query keys em `lib/queryKeys.ts` (nunca string literal).
- Componentes: `BibleModuleList` + `BibleModuleRow` + `BibleModuleDialog` (form
  `react-hook-form` + `zod`). Seguir limites de tamanho/decomposição do CLAUDE.md.
- Estados via `LoadingState`/`EmptyState`/`ErrorState`; erros via `getErrorMessage`.

### Postman
- Atualizar `fonte-api.postman_collection.json` com os 4 endpoints novos.

## Validação

- `pnpm test:api` — unit do `BibleCourseService` (CRUD de módulos): cria, lista ordenada,
  edita, soft delete, (duplicado se houver regra).
- `pnpm test:api:e2e` — estender `test/bible-courses.e2e-spec.ts`: CRUD de módulo via HTTP + guard
  ADMIN (não-admin recebe 403).
- `pnpm test:adm` — spec Playwright cobrindo cadastro/edição/remoção de módulo (estender
  `e2e/bible-courses.spec.ts`).
- `pnpm build:types && pnpm build:api-client` se mexer em contratos.

## Fora de escopo

- Notas (fica em [[35]]).
- Vincular módulos a turmas específicas (catálogo é global).
- Conteúdo/material didático do módulo (só nome/ordem/notas).
