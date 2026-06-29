# Plan: Aba de anexos do servo

## Context

Bloco do BACKLOG "perfil dos servos": *"Servos também devem ter aba de anexos."*

Parte **3/3** do bloco (ver story 96 — campos/abas — e story 97 —
whatsapp/login). Hoje o `Resident` já tem anexos (upload na pasta `attachments`
do bucket — `resident.service.ts:709`, deleção em `:721`) e há o padrão de
`activity_attachments` (story 73/74). O `Staff` **não** tem anexo nenhum. O
pedido: dar ao servo uma **aba de anexos** no cadastro, espelhando o que filhos
já têm (documentos, contratos, comprovantes, etc).

### Decisões travadas

- **Reusar o padrão de anexos existente** (resident/activity): tabela própria
  `staff_attachments` 1-N ancorada no `staff`, com `file_url`/`file_name`/
  `mime_type`/`size_bytes`/`created_by_user_id`, soft delete, upload via
  `StorageService` na pasta `attachments`/`staff`.
- **Limpeza de bucket no delete** (coerente com a story 93): soft delete do
  registro **e** delete do objeto via `StorageService` (best-effort).
- **Tipos de arquivo**: documentos e imagens (pdf, jpeg, png, etc) — não
  restringir a imagem (anexo genérico, como o do resident). Validar mime/size no
  DTO.
- **Permissão**: gestão de staff é ADMIN + COORDINATOR (controller atual de
  staff). Subir/listar/remover anexo de servo segue essa regra.
- **UI**: nova aba "Anexos" no form/detalhe do servo (encaixa nas abas da story
  96). Lista de anexos + upload + remover (com confirmação).

## Desenho

### Backend (`services/api/src/modules/staff/`)

- Nova entity `StaffAttachment` (`staff_attachments`): `id`, `staff_id`
  (FK → `staff`, indexado), `file_url`, `file_name`, `mime_type`, `size_bytes`,
  `created_by_user_id`, `created_at`, `deleted_at`. Espelha `ActivityAttachment`
  simplificado.
- Migration nova `…-StaffAttachments.ts` (snake_case, UUID v4, soft delete).
  **Nunca editar migration existente.**
- DTO `UploadStaffAttachmentDto` (mime/size com `class-validator`); upload
  multipart.
- Service: `addAttachment(staffId, file, userId)`, `listAttachments(staffId)`,
  `removeAttachment(attachmentId, userId)` — `remove` soft-deleta e apaga o
  objeto no bucket (best-effort). Validar servo existe / não soft-deletado.
  Regra no service; controller fino.
- Controller: `POST /staff/:id/attachments`, `GET /staff/:id/attachments`,
  `DELETE /staff/:id/attachments/:attachmentId`. Guard JWT +
  `@Roles(ADMIN, COORDINATOR)`. Atualizar
  `fonte-api.postman_collection.json` (3 endpoints).
- `@fonte/types`: tipo `StaffAttachment`.
- `@fonte/api-client`: `staff.listAttachments` / `uploadAttachment` /
  `deleteAttachment`. Não duplicar HTTP.

### adm.fonte (`features/staff/`)

- Hook `useStaffAttachments(staffId)` + mutations
  `useUploadStaffAttachment` / `useDeleteStaffAttachment` (mesmo arquivo). Query
  key em `lib/queryKeys.ts` (nunca literal).
- Componente `StaffAttachmentsTab` (lista + upload + remover) como nova aba do
  form/detalhe do servo. Item extraído (`StaffAttachmentRow`). Estados via
  `LoadingState`/`EmptyState`/`ErrorState`; erros via `getErrorMessage`.
  Componente < ~150 linhas.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:api:e2e` + `pnpm test:adm` + cobertura do adm.)

- **Backend**:
  - service: adicionar (persiste + upload), listar (exclui soft-deletados),
    remover (soft delete + delete no bucket via StorageService mockado), servo
    inexistente → erro, mime inválido → rejeita.
  - controller/e2e: rotas exigem ADMIN/COORDINATOR (SERVANT/não-auth bloqueados);
    fluxo upload → list → delete.
- **adm.fonte**: hook (query + mutations invalidam a key) e `StaffAttachmentsTab`
  (render lista, empty, erro, deletar). E2E: subir e remover anexo no cadastro do
  servo.
- **Contratos**: `pnpm build:types` / `pnpm build:api-client` verdes.

## Fora de escopo

- Categorização/tipo de documento (contrato vs RG etc) — anexo genérico.
- Versionamento de anexos.
- Anexos para Relative (só Staff aqui).
- Pré-visualização/edição de documento no cliente.
