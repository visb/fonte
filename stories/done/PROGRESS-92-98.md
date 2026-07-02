# PROGRESS — stories 92–98 (features: curso bíblico, bucket, eventos, perfil servo)

Rodada autônoma (AUTORUN). Rodada de **FEATURES** — cada story muda código de produção (entidade,
migration, DTO, endpoint, contrato, frontends). Decisões travadas em cada `stories/NN-*.md`.

Ordem: `92 → 93 → 94 → 96 → 97 → 98 → 95`. Fonte de verdade: esta seção + git log.

**Gate**: threshold global de 90% já travado (story 91) — código novo sem teste reprova a suíte de
cobertura. DoD = suíte tocada verde + cobertura ≥ 90 no pacote tocado antes do merge.

## Dependências
- 92, 93 — independentes (podem pular sem travar a fila).
- **94 antes de 95** (rígida): 95 usa audiência/página de detalhe da 94.
- **96 → 97 → 98** (rígida): 96 monta as abas; 97 renomeia campo na aba; 98 add aba Anexos.
- **97 antes de 95** (semi-rígida): 95 usa whatsapp do servo (fallback `staff.phone` se 97 não entrou).

## Migrations da rodada
Próximo timestamp livre **≥ 1784200000000** (última usada: `1784100000000-NormalizeTemplateImageUrls`).
Stories com migration: 92 (`bible_course_class_photos`), 94 (coluna `audience` em events), 96 (DROP
campos de tratamento em staff), 97 (RENAME `staff.phone`→`whatsapp`), 98 (`staff_attachments`).
Registrar aqui o timestamp efetivamente usado por cada uma ao implementar (evitar colisão).

## PENDENTE-MANUAL esperado
- **95**: aprovar template `META_WA_TEMPLATE_NAME_EVENT_INVITE` na Meta + envs
  `META_WA_PHONE_NUMBER_ID`/`META_WA_TOKEN`/`APP_ASSOCIADOS_URL`. Código atrás de `WhatsAppClient`
  (mock nos testes); não bloqueia implementação.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 92 — fotos por turma (curso bíblico) | [OK] | api unit 975✓ + e2e 367✓; adm unit 949✓ + e2e 11✓; ops unit 530✓; api-client 251✓ | 3eeb98a | 1d25524 |
| 2 | 93 — limpeza de órfãos no bucket | [OK] | api unit 1006✓ (105 suites) cov global verde (exit 0); api e2e 371✓ (27 suites, inclui storage-reconcile 401/403/200 dry-run/apply) | f2e6184 | ffb411b |
| 3 | 94 — eventos internos | [OK] | api unit 1014✓ cov 90.6% (exit 0) + e2e 380✓; adm unit 962✓ cov 90.84% (exit 0) + e2e events 9✓; ops unit 536✓ cov 91.52% | 4420b0b | f706bef |
| 4 | 96 — perfil servo sem campos de tratamento + abas | [OK] | api unit 1015✓ (105 suites) cov verde (exit 0) + e2e 382✓ (27 suites); adm unit 974✓ cov 90.99% (exit 0) + e2e staff 10✓ | 3340ed2 | 7f7a326 |
| 5 | 97 — whatsapp como campo e login do servo | [OK] | api unit 1020✓ cov verde (exit 0) + e2e 385✓; adm unit 977✓ cov 90.99% (exit 0) + e2e auth/staff 16✓ + houses 7✓; ops unit 536✓; api-client 251✓ | 9a539da | 1283a54 |
| 6 | 98 — aba de anexos do servo | [OK] | api unit 1032✓ (106 suites) cov verde (exit 0) + e2e 393✓; adm unit 989✓ cov 91.07% (exit 0) + e2e staff 11✓; api-client 254✓ | 5d70050 | b80c3a8 |
| 7 | 95 — convite WhatsApp p/ servos nos eventos | [PARCIAL] | api unit 1041✓ (107 suites) cov verde (exit 0) + e2e 401✓ (28 suites); adm unit 1000✓ cov 91.12% (exit 0) + e2e events 10✓; portal unit 93✓ cov 99.16% + e2e 4✓; api-client 256✓ | 7b4b000 | 3d04398 |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

[PARCIAL] 95 — testes: backend unit **1041✓** (107 suites) + cov **verde (exit 0)** + e2e **401✓** (28 suites; novo events-invite.e2e + events-public.e2e detalhe por link direto; WhatsApp 100% mockado via `WHATSAPP_CLIENT` — Meta nunca chamada); adm unit **1000✓** (170 files) cov **91.12/86.02/84.4/91.12 (exit 0)** + e2e Playwright events **10/10✓** (inclui fluxo de convite); portal unit **93✓** cov **99.16% (gate ok)** + build vite ok + e2e **4/4✓**; api-client **256✓** cov 99.09 lines (gate 99 mantido). Implementado: `EventInviteService.inviteStaff` best-effort — `staff.whatsapp` (dígitos, story 97) normalizado E.164 DDI 55, link `<APP_ASSOCIADOS_URL>/eventos/:id`, resumo `{sent, skipped[{staffId, reason}]}` com `NOT_FOUND|NO_WHATSAPP|SEND_FAILED`; endpoint `POST /events/:id/invite-staff` (ADMIN/COORDINATOR, DTO `staffIds: uuid[]`); **tensão 94×95 resolvida**: `GET /public/events/:id` resolve QUALQUER evento por link direto, listagem pública segue só PUBLIC+inscrição ligada (interno não vaza); `EventPublic.registrationEnabled` + portal esconde formulário quando false; adm: `InviteStaffDialog` autossuficiente (multi-select, filtro por casa, selecionar todos, resumo) + `useInviteEventStaff` + botão "Convidar servos" na timeline; tipos `EventInviteResult/Skipped/SkipReason`; api-client `events.inviteStaff`; Postman: request novo + doc; `.env.example` com `META_WA_TEMPLATE_NAME_EVENT_INVITE`. Sem migration. Fixes colaterais mínimos no api-client: export faltante `BibleCourseClassPhoto` (quebrava tsc -b do adm já na main) + teste de contrato de `listInternal` (gap de cobertura). — commit: 7b4b000 — merge: 3d04398 — arquivo: 6a880cd — 2026-07-02 — **PENDENTE-MANUAL** (única parte não-autônoma, código degrada limpo sem env: tudo cai em `skipped: SEND_FAILED`): (1) aprovar template `convite_evento` na Meta (3 variáveis título/data/local + botão URL dinâmica) e setar `META_WA_TEMPLATE_NAME_EVENT_INVITE`; (2) envs de produção `META_WA_PHONE_NUMBER_ID`/`META_WA_TOKEN`/`APP_ASSOCIADOS_URL`.

[OK] 98 — testes: backend unit **1032✓** (106 suites) + cov **verde (exit 0)** + e2e **393✓** (27 suites; staff.e2e describe attachments: 401, 403 SERVANT, 400 mime, 404 staff/anexo, upload→list→delete); adm unit **989✓** (169 files) cov **91.07/85.96/84.31/91.07 (exit 0)** + e2e Playwright staff **11✓** (inclui sobe-e-remove anexo); api-client **254✓** (+3 contratos, após build:types+build:api-client). Implementado: tabela `staff_attachments` (migration **1784600000000**, soft delete); `StaffAttachmentService` add/list/remove — upload em `attachments/staff/`, allowlist docs+imagens 20 MB (`staff-attachment.mimetypes.ts`), delete de bucket **best-effort** (Logger.warn, padrão activity-attachment; StorageService mockado nos testes); rotas `POST/GET /staff/:id/attachments` + `DELETE /staff/:id/attachments/:attachmentId` (`@Roles(ADMIN, COORDINATOR)`); tipo `StaffAttachment` em @fonte/types; api-client `staff.listAttachments/uploadAttachment/deleteAttachment`; adm: query key `staff.attachments(id)`, hooks em useStaff, `StaffAttachmentsTab`+`StaffAttachmentRow` (Loading/Empty/ErrorState, getErrorMessage, AlertDialog de confirmação), aba "Anexos" no `StaffDetailPage`; Postman: 3 endpoints. — commit: 5d70050 — merge: b80c3a8 — arquivo: f6d1ad9 — 2026-07-02 — sem bloqueio. Desvios justificados: (1) sem `UploadStaffAttachmentDto` — upload é multipart sem body JSON; mime/tamanho validados em allowlist no service + limite Multer (padrão activity-attachment que a story manda reusar); (2) aba Anexos na **ficha** (`StaffDetailPage`), não no form rhf da 96 — anexo exige servo persistido e mutação imediata, espelhando o placement dos anexos de resident; (3) p/ ex-filho promovido, aba de anexos do acolhimento renomeada "Anexos do acolhimento" (id `resident-attachments`) p/ não colidir.

[OK] 97 — testes: backend unit **1020✓** (105 suites) + cov **verde (exit 0**, user.service 100%) + e2e **385✓** (27 suites; auth.e2e: login por whatsapp formatado/dígitos, persist normalizado, 401 desconhecido/ambíguo/senha errada, e-mail segue ok; staff.e2e +2: create/update whatsapp normalizado, `phone`→400); adm unit **977✓** cov **90.99/85.89/84.25/90.99 (exit 0)** + e2e Playwright auth+staff **16/16✓** e houses **7/7✓**; ops unit **536✓** (56 suites); api-client **251✓** (builds types+api-client verdes). Smoke live: `POST /auth/login {identifier:"11977773000"}` → 200. Implementado: migration **1784500000000**-StaffPhoneToWhatsapp (`ALTER TABLE staff RENAME COLUMN phone TO whatsapp`, dados preservados, aplicada no db de teste); `normalizeWhatsapp()` persiste só dígitos (create/update/updateMe/createFromResident); login do servo por whatsapp+senha (e-mail mantido) — `findActiveUserIdsByPhone` lê `whatsapp AS phone FROM staff` (relatives/residents intactos), regra de ambiguidade mantida (>1 usuário → 401); contratos api-client (`Staff`/`StaffMe`/`CreateStaffInput`/`UpdateStaffMeInput`/`House.coordinator`); adm: schema `contactPhone`→`whatsapp`, aba Endereço/Contato, exibições com `maskPhone` (DB agora guarda dígitos), LoginPage "WhatsApp ou e-mail"; ops: rótulos login/perfil; seeds com whatsapp (coord `11977773000`); Postman: bodies staff + doc do login por whatsapp. Fora de escopo confirmado: unicidade de whatsapp, rename em Relative/Resident, OTP. — commit: 9a539da — merge: 1283a54 — arquivo: 670a99c — 2026-07-02 — sem bloqueio. Notas: tsc ops acusa erros pré-existentes da 92 (sem gate de typecheck no ops; jest verde); Maestro não rodado (sem emulador, non-gate), yamls atualizados p/ nova mensagem de erro.

[OK] 96 — testes: backend unit **1015✓** (105 suites) + cov **verde (exit 0, gate 90)** + e2e **382✓** (27 suites); adm unit **974✓** (168 files) cov **90.99 st / 85.89 br / 84.25 fn / 90.99 ln (exit 0)** + e2e Playwright staff **10/10✓**; `tsc --noEmit` adm limpo. Implementado: colunas `addiction`/`health_issues`/`continuous_medication`/`weight`/`height` **dropadas** de `staff` (migration **1784400000000**-StaffRemoveTreatmentFields, aplicada no db de teste); entity/DTOs (`create-staff` limpo; `update-staff`/`update-staff-me` já herdavam via PartialType)/`packages/api-client` types/Postman sem os campos; form de servo (novo **e** edição) em **3 abas** via `StaffFormSection`+`StaffFormTabs` (Sistema = obrigatórios; Pessoal e Endereço/Contato opcionais) com badge "Aba com erro" no submit inválido e preservação de valores entre abas; `EditStaffPage` refatorada (deixou de usar `PersonalDataFields` shared, que expunha campos clínicos — shared intocado, residents seguem usando); `StaffOverviewTab` sem "Dependência química" e sem seção "Saúde". Testes novos: StaffFormSection.test (harness rhf real, 5 abas, navegação preserva valores, badge de erro, rank só SERVANT, casa/grupo), staffSchema.test (só aba Sistema obrigatória, campos clínicos ausentes do payload, staffTabsWithError), StaffOverviewTab.test (campos clínicos não exibidos), e2e staff.spec (criar só com aba Sistema, editar preenchendo abas opcionais, ausência de campos clínicos no detalhe). — commit: 3340ed2 — merge: 7f7a326 — arquivo: f196e56 — 2026-07-02 — sem bloqueio. Nota: `stories/BACKLOG.md` com edição do usuário (item de matrícula sugerida) deixada FORA do commit, permanece uncommitted. Próximas do bloco: 97 renomeia telefone→whatsapp na aba Endereço/Contato; 98 encaixa aba Anexos no `StaffFormSection`.

[OK] 94 — testes: backend unit **1014✓** (105 suites; event.service +audience: default PUBLIC, INTERNAL força registration/payment/capacity/fields off, 400 ao combinar INTERNAL+inscrição/paga, listInternal filtra audience+futuro+asc; event.controller delega listInternal; event-registration listPublic/getPublicView filtram audience=PUBLIC — internos não vazam) cov **global 90.6% (exit 0)**; backend e2e **380✓** (events.e2e +9: cria INTERNAL com inscrição/cobrança off, default PUBLIC, 400 INTERNAL+registration, 400 audience inválida, GET /events/internal só internos + lido por ADMIN/COORDINATOR/SERVANT + 403 RELATIVE + 401 sem token, interno some do /public/events); api-client `events.listInternal()` + enum EventAudience exportado (build:types+api-client refeitos); adm unit **962✓** cov **90.84% (exit 0)** (useInternalEvents, eventSchema audience+toEventInput força off, EventForm esconde inscrição quando Interno, EventTimelineItem badge "Interno", InternalEventsPage render) + e2e Playwright events **9✓** (cria evento interno → badge na timeline + aparece em /eventos-internos, sem botão Inscritos); ops unit **536✓** cov **91.52%** (useInternalEvents 100%, EventCard, InternalEventsPage estados). — commit: 4420b0b — merge: f706bef — 2026-06-30 — migration **1784300000000** (events.audience varchar default 'PUBLIC', backfill existentes→PUBLIC) aplicada no db de teste. Decisões da story respeitadas: criação/edição segue ADMIN+COORDINATOR; /events/internal só-leitura p/ TODOS os papéis de Staff (override @Roles no handler, rota literal antes de :id). Frontends: adm ganhou pág. "Eventos internos" (todos Staff) + toggle no form; ops ganhou **feature de eventos nova** (rota (app)/events + entrada em QuickActions, só-leitura). Postman: GET /events/internal + campo audience nos bodies. Ajuste de teste colateral: pagarme-webhook.service.spec mockava @fonte/types parcialmente (faltava EventAudience, agora usado em runtime pela entity) → mock atualizado; e2e adm "menu Eventos" passou a usar locator exact (nova entrada "Eventos internos" tornava o nome ambíguo). Sem dependência externa; sem PENDENTE-MANUAL. Nota: o warning "worker failed to exit gracefully" no runner ops é pré-existente/benigno (leak de teardown), não falha de teste nem de cobertura.

[OK] 93 — testes: backend unit **1006✓** (105 suites; novos: storage.util extractImageUrls/computeOrphans 100%, storage.service keyFromUrl/listBucketKeys/extractBucketImageUrls, storage.controller 100%, storage-reconcile.service dry-run/apply/best-effort, document-template diff de update+remove best-effort, event-registration deleteRegistration soft-delete+limpa comprovante+best-effort+404) — cobertura **gate global 90 verde (exit 0)**; backend e2e **371✓** (27 suites; novo storage-reconcile.e2e: 401 sem token, 403 COORDINATOR, 200 dry-run apply=false deletedCount 0, 200 apply=true ADMIN). Implementado: (1) **wysiwyg diff** — `DocumentTemplateService.update` carrega conteúdo bruto antigo, apaga do bucket as imagens que sumiram (mantém as conservadas); `remove` limpa todas; ambos best-effort (try/catch, log warn). (2) **event-registration** — `deleteRegistration(eventId, regId)` soft-remove + apaga comprovantes dos campos `file` via `keyFromUrl`; endpoint `DELETE /events/:id/registrations/:regId` (ADMIN/COORDINATOR, 204). (3) **reconcile ADMIN one-shot** — `POST /storage/reconcile?apply=false` (dry-run por padrão), `StorageReconcileService` reúne referências (15 colunas de mídia via DataSource raw + imagens dos `document_templates.content` + comprovantes em `event_registrations.answers`, inclui linhas soft-deleted = conservador) × `listBucketKeys` (ListObjectsV2 paginado) → `computeOrphans`; apply=true apaga best-effort e loga. Helpers puros `extractImageUrls`/`computeOrphans` em `storage.util.ts` (testados isolados); StorageService **mockado** em todos os testes (sem bucket real). Postman: reconcile + delete registration. — commit: f2e6184 — merge: ffb411b — arquivo: 5424a0d — 2026-06-30 — **Nota de escopo**: story lista "api · adm" mas Desenho/Validação são 100% backend (diff no save é server-side; reconcile é endpoint de manutenção ADMIN sem tela especificada) → nenhuma mudança no adm (suíte adm intocada, sem regressão). Sem migration nesta story. `message` confirmado imutável por design (sem fluxo de deleção — fora de escopo, conforme story).

[OK] 92 — testes: backend unit 975✓ (102 suites; service/controller/mimetypes da foto 29✓, service 100% stmt/fn/ln) + e2e 367✓ (bible-courses.e2e cobre upload→list→delete autenticado + 401/400-mime/404-turma/404-foto); api-client 251✓ (contratos listClassPhotos/uploadClassPhoto/deleteClassPhoto); adm unit 949✓ (hook+Gallery+Thumb+lib classPhotos, todos verdes na cov global) + e2e Playwright bible-courses 11✓ (inclui "sobe e remove uma foto da turma"); ops unit 530✓ (Gallery 100% stmt/fn/ln após +2 casos retry/delete-no-grid, hook 100%). Cobertura: gate global 90 verde em todos os pacotes tocados (api/adm/ops/api-client, exit 0). — commit: 3eeb98a — merge: 1d25524 — 2026-06-30 — migration 1784200000000 (bible_course_class_photos) aplicada no db de teste. Implementação já estava ~completa (sessão anterior); este turno validou a suíte ponta a ponta e fechou. Nota: corrigido à parte um date-bomb pré-existente e não relacionado em payables.e2e (dueDate fixo 2026-06-20 já vencido → flag overdue quebrava o CRUD); commit test(payables) c868ee8, fora do commit da story.

## Resumo final da rodada 92–98 (ENCERRADA 2026-07-02)

Rodada de features: **7/7 stories entregues e mergeadas na main** (`--no-ff`, sem push, branches
preservadas). 6 [OK] + 1 [PARCIAL] (95 — código completo, só ambiente Meta pendente).

| Story | O quê | Status | Commit | Merge |
| --- | --- | --- | --- | --- |
| 92 | fotos por turma (curso bíblico) | [OK] | 3eeb98a | 1d25524 |
| 93 | limpeza de órfãos no bucket | [OK] | f2e6184 | ffb411b |
| 94 | eventos internos (audience) | [OK] | 4420b0b | f706bef |
| 96 | perfil servo sem campos clínicos + abas | [OK] | 3340ed2 | 7f7a326 |
| 97 | staff.phone→whatsapp + login | [OK] | 9a539da | 1283a54 |
| 98 | aba de anexos do servo | [OK] | 5d70050 | b80c3a8 |
| 95 | convite WhatsApp p/ servos | [PARCIAL] | 7b4b000 | 3d04398 |

### Migrations da rodada (todas aplicadas no db de teste)
1784200000000 (92, bible_course_class_photos) · 1784300000000 (94, events.audience) ·
1784400000000 (96, DROP campos de tratamento) · 1784500000000 (97, RENAME phone→whatsapp) ·
1784600000000 (98, staff_attachments) · 95 sem migration.

### Estado final da suíte (pós-95, tudo verde, gates de cobertura intactos)
api unit 1041✓ (107 suites) + e2e 401✓ (28 suites) + cov exit 0 · adm unit 1000✓ cov 91.12% +
Playwright verdes · portal 93✓ cov 99.16% + e2e 4✓ · ops 536✓ · api-client 256✓ cov 99.09 ln.
Nenhum threshold baixado; sem skip/only sem justificativa.

### PENDENTE-MANUAL (único, story 95 — WhatsApp/Meta)
1. Aprovar template `convite_evento` na Meta (3 variáveis: título/data/local + botão de URL
   dinâmica) e setar `META_WA_TEMPLATE_NAME_EVENT_INVITE`.
2. Envs de produção: `META_WA_PHONE_NUMBER_ID`, `META_WA_TOKEN`, `APP_ASSOCIADOS_URL`.
Sem as envs o código degrada limpo (nada enviado; convites caem em `skipped: SEND_FAILED`).
Nenhuma credencial inventada; Meta nunca chamada em teste (mock via `WHATSAPP_CLIENT`).

### Reproduzir
`pnpm docker:up && pnpm test:setup && pnpm build:types && pnpm build:api-client` →
`pnpm test:api && pnpm test:api:e2e` (API teste 3001 no ar p/ e2e) ·
`pnpm --filter adm.fonte test:unit:cov` + `pnpm test:adm` (adm 5174 no ar) ·
`pnpm test:portal` · `pnpm test:ops:unit` · `pnpm --filter @fonte/api-client test`.

### Notas
- `stories/BACKLOG.md` tem edição do usuário (item de matrícula sugerida) deixada uncommitted —
  não pertence à rodada.
- Serviços deixados de pé: docker (postgres/redis), API teste 3001, adm teste 5174.

---

