# Plan: Atividades — anexos na atividade e nos comentários

## Context

Follow-up do módulo Atividades (story 48), do modal de detalhes (story 62) e dos comentários
(story 65). Item 3 do BACKLOG: **poder adicionar anexos à atividade e aos comentários.**

O projeto já tem **infra de anexo madura** e é o que esta story reusa, sem reinventar:

- Módulo `storage` (`services/api/src/modules/storage/`): `StorageService.upload(folder, filename,
  buffer, mimetype)` grava em **S3 (Cloudflare/MinIO) com fallback local**; `signUrl`/cache;
  `storage-url.interceptor` assina URLs S3 na resposta; `delete`/`download`.
- Padrão de upload (ver `message.controller.ts`): `@UseInterceptors(FileInterceptor('file',
  { storage: memoryStorage(), limits: { fileSize: 20MB } }))` + **allowlist de mimetype** +
  `storage.uniqueFilename` + `storage.upload`. `decodeOriginalName` corrige acento de multipart.
- Padrões de entidade de anexo: `resident-attachment`, `message` (attachment_url/type),
  `resident-follow-up` (attachment_url), `payable` (PayableAttachment).

### Decisões travadas

- **Escopo de UI: `adm.fonte` + `ops.fonte`.** Anexar/baixar/excluir tanto na atividade quanto nos
  comentários, **nos dois apps**. (Correção do planning: o usuário pediu comentários no ops também
  — a story 65 foi atualizada para incluir UI de comentários no ops; **esta story depende disso**.)
- **Depende da story 65** (comentários) para os anexos de comentário — backend de comentários +
  UI nos dois apps. Anexos de atividade não dependem de comentários.
- **Modelo de dados: uma tabela `activity_attachments`** (snake_case, UUID, soft delete), com a
  atividade como âncora de escopo e o comentário como pai opcional:
  - `id` uuid pk
  - `activity_id` uuid FK `activities` (**sempre** preenchido; índice) — usado pra visibilidade
  - `comment_id` uuid FK `activity_comments` **nullable** — `null` = anexo da própria atividade;
    preenchido = anexo daquele comentário
  - `file_url` text (URL S3/local, assinada na resposta pelo interceptor)
  - `file_name` text (nome original, via `decodeOriginalName`)
  - `file_type` varchar — `image` | `document` (derivado do mimetype)
  - `mime_type` varchar
  - `size_bytes` int
  - `created_by_user_id` uuid FK `users` — quem anexou
  - `created_at`, `deleted_at`
- **Tipos aceitos (allowlist):** imagens (`jpeg/png/gif/webp`) + documentos (`pdf`, `doc/docx`,
  `xls/xlsx`). **Sem áudio nesta story** — gravação/áudio é a story 74. Limite **20 MB** (igual ao
  message). Mimetype validado no controller; rejeição clara fora da allowlist.
- **Permissão de exclusão = regra de edição da entidade-pai:**
  - Anexo **da atividade**: ADMIN sempre; criador da atividade enquanto ela ainda é editável
    (`DRAFT`, como na regra de conteúdo da story 48). (Espelha "mesma regra de edição da atividade".)
  - Anexo **de comentário**: autor do comentário ou ADMIN (regra de exclusão de comentário da
    story 65).
  - Backend é a autoridade; o front esconde/desabilita o botão de excluir conforme a regra.
- **Quem anexa = quem enxerga/edita.** Anexar na atividade segue a visibilidade por casa da story
  48 (`assertVisible`). Anexar em comentário segue a regra de comentar da story 65. Sem anexo de
  `RELATIVE`/`RESIDENT`.
- **Vários anexos por atividade e por comentário** (1:N).

## Desenho

### Backend (`services/api/src/modules/activity/`)

- **Entity** `ActivityAttachment` (`activity-attachment.entity.ts`) conforme o modelo acima.
- **Migration** nova (`...-ActivityAttachments.ts`): tabela + FKs (`activity_id`, `comment_id`,
  `created_by_user_id`) + índices em `activity_id` e `comment_id`. Nunca editar migration existente.
- **Service** (`activity-attachment.service.ts` ou métodos no `activity.service`):
  - `assertVisible` reusado p/ ler/criar anexo de atividade; regra da story 65 p/ anexo de comentário.
  - `addAttachment(activityId, commentId|null, file, user)`: valida visibilidade/permissão,
    `storage.upload('activities', uniqueFilename, buffer, mimetype)`, persiste, retorna a view.
  - `listAttachments` por atividade (e por comentário) — ou embutir no payload (ver abaixo).
  - `deleteAttachment`: assertCanDelete (regra da entidade-pai), `storage.delete(file_url)` +
    `softRemove`.
- **Controller fino** (`@UseGuards(JwtAuthGuard, RolesGuard)`, ADMIN/COORDINATOR/SERVANT):
  - `POST /activities/:id/attachments` — multipart `FileInterceptor('file', memoryStorage, 20MB)`,
    allowlist de mimetype, anexo da atividade.
  - `POST /activities/:id/comments/:commentId/attachments` — idem, anexo de comentário.
  - `DELETE /activities/:id/attachments/:attachmentId` — exclui (qualquer anexo da atividade,
    inclusive de comentário; regra de permissão no service).
- **Embutir anexos no payload de leitura**: `GET /activities/:id` (detalhe) traz `attachments` da
  atividade (comment_id null); o payload de comentários (`GET /activities/:id/comments`, story 65)
  traz os anexos de cada comentário. Assim o front renderiza sem GET extra. As URLs passam pelo
  `storage-url.interceptor` (assinadas) — registrar os campos `file_url`/`attachments[].fileUrl`
  no padrão de assinatura, como os outros módulos fazem.
- **Spec**: upload aceito (mimetype ok) / rejeitado (fora da allowlist, >20MB); visibilidade barrada
  (atividade de outra casa); exclusão por autor/ADMIN ok e por terceiro barrada; anexo de comentário
  segue a regra da story 65.

### packages/types / api-client

- Tipo `ActivityAttachment` em `@fonte/types` (id, activityId, commentId|null, fileUrl, fileName,
  fileType, mimeType, sizeBytes, createdByUserId, createdAt). Embutir `attachments` em `Activity`
  (detalhe) e em `ActivityComment`. `pnpm build:types`.
- `api-client`: `uploadActivityAttachment(activityId, file)`,
  `uploadCommentAttachment(activityId, commentId, file)`,
  `deleteActivityAttachment(activityId, attachmentId)` (multipart). `pnpm build:api-client`.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Hooks: `useUploadActivityAttachment`, `useUploadCommentAttachment`, `useDeleteAttachment`
  (invalidam `activities.detail`/`activities.comments`). Query keys em `queryKeys.ts`.
- Componente reutilizável `AttachmentList` + `AttachmentItem` (nome, ícone por tipo, link de
  download/preview de imagem, botão excluir quando permitido) e um `AttachmentUploader` (input
  file, valida tipo/tamanho no cliente antes de enviar; erros via `getErrorMessage`).
- Integrar no `ActivityDetailsDialog` (anexos da atividade) e no `CommentItem`/form de comentário
  (anexos do comentário). Estados via `LoadingState`/`EmptyState`/`ErrorState`.

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- Equivalentes em RN: anexar via picker (`expo-document-picker`/`expo-image-picker`, conforme já
  usado no app), lista de anexos com download/preview, excluir quando permitido. Hooks/estado
  equivalentes; `Controller` onde houver form. Mesma allowlist/limite validados no cliente +
  autoridade no backend.

### Postman

- Adicionar os 3 endpoints de anexo (upload atividade, upload comentário, delete) na coleção
  `fonte-api.postman_collection.json`.

## Validação

- `pnpm build:types` + `pnpm build:api-client` (novo tipo/métodos).
- `pnpm test:api` verde + migration roda em `pnpm dev:api`.
- **adm**: `pnpm --filter adm.fonte build`. Smoke: anexar imagem e pdf na atividade; anexar em um
  comentário; excluir o próprio anexo; tentar tipo não permitido (barrado); conferir escopo por casa.
- **ops**: typecheck/compila. Smoke (se emulador): anexar/baixar/excluir na atividade e em comentário.
- **Gate de cobertura (trava a story):** todo caminho novo/alterado tem teste — nenhum código novo
  sem teste. Backend: allowlist de mimetype, limite de tamanho, `assertVisible`/permissão de
  exclusão (autor/ADMIN/terceiro barrado) para anexo de atividade **e** de comentário, e remoção do
  arquivo no `storage.delete`. Frontend: hooks + `AttachmentUploader` (validação cliente) +
  `AttachmentItem` (botão excluir condicional) nos dois apps. Rodar `pnpm test:api:cov` + runners de
  cobertura do `adm.fonte` e do `ops.fonte`; **não reduzir** a cobertura do módulo `activity` nem
  das features `activities`. Sem `skip`/`only`/`xfail` injustificado (CLAUDE.md).

## Fora de escopo

- **Gravação de áudio** pelo microfone e upload de arquivo de áudio (item 4 / story 74) — esta
  story aceita só imagem e documento.
- Edição de anexo (renomear), versionamento, antivírus/scan de upload.
- Anexos em outras entidades fora de atividade/comentário.
- Pré-visualização avançada (viewer de pdf embutido) além de link de download + preview de imagem.
