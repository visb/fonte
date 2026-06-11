# Plan: Estender proteções LGPD aos dados dos servos (Staff)

## Context

A adequação LGPD (branch `feat/lgpd-conformidade`, já em `main`) implementou consentimento,
direitos do titular e retenção **apenas para Resident** (e consentimento também para Relative).
A entity `Staff` guarda os **mesmos dados sensíveis do art. 11** que `Resident` —
`healthIssues`, `continuousMedication`, `religion`, `addiction` — além de CPF, RG, endereço e
foto. Requisito do cliente: as mesmas proteções devem valer para os servos.

**Já coberto para Staff (não retrabalhar):**

- Mascaramento de CPF/RG (`SensitiveDataInterceptor` + `@RevealSensitive` em `staff.entity.ts`).
- Audit log de acesso/alteração (`@Audit` cobre Staff).
- Escopo por casa forçado em `staff.service.ts` (houseId do JWT).
- Soft delete (`deleted_at` já existia em `staff`).
- Inventário/ROPA e minutas jurídicas já mencionam Staff.

**Gaps a fechar (escopo desta story):**

| # | Proteção | Estado atual | Entrega |
|---|---|---|---|
| 1 | Consentimento | `ConsentSubjectType = 'RESIDENT' \| 'RELATIVE'` em `consent-record.entity.ts` | Adicionar `'STAFF'` |
| 2 | Export de dados (art. 20) | Só `GET /residents/:id/data-export` | `GET /staff/:id/data-export` |
| 3 | Anonimização/esquecimento (art. 18) | Só `POST /residents/:id/anonymize` | `POST /staff/:id/anonymize` |
| 4 | Job de retenção (art. 15/16) | `RetentionService` só varre residents | Incluir staff soft-deleted além do prazo |

---

## Desenho

### 1. Consentimento para Staff

- `consent-record.entity.ts`: ampliar `ConsentSubjectType` com `'STAFF'`. Coluna é `varchar` —
  **sem migration** (verificar se não há CHECK constraint na migration original; se houver, nova
  migration para ampliar).
- `ConsentService` / `consent.controller.ts`: aceitar `subjectType: 'STAFF'`; validar que o
  `subjectId` existe em `staff`.
- Finalidades iguais (`IMAGE_PUBLICATION`, `RELIGIOUS_DISCLOSURE`) — servo também aparece em
  foto e divulgação religiosa da comunidade.
- Self-service `/consents/me`: hoje resolve titular RELATIVE/RESIDENT pelo JWT. Estender para
  `profile_type === 'STAFF'` (todo staff tem `user_id` obrigatório).
- Tipos no `@fonte/api-client` (e avaliar mover para `@fonte/types`, pendência já anotada em
  `docs/lgpd/STATUS.md`).

### 2. Export de dados (portabilidade)

- `DataRightsService`: novo método `exportStaffData(staffId)` espelhando o export de resident —
  JSON com dados cadastrais, consentimentos e registros vinculados ao servo.
- `GET /staff/:id/data-export` (ADMIN; avaliar COORDINATOR da mesma casa).
- Auditar via `@Audit` como o export de resident.

### 3. Anonimização (esquecimento)

- `DataRightsService.anonymizeStaff(staffId)` espelhando `anonymize` de resident:
  - Pseudonimizar campos pessoais e sensíveis da entity `Staff`.
  - Remover arquivos do bucket (`photoUrl` e anexos, se houver).
  - Soft delete do registro e do `User` vinculado (staff sempre tem `user_id` — revogar acesso).
  - Preservar vínculos históricos obrigatórios (registros operacionais que referenciam o staff
    como autor — ex. incidents, audit logs — mantêm o UUID, perdem o nome).
- Regra de negócio: **só permitir anonimizar staff já desligado** (soft-deleted ou status
  equivalente) — não anonimizar servo ativo.
- `POST /staff/:id/anonymize` (ADMIN, com confirmação no frontend).

### 4. Job de retenção

- `RetentionService`: além de residents, varrer `staff` com `deleted_at` além de
  `LGPD_RETENTION_DAYS` e chamar `anonymizeStaff`. Mesmo cron semanal e advisory lock;
  mesmo endpoint manual `POST /lgpd/retention/run`.

### 5. Frontend adm.fonte

- Replicar a aba **"Privacidade"** do detalhe do filho no **detalhe do servo**
  (`features/staff/`): consentimentos (registrar/revogar), exportar dados, anonimizar com
  confirmação, trilha de auditoria.
- Reutilizar componentes da feature de privacidade do resident — extrair o que for genérico
  para `components/shared/` em vez de copiar (regra CLAUDE.md).
- `@fonte/api-client`: `staff.exportData`, `staff.anonymize`, consents com subject STAFF.

---

## Validação

- `pnpm test:api` — unit tests novos: consent STAFF, export staff, anonymize staff (incluindo
  recusa para staff ativo), retention varrendo staff.
- `pnpm test:api:e2e` — fluxos consent/export/anonymize de staff.
- E2E adm.fonte (Playwright) se a aba Privacidade do servo entrar no escopo do PR.
- Atualizar `fonte-api.postman_collection.json` (novos endpoints).
- Atualizar `docs/lgpd/STATUS.md` e `DIAGNOSTICO_LGPD.md` §3 (gap fechado).

## Fora de escopo

- Consentimento de staff no ops.fonte/app.fonte (servo usa adm ou fluxo self-service futuro).
- Anonimização de PII em dumps de backup (pendência separada em `docs/lgpd/STATUS.md`).
- Direitos do titular para Relative (avaliar em story própria se o jurídico apontar necessidade).
