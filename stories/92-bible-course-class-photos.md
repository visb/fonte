# Plan: Fotos por turma no Curso Bíblico

## Context

Item do BACKLOG (bloco "Curso Bíblico"): *"No curso bíblico, funcionalidade de
adicionar fotos em cada turma."*

A turma é a entidade `bible_course_classes`
(`services/api/src/modules/bible-course/bible-course-class.entity.ts`). Hoje ela
tem nome, casa, datas, status e notes — nenhum acervo de mídia. O pedido é dar a
cada turma uma **galeria de fotos** (registro visual da turma: encontros,
formatura, atividades).

### Decisões travadas

- **Cardinalidade: galeria (várias fotos por turma).** Upload múltiplo, grid de
  miniaturas, deletar individual. Não é foto-de-capa única.
- **Onde gerencia: adm.fonte E ops.fonte.** Adm na tela de detalhe da turma;
  ops.fonte (operadores da casa) também vê a galeria e sobe fotos do
  dispositivo/câmera.
- **Permissão: qualquer Staff** (ADMIN, COORDINATOR, SERVANT) pode subir e
  deletar foto da turma. Sem restrição por papel — alinhado a operadores de casa
  registrando o dia a dia.
- **Reusar o padrão de `activity_attachments`** (story 73/74) como molde:
  entidade de mídia 1-N ancorada na turma, `file_url`/`file_name`/`mime_type`/
  `size_bytes`/`created_by_user_id`, soft delete, upload via `StorageService`.
  Restringir `file_type`/`mime_type` a imagens (jpeg/png/webp/heic).
- **Limpeza de bucket no delete**: ao deletar (soft delete) a foto, remover o
  objeto do bucket via `StorageService` — coerente com o bloco de BACKLOG de
  limpeza de bucket (ver story 93). Soft delete do registro + delete físico do
  objeto.
- **Sem reordenação manual** nesta story (ordena por `created_at`). Capa/ordem
  custom ficam fora de escopo.

## Desenho

### Backend (`services/api/src/modules/bible-course/`)

- Nova entity `BibleCourseClassPhoto` (`bible_course_class_photos`):
  `id`, `class_id` (FK → `bible_course_classes`, indexado), `file_url`,
  `file_name`, `mime_type`, `size_bytes`, `created_by_user_id`, `created_at`,
  `deleted_at`. Espelha `ActivityAttachment` simplificado (sem comment/duration).
- Migration nova `…-BibleCourseClassPhotos.ts` criando a tabela (snake_case, UUID
  v4, soft delete). **Nunca editar migration existente.**
- DTO `UploadBibleCourseClassPhotoDto` (validação de mime/size com
  `class-validator`); upload multipart como o de activity attachment.
- Service: `addPhoto(classId, file, userId)`, `listPhotos(classId)`,
  `removePhoto(photoId, userId)` — `removePhoto` soft-deleta o registro e chama
  `StorageService` para apagar o objeto. Validar que a turma existe e não está
  soft-deletada. Regra de negócio só no service; controller fino.
- Controller: `POST /bible-course/classes/:classId/photos`,
  `GET  /bible-course/classes/:classId/photos`,
  `DELETE /bible-course/classes/:classId/photos/:photoId`. Guard JWT + qualquer
  Staff. Atualizar `fonte-api.postman_collection.json` com os 3 endpoints.
- `@fonte/types`: tipo `BibleCourseClassPhoto` (contrato compartilhado).
- `@fonte/api-client`: métodos `bibleCourse.listClassPhotos`,
  `uploadClassPhoto`, `deleteClassPhoto` — não duplicar HTTP nos apps.

### adm.fonte

- Em `features/bible-course/`: hook `useBibleCourseClassPhotos(classId)` (query +
  mutations `useUploadBibleCourseClassPhoto` / `useDeleteBibleCourseClassPhoto`,
  mesmo arquivo). Query key em `lib/queryKeys.ts` (nunca string literal).
- Componente `BibleCourseClassPhotoGallery` (grid de miniaturas + botão upload +
  deletar individual com confirmação) na tela de detalhe da turma. Componente de
  item extraído (`ClassPhotoThumb`). Estados via `LoadingState`/`EmptyState`/
  `ErrorState`. Erros via `getErrorMessage`.

### ops.fonte

- Hook equivalente + componente de galeria na tela de turma do curso bíblico.
  Upload a partir de imagem do dispositivo/câmera (image picker já usado em
  outros uploads do app). Estados de loading/empty/error com os componentes
  equivalentes do app.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado.

- **Backend** (`pnpm test:api` / `pnpm test:api:cov`):
  - service: adicionar foto (persiste registro + chama storage), listar fotos da
    turma (ordenadas, exclui soft-deletadas), remover (soft delete + delete no
    bucket via StorageService mockado), turma inexistente → erro, mime inválido →
    rejeita.
  - controller: rotas roteiam pro service, guard de auth, validação de DTO.
  - e2e (`pnpm test:api:e2e`): fluxo upload → list → delete autenticado;
    não-autenticado bloqueado.
- **adm.fonte** (`pnpm test:adm` + runner de cobertura): unit do hook (query +
  mutations invalidam a key) e do `BibleCourseClassPhotoGallery` (render grid,
  empty, erro, ação deletar). E2E do fluxo de subir e remover foto na turma.
- **ops.fonte**: cobrir hook e componente de galeria conforme runner do app.
- **Contratos**: `pnpm build:types` e `pnpm build:api-client` verdes após
  adicionar tipo/cliente.

## Fora de escopo

- Reordenação manual / foto de capa / definição de destaque.
- Legendas/álbuns por encontro.
- Edição de imagem (crop/filtros) no cliente.
- Galeria fora da turma (curso/módulo/matrícula).
- Varredura geral de órfãos no bucket — é a story 93.
