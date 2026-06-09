# Status da adequação LGPD

> Branch `feat/lgpd-conformidade`. Atualizado em 2026-06-09. Commits locais (sem push).

## Concluído (backend + documentos)

### Fase 0 — Documentação
- Diagnóstico (`DIAGNOSTICO_LGPD.md`), roadmap (`ROADMAP_LGPD.md`) e minutas legais em `documentos/` (política de privacidade, aviso de acolhimento, termos de consentimento, ROPA, retenção/descarte, plano de incidentes, ato de nomeação do DPO). **Minutas — exigem validação jurídica.**
- Base legal definida por processo (saúde = tutela da saúde; consentimento só p/ imagem e divulgação religiosa).

### Fase 1 — Segurança de acesso
- **Rate-limit no login** (`@nestjs/throttler`, 5/min/IP; ignorado em teste via `LoginThrottlerGuard`).
- **Mascaramento de CPF/RG** (`SensitiveDataInterceptor` + `@RevealSensitive`): listas e SERVANT sempre mascarados; detalhe completo só ADMIN/COORDINATOR.
- **Audit log** (`audit_logs` + `@Audit` + interceptor): registra acesso/alteração a dado sensível; `GET /audit/:targetType/:targetId` (ADMIN).
- **Escopo por casa forçado** em residents e staff (houseId do JWT, não do parâmetro).

### Docs assináveis no acolhimento
- Flag `signAtAdmission` em `document_templates`; `GET /residents/:id/admission-documents` (template + status de assinatura + caminho do PDF preenchido).

### Fase 2 — Consentimento
- `consent_records` append-only; `ConsentService` (grant/revoke/hasActiveConsent/status/history); endpoints `/consents`.

### Fase 3 — Direitos do titular
- `DataRightsService`: `GET /residents/:id/data-export` (portabilidade) e `POST /residents/:id/anonymize` (esquecimento — pseudonimiza, remove arquivos do bucket, soft-delete, preserva histórico financeiro/legal).

### Fase 4 — Retenção / soft delete
- `deleted_at` + `@DeleteDateColumn` em: admissions, messages, bible_course_enrollments, resident_usage_sessions, support_group_checkins, support_group_relative_checkins.

### Validação
- Migrations aplicadas no DB de teste. **298 testes unitários + 135 e2e** passando. Build de produção OK. Postman atualizado.

## Pendente

### Não-código (requer pessoas/jurídico)
- Validar todas as minutas com advogado; preencher CNPJ/endereço/DPO.
- Nomear o Encarregado (DPO) e publicar contato.
- Confirmar prazos legais de retenção na `politica-retencao-descarte.md`.

### Backend
- Escopo por casa em **relatives** (`findByResident`) — ainda não força a casa do interno.
- **Gate de consentimento** antes de publicar imagem/divulgação religiosa: `ConsentService.hasActiveConsent` existe, mas falta chamar no ponto de publicação (quando esse fluxo existir).
- **Job de purga/anonimização** automático ao fim do prazo de retenção (Fase 4) — não implementado; hoje a anonimização é manual via endpoint.
- Soft delete nas demais tabelas sem PII (movimentos/logs) — deixado de fora de propósito; revisar caso a caso se necessário.
- Avaliar anonimização de PII nos dumps de backup.

### Frontend

**adm.fonte — concluído** (api-client estendido; typecheck + build OK):
- Toggle **"Assinar no acolhimento"** (`signAtAdmission`) no editor de template.
- Seção **"Documentos para assinatura no acolhimento"** na aba de Anexos do filho (gera PDF preenchido + upload do assinado).
- Aba **"Privacidade"** (ADMIN/COORDINATOR): consentimentos por finalidade (registrar/revogar), exportar dados (JSON), anonimizar com confirmação, trilha de auditoria sob demanda.
- CPF/RG já chegam mascarados do backend — exibição automática.
- `@fonte/api-client`: módulos `consents`, `audit`; `residents.getAdmissionDocuments/exportData/anonymize`; tipos LGPD.

**ops.fonte / app.fonte — não iniciado** (apps ativos; é só implementar as telas):
- app.fonte (familiar, role RELATIVE — ativo): exibir política de privacidade e permitir ao familiar gerir o próprio consentimento (aceite/revogação).
- ops.fonte (operadores): coleta de consentimento e exibição de documentos de acolhimento no fluxo do operador, se desejado.
- Tipos de consentimento hoje definidos localmente no backend e no api-client; mover p/ `@fonte/types` se ops/app forem consumir.
