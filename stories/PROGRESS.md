# PROGRESS — execução autônoma de stories

Estado da execução autônoma corrente (conduzida por `AUTORUN.md`). **Fonte de verdade para
retomar: este arquivo + `git log`.** Histórico de execuções já concluídas vive no `git log`
(stories arquivadas em `stories/done/`) — não acumular logs antigos aqui.

> Ao iniciar uma nova rodada autônoma, comece uma seção nova abaixo (`# PROGRESS — stories NN–MM`)
> e registre fila + log dela. Ao encerrar e arquivar as stories, esta seção pode ser limpa
> (o git log preserva tudo).

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada (e mergeada, se a rodada usar merge) ·
`[PARCIAL]` código completo mas parte depende de serviço externo sem credencial (mock nos testes) ·
`[BLOQUEADO]` impedida (registrar o motivo) · `[ ]` pendente

---

<!--
Modelo de seção por rodada — copiar abaixo ao iniciar:

# PROGRESS — stories NN–MM (<feature/epic>)

Ordem: <NN → ... → MM>. Fonte de verdade: esta seção + git log.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | NN — <título> | [ ] | | | |

## Log

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

## Resumo final

<o que passou, o que ficou pendente/bloqueado e por quê, comandos para reproduzir>
-->

# PROGRESS — stories 77–84 (cobertura de testes — piso 80%)

Rodada autônoma (AUTORUN). Epic **78** (guarda-chuva, config `all:true`/`collectCoverageFrom` já
mergeada — NÃO se implementa) + filhas de cobertura + e2e document-templates (77).

Ordem: `77 → 79 → 80 → 81 → 84 → 82 → 83`. Fonte de verdade: esta seção + git log.

**Natureza**: rodada de TESTES. Salvo 77 (e2e novo) e 83 (config de gate CI), nenhuma story muda
código de produção/contrato/migration/Postman. Sem dependência externa → **nenhum PENDENTE-MANUAL
esperado**.

## Dependências
- **77, 79, 80, 81, 82, 84 são independentes** — cada uma toca só o seu pacote; se uma travar,
  registrar e seguir (não para a fila).
- **83 (gate) depende de 79, 80, 81, 82 e 84 ≥ 80%** — só mergear o gate quando todas no piso;
  senão travar threshold parcial dos prontos e registrar BLOQUEADO os demais.
- **Sub-fases (80a–e, 81a–e, 84a–b)** = checkpoints commitáveis/mergeáveis que sobem a catraca; a
  story é arquivada quando o pacote inteiro bate 80% statements.

## Baseline real medido em 2026-06-22 (após `all:true`, COM orquestração no denominador)
api 46.64% · adm 6.00% (1039/17300) · ops 2.87% · app 4.61% · portal 64.26% (723/1125) ·
api-client 59.62% (446/748). **Re-baselinar cada frontend após excluir `pages/**`/rotas `app/**`** —
excluir orquestração sobe o % sem teste novo; não contar como progresso.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 77 — e2e document-templates (CRUD + auth) | [OK] | api e2e document-templates 19✓ (auth/role/validação/CRUD/upload/no-op img s76); suíte e2e 355✓ (só payables 6✗ pré-existente por data); api unit 672✓ | d6884d5 | ba0b41d |
| 2 | 79 — cobertura services/api 46→80% | [OK] | api unit 813✓/82 suites; cov 81.69% stmt (br 69.76 / fn 78.23 / ln 84.10); e2e 355✓ (só payables 6✗ pré-existente por data) | b9a02f9/b2e0c91/bfc20bd (waves 1-3) | 455d229 |
| 3 | 80 — cobertura adm.fonte 6→80% (80a–80e) | [ ] | | | |
| 4 | 81 — cobertura ops.fonte 2.87→80% (81a–81e) | [ ] | | | |
| 5 | 84 — cobertura app.fonte 4.61→80% (84a–84b) | [ ] | | | |
| 6 | 82 — cobertura portal.fonte + api-client →80% | [ ] | | | |
| 7 | 83 — catraca global + gate CI | [ ] | | | |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver> -->

[PARCIAL] 80 climbing-8 — testes: adm unit 557✓ (86 arquivos), cobertura 44.00% statements (6383/14504, branches 81.22 / functions 78.76 / lines 44.00). Catraca statements:44. AddFollowUpDialog (defaults, omite MONTHLY_CONTRIBUTION, submit muta com defaults + descrição undefined, cancelar) + PrivacyTab (loading, linhas de consentimento, registrar/revogar consentimento, exportar chama api.residents.exportData, trilha de auditoria vazia, anonimização — usa vi.hoisted p/ mock factory de api/usePrivacy). — commit: e4d6230 (merge) — 2026-06-23 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-7 — testes: adm unit 546✓ (84 arquivos), cobertura 42.06% statements (6101/14504, branches 80.73 / functions 78.28 / lines 42.06). Catraca statements:42. EventTimelineItem (título/local/capacidade, badges Próximo/Encerrado/inscrição, sem inscrição oculta Inscritos, vagas ilimitadas + banner img, callbacks editar/remover/inscritos) + ResidentsTab (loading/empty/lista com status, abrir detalhe mostra idade e navega p/ página completa) com hooks/navigate mockados. — commit: 4543b82 (merge) — 2026-06-23 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-6 — testes: adm unit 537✓ (82 arquivos), cobertura 40.80% statements (5918/14504, branches 80.65 / functions 77.72 / lines 40.80). Catraca statements:40. RegisterPaymentDialog (nome/mês/valor, submit muta receivableId/método/valor + fecha, anexo, erro, desabilitado sem receivable, pending) + ChangeContributionPlanDialog (campo negociado condicional, NEGOTIATED sem valor erro+não muta, submit padrão amount null, erro) + QuickAddCard (fechado/abre, submit vazio erro, submit válido muta title+status, cancelar fecha, erro) com hooks mockados. — commit: a0d3ec3 (merge) — 2026-06-23 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-5 — testes: adm unit 520✓ (79 arquivos), cobertura 38.72% statements (5617/14504, branches 80.55 / functions 77.69 / lines 38.72). Catraca statements:38. PayPayableDialog (descrição+valor formatado, confirmar muta id/paidAt/file null + fecha, anexar comprovante, erro, pending, cancelar) + BibleModuleDialog (criar c/ ordem sugerida, editar, inválido não muta, criar notes null, update com id, erro) + AddMinistryDialog (lista de filhos, Criar desabilitado sem nome, busca normalizada sem acento, selecionar filhos + criar com residentIds, contador de selecionados, pending) com LeaderAutocomplete + hooks de casa/ministério mockados. — commit: 87728db (merge) — 2026-06-23 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-4 — testes: adm unit 502✓ (76 arquivos), cobertura 36.82% statements (5341/14504, branches 80.44 / functions 77.54 / lines 36.82). Catraca statements:36. PersonalDataFields (harness com useForm; seções Identificação/Contato/Perfil social/Saúde, includeName false, nameLabel custom, máscaras CPF/telefone aplicadas no input) + BibleClassDialog (casa mãe pré-selecionada, término recalculado do início +75d, editar preenche, inválido não muta, criar payload notes null, update com id, erro da mutation) com useHouses + hooks SG mockados (UUIDs reais p/ passar zod). — commit: 277b700 (merge) — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-3 — testes: adm unit 490✓ (74 arquivos), cobertura 35.27% statements (5117/14504, branches 80.33 / functions 77.13 / lines 35.27). Catraca subida p/ statements:35 (branches 80 / functions 77 / lines 35). ActivityCard (DndContext wrapper; botões por status DRAFT→REQUESTED/REQUESTED+admin→Aprovar/TODO→DOING/DOING→DONE+BLOCKED/DONE→DOING; clique abre detalhes; Enter abre detalhes; editar/excluir; "Geral" sem casa) + StaffOverviewTab (MemoryRouter; CPF/RG mascarados, idade calculada, peso/altura, seção Origem condicional com link de acolhimento, travessão p/ vazios). — commit: 52848f3 (merge) — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-2 (dialogs) — testes: adm unit 476✓ (72 arquivos), cobertura 33.65% statements (4882/14504, branches 80.79 / functions 76.87 / lines 33.65). Catraca subida p/ statements:33 (branches 80 / functions 76 / lines 33). Dialogs com hooks mockados: GenerateRelativeAccessDialog + GenerateResidentAccessDialog (email inválido bloqueia, válido muta com senha gerada de 12 chars, copiar usa clipboard, erro da mutation, pending) com clipboard stub; PromoteToServantDialog (sem acesso mostra email/senha e envia senha, com acesso oculta email e omite senha, submit muta casa/rank/data e navega p/ /staff/:id no sucesso, pending) com useHouses/useNavigate mockados; SupportGroupDialog (criar/editar, inválido não muta, criar payload coordinatorId null, update com id, pending) com useStaff + hooks SG mockados. — commit: 203bc6a (merge) — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80 climbing-1 (forms) — testes: adm unit 459✓ (69 arquivos), cobertura 30.90% statements (4483/14504, branches 81.17 / functions 77.08 / lines 30.90). Catraca subida p/ statements:30 (branches 81 / functions 77 / lines 30). Forms presentacionais (props onSubmit/onCancel, rhf+zod): PayableForm (criar/editar, submit válido devolve {data,file,removeAttachment}, anexar/limpar arquivo, remover anexo existente, erro de API, pending) com api.photoUrl mockado; EventForm (criar/editar, submit válido/inválido, erro, cancelar, pending); AssociateForm (editar formata WhatsApp E.164, Controller converte input p/ E.164 no submit, inválido bloqueia, erro, pending). — commit: 657b569 (merge) — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[PARCIAL] 80e — testes: adm unit 439✓ (66 arquivos), cobertura 27.54% statements (3995/14504, branches 80.74 / functions 76.27 / lines 27.54). Catraca vitest adm subida p/ statements:27 (branches 80 / functions 76 / lines 27). Sub-fase 80e (backup+settings+dashboard+auth): backup utils (formatBytes/formatDateTime) + useBackups/useRunBackup + BackupRow; auth useChangePassword + ChangePasswordDialog (rhf+zod: submit válido muta, senha curta e senhas diferentes mostram erro de schema sem mutar, toggle visibilidade); settings useDocumentTemplates CRUD + useAppSettings (invalidação de queryKey, enabled:false idle) + TemplateCard (badge Acolhimento condicional, stopPropagation do lixo); dashboard HouseOccupancyCard (vagas calculadas, travessão sem capacidade, navega ao detalhe com useNavigate mockado). — commit: 9e5d872 — merge: 2265cfb — 2026-06-22 — sem bloqueio. TESTES-ONLY. Settings TipTap editors (TemplateEditor/Table*/Link* menus) seguem fora — orquestração de editor pesado, baixo ROI unit. Pacote ainda < 80%; climbing continua sobre os maiores gaps de statements (residents/houses tabs, forms).

[PARCIAL] 80d — testes: adm unit 414✓ (58 arquivos), cobertura 25.29% statements (3669/14504, branches 79.28 / functions 74.18 / lines 25.29). Catraca vitest adm subida p/ statements:25 (branches 79 / functions 74 / lines 25). Sub-fase 80d (messages+notifications+bible-courses): hooks+lib (af37005: useMessages/useNotifications/useBibleCourses com api-client mockado via @/lib/api + central renderHookWithClient; relativeTime; bibleClass/Module/Grade schemas) + componentes de apresentação (92ad8e5: MessageBubble aprovar/rejeitar/preview anexo/badges, Conversation+DirectConversationRow, NotificationItem com sub-ações capacidade/censo mockadas, BibleGradeRow/BibleModuleRow/BibleClassCard com MemoryRouter, EnrollmentRow com hooks mockados). — commit: af37005/92ad8e5 — merge: dcd9094 — 2026-06-22 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção. Helper central reutilizado: src/test/utils.tsx. 80a–80d mergeados; 80e + climbing pendentes — pacote ainda < 80%.

[OK] 80c — testes: cobertura adm events/support-groups/associates/census. 19.09%→20.98% statements (3043/14504), branches 75.74, functions 68.49; 351 testes✓. Libs (eventDates, associates/format, whatsappMask) + hooks (useEvents, useSupportGroups, useAssociates extras, useCensus). Catraca: statements 20 / branches 75 / functions 68 / lines 20. — commit: 84f6dcc — merge: f119b7f — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[OK] 80b — testes: cobertura adm houses/payables/billing. 16.01%→19.09% statements (2769/14504), branches 73.45, functions 62.64; 314 testes✓. Libs (payableSchema, houseChildVacancies) + hooks (usePayables, useHouses, useHouseMinistries/Rules, useContributions/useStreetSalesReport) + componentes (PayableStatusBadge, HouseCard). Catraca: statements 19 / branches 73 / functions 62 / lines 19. — commit: 80e3ac0 — merge: e6a2684 — 2026-06-22 — sem bloqueio. TESTES-ONLY.

[OK] 80a — testes: cobertura adm residents/activities/staff. Re-baseline honesto excluindo src/**/pages/** + src/test/** do denominador (17300→14504 stmts; 6.00%→7.16% SEM teste novo). 80a (libs receivables/summaryFields/residentSchema/staffSchema/activitySchema + hooks useResidents/useStaff/useActivities/useResidentExtras + componentes ResidentCard/StaffCard): 7.16%→16.01% statements (2323/14504), branches 68.82, functions 52.81; 271 testes✓ (33 suites). Helper central reutilizável src/test/utils.tsx (createTestQueryClient + createWrapper + renderHookWithClient + renderWithClient; mock do @fonte/api-client via @/lib/api por arquivo por hoisting do vi.mock). Catraca vitest thresholds travada: statements 16 / branches 68 / functions 52 / lines 16. — commit: ec6389c — merge: 8b56198 — 2026-06-22 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint.

[OK] 79 — testes: api unit 813✓ (82 suites) + cobertura 81.69% statements (3950→4359/5336, branches 69.76 / functions 78.23 / lines 84.10) — meta de 80% statements ATINGIDA; e2e 355✓ de 361 (única falha = payables.e2e 6✗ por overdue date-dependent, tech debt pré-existente, não-regressão). Catraca jest da api travada em statements:80 (branches 69 / functions 78 / lines 84) — só sobe. 3 waves: wave 1 (b9a02f9, herdada da sessão anterior) services de domínio crítico (message, resident, docx-parser com SDK Anthropic/mammoth/jszip mockados) + re-baseline honesto excluindo orquestração (*.module/main/instrument/migrations/*.dto/*.entity) → 63.09%; wave 2 (b2e0c91) specs de controller (consent, data-rights, house, message, resident, retention, staff, storeroom, wishlist) → 70.72%; wave 3 (bfc20bd) controllers finos de delegação pura (payable, relative, ministry, event, public-event, support-group, bible-course, associate, street-sale, supply-room, notification, auth, incident, document-template, activity + comment + attachment, census, resident-session, house-capacity-request) com services mockados + ramos de validação de upload → 81.69%. — commit: b9a02f9/b2e0c91/bfc20bd — merge: 455d229 — 2026-06-22 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman; unit com repos/services mockados (nunca toca banco), nenhuma chamada externa real. Scratch covreport.cjs do agente anterior descartado (não commitado). Honestidade da cobertura: denominador re-baselinado excluindo orquestração antes de contar progresso.

[OK] 77 — testes: novo spec services/api/test/document-templates.e2e-spec.ts com 19 casos✓ (401 sem token; lista 200 p/ SERVANT; 403 SERVANT em detalhe/POST/PUT/DELETE/upload; 400 UUID inválido; 409 nome duplicado no create e no rename; CRUD feliz create→get→list→update→delete→404 com flags isRequired/signAtAdmission; upload sem arquivo 400, não-imagem text/plain 400, PNG 1x1 válido 201 { url } em /uploads/documents/; pass-through no-op de <img> assinado em modo não-S3 documentando story 76); suíte e2e completa 355✓ (única falha = payables.e2e 6✗ por overdue date-dependent, tech debt pré-existente e não-regressão); api unit 672✓ — commit: d6884d5 — merge: ba0b41d — 2026-06-22 — sem bloqueio. Backend-only: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman — read-only dos endpoints existentes (GET, GET/:id, POST, PUT/:id, DELETE/:id, POST /images). Espelha activities.e2e-spec.ts e reusa o harness e2e-app.ts (bootstrapApp/login/BASE). SERVANT = operator@fonte.com/operator123 (seed-test). Limpeza no afterAll por nome único (tag e2e-<timestamp>), apagando resident_documents dependentes antes dos templates. Fluxo de URL assinada da story 76 segue fora do e2e (sem S3 no .env.test) — coberto no unit.

## Resumo final

<preencher ao terminar>

---

# PROGRESS — stories 64–75

Rodada autônoma (AUTORUN). Dois tracks independentes:
- **Atividades** (follow-ups da story 48/62): 64 visual responsável, 65 comentários, 66 histórico,
  71 descrição fora do board, 72 WYSIWYG markdown, 73 anexos, 74 áudio, 75 devolver p/ rascunho.
- **Eventos** (refino 56/57/58): 67 toggle inscrição, 68 campos custom, 69 pagamento avulso
  (backend + gateway), 70 página de pagamento no portal + notificações.

Ordem: `64 → 65 → 66 → 67 → 68 → 69 → 70 → 71 → 72 → 73 → 74 → 75` (numérica respeita todas as
deps). Fonte de verdade: esta seção + git log. Base já mergeada: 62 (modal `ActivityDetailsDialog`),
63 (drag-and-drop), 58 (inscrição pública), 41 (gateway associados).

## Dependências (sub-chains rígidas; os dois tracks são independentes entre si)
- **Atividades**: 65 e 71 dependem só da 62 (feita). 66 depende da 65. 72 depende da 71. 73 depende
  da 65. 74 depende da 73. 64 e 75 independentes.
- **Eventos** (fila rígida 67→68→69→70, não pular): 68 dep 67; 69 dep 67+58; 70 dep 69+portal 58.
- Se uma story travar, suas filhas na sub-chain travam junto (registrar e parar **aquela**
  sub-chain). Tracks/sub-chains independentes seguem normalmente — não parar a fila inteira.

## Externos sem credencial (mock nos testes, PENDENTE-MANUAL — não inventar chave, não chamar real)
- **69/70**: Pagar.me `POST /orders` (cartão/PIX) + webhook; MailService (SMTP/Resend) + WhatsApp
  template Meta. Mock do gateway/notificação nos testes; template Meta = TODO operacional.
- **73/74**: storage/bucket de anexos + áudio. Mockar upload nos testes se faltar credencial.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 64 — atividades: visual do responsável no card | [OK] | adm unit 71✓ + tsc✓ + PW activities 13✓; ops unit 27✓ + tsc✓ | b4fc409 | 3f6098a |
| 2 | 65 — atividades: comentários no modal de detalhes | [OK] | api unit 508✓ + e2e activities 30✓ (10 novos de comentário); adm unit 79✓ + tsc✓ + PW activities 15✓ (2 novos); ops unit 31✓ + tsc✓ | 1186713 | 9ad3206 |
| 3 | 66 — atividades: histórico de eventos do card + abas | [OK] | api unit 524✓ + e2e activities 36✓ (6 novos de histórico); adm unit 83✓ + tsc✓ + PW activities 15✓ (timeline na aba Histórico); migration ActivityEvents | 921ca4a | 7d81f41 |
| 4 | 67 — eventos: toggle de inscrição por evento | [OK] | api unit 531✓ + e2e 301✓ (events 33✓, +9 toggle); adm unit 87✓ (eventSchema 11) + tsc✓ + PW events 7✓ (+1 toggle) | 81bad30 | 55afa69 |
| 5 | 68 — eventos: campos de formulário customizáveis | [OK] | api unit 558✓ + e2e 308✓ (+7 campos custom/upload); adm unit 94✓ + tsc✓ + PW events 8✓ (+1); portal unit 38✓ + tsc✓ + build✓ | 12e0106 | e3f4cca |
| 6 | 69 — eventos: pagamento avulso da inscrição (backend + gateway) | [PARCIAL] | api unit 579✓ (+grossUp/pay/webhook evento/gateway createOrder mockado) + e2e 318✓ (events-payment 10✓); adm unit 100✓ + tsc✓ + PW events 8✓ | 1fac4d7 | 095c413 |
| 7 | 70 — eventos: página de pagamento no portal + notificações | [PARCIAL] | api unit 594✓ (+15: MailService best-effort, notifier email+WhatsApp, resend) + e2e 322✓ (+4: resend ADMIN 201/SERVANT 403/401/grátis 400); portal unit 53✓ (+15) + build✓ + PW 9✓ (+3 pagamento) | 2fa84b8 | 845fdb3 |
| 8 | 71 — atividades: descrição fora do board (só nos detalhes) | [OK] | api unit 597✓ (+3: findAll omite description, findOne inclui com valor e com null) + e2e 324✓ (+2: lista sem description, detalhe com); adm unit 100✓ + tsc✓ + PW activities 15✓; ops unit 31✓ + tsc✓ | 5b93b0e | 0a3638d |
| 9 | 72 — atividades: editor WYSIWYG na descrição (markdown) | [OK] | api unit 620✓ (+3 service sanitização) + sanitize-markdown 25✓ + e2e activities 39✓ (+1 sanitização); adm unit 114✓ (+14: markdown 8, links 6, 100% cov) + tsc✓ + build✓ + PW activities 16✓ (+1 XSS, edita WYSIWYG); ops unit 31✓ + tsc✓ | 769b2cd | 78a8e1b |
| 10 | 73 — atividades: anexos na atividade e nos comentários | [OK] | api unit 636✓ + e2e activities 51✓ (+12 anexos); adm unit 141✓ (+27) + tsc✓ + build✓ + PW activities 17✓ (+1 anexo); ops unit 49✓ (+18) + tsc✓ | bb1ff51 | 2a9fdda |
| 11 | 74 — atividades: áudio (upload + gravação) com player | [OK] | api unit 647✓ + e2e activities 53✓ (+3 áudio: allowlist audio/* type=audio, durationSeconds, comentário só-de-áudio body vazio); adm unit 163✓ (+ AudioPlayer play/pause+1x/1.5x/2x, validação duração ≤2min) + tsc -b✓ + PW activities 18✓ (+1: upload áudio mostra player); ops unit 67✓ + tsc✓ | 21db17e | 481823e |
| 12 | 75 — atividades: devolver solicitação para rascunho (REQUESTED → DRAFT) | [OK] | api unit 653✓ (+6) + e2e activities 336✓ (+3); adm unit 169✓ (+6) + tsc -b✓ + PW activities 20✓ (+2); ops unit 70✓ (+3) + tsc✓ | e846f32 | d761ee8 |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio> -->

[OK] 75 — testes: api unit 653✓ (+6: REQUESTED→DRAFT permitido p/ criador, p/ ADMIN não-criador, barrado p/ terceiro 403, escopo de outra casa 404, responsibleStaffId preservado, REQUESTED→DOING segue 400) + e2e activities 336✓ (+3: criador devolve a própria solicitação, ADMIN devolve preservando responsável, REQUESTED→DOING 400) — payables.e2e mantém os 6 pré-existentes falhando por data (não-regressão); adm unit 169✓ (+6: matriz isTransitionAllowed REQUESTED→DRAFT, canTransition criador/ADMIN/terceiro, resolveDrop move sem dialog p/ criador e ADMIN + invalid p/ terceiro) + tsc -b✓ + Playwright activities 20✓ (+2: arrastar Solicitações→Rascunho devolve sem dialog, botão "Devolver para rascunho" devolve; teste de drop inválido reescrito p/ DRAFT→TODO já que REQUESTED→DRAFT virou válido); ops unit 70✓ (+3: ActivityCard mostra "Devolver para rascunho" só ao criador em REQUESTED e dispara DRAFT) + tsc --noEmit✓ — commit: e846f32 — merge: d761ee8 — 2026-06-21 — sem bloqueio (sem migration, sem mudança de types/api-client/DTO/endpoint; reusa PATCH /activities/:id/status). Quem pode devolver: criador OU ADMIN (espelha "enviar"). Backend é a autoridade (matriz TRANSITIONS + ramo em assertCanChangeStatus); front espelha só a UX. responsibleStaffId preservado na devolução. STATUS_CHANGED já registrado no changeStatus (story 66) — vale para a nova aresta sem código extra. Postman: descrição do PATCH status atualizada com REQUESTED→DRAFT + exemplo { "status": "DRAFT" }.

[OK] 64 — testes: adm unit 71✓ + tsc✓ + Playwright activities 13✓ (inclui caso novo de responsável visual); ops unit 27✓ + tsc✓ — commit: b4fc409 — merge: 3f6098a — 2026-06-19 — sem bloqueio (frontend puro, sem backend/types/api-client/postman)

[OK] 65 — testes: api unit 508✓ + e2e activities 30✓ (10 novos: listar/criar/excluir comentário, escopo de casa, autor vs ADMIN vs terceiro); adm unit 79✓ + tsc✓ + Playwright activities 15✓ (2 novos: comentar/excluir + aba Histórico); ops unit 31✓ + tsc✓ — commit: 1186713 — merge: 9ad3206 — 2026-06-19 — sem bloqueio (texto puro, sem dependência externa); migration ActivityComments1783400000000; endpoints GET/POST/DELETE /activities/:id/comments no postman

[OK] 66 — testes: api unit 524✓ + e2e activities 36✓ (6 novos: CREATED na criação, STATUS_CHANGED {from,to}, COMMENTED {commentId}, ator resolvido pelo nome, escopo de casa 404, 401 sem token); adm unit 83✓ (HistoryEventItem render por tipo) + tsc✓ + Playwright activities 15✓ (timeline real na aba Histórico substitui o placeholder) — commit: 921ca4a — merge: 7d81f41 — 2026-06-20 — sem bloqueio; migration ActivityEvents1783500000000 (tabela activity_events append-only + enum + FK + índice); endpoint GET /activities/:id/events no postman; eventos gravados em create/update(título,descrição,responsável)/changeStatus/remove + COMMENTED via comment service

[OK] 67 — testes: api unit 531✓ + e2e 301✓ (events.e2e 33✓ com +9 casos de toggle: default false, persist/toggle do flag, janela ignorada quando off, 404 público/register quando desligado, list omite desligado); adm unit 87✓ (eventSchema 11: janela só valida com inscrição on, default false, toEventInput zera capacity/janela quando off) + tsc✓ + Playwright events 7✓ (+1: nasce só-divulgação, toggle habilita vagas e troca badge) — commit: 81bad30 — merge: 55afa69 — 2026-06-20 — sem bloqueio (sem dependência externa); migration EventRegistrationEnabled1783000000000 (events.registration_enabled boolean default false); GET /public/events filtra registration_enabled=true, detalhe/register 404 quando off; postman atualizado (bodies create/update + descrições públicas)

[OK] 68 — testes: api unit 558✓ (registration-fields.util por tipo: required/number/boolean/date/email/phone/select/multi_select/file; ids únicos; options p/ select; service register persiste só fieldIds conhecidos + rejeita required/select fora; uploadRegistrationFile) + e2e 308✓ (+7: registrationFields no detalhe público, register com answers válidos + admin vê, required faltando 400, select fora 400, create select sem options 400, upload file 201, mime ruim 400); adm unit 94✓ (registrationFieldSchema: select exige opções; toEventInput propaga/zera campos; round-trip fieldsToForm) + tsc✓ + Playwright events 8✓ (+1: adiciona campo select no builder + abre dialog de inscritos); portal unit 38✓ (buildRegistrationSchema por tipo + form dinâmico render/valida/submete answers) + tsc✓ + build✓; adm build✓ — commit: 12e0106 — merge: e3f4cca — 2026-06-20 — sem bloqueio (sem dependência externa; storage usa o StorageService já existente, fallback local em dev/test); migration EventRegistrationFields1783700000000 (events.registration_fields + event_registrations.answers JSONB); endpoints novos: POST /public/events/:id/registration-files; GET /public/events/:id e /events/:id/registrations estendidos; postman atualizado

[PARCIAL] 69 — testes: api unit 579✓ (event.service: paymentEnabled sem priceCents→400, gross-up persiste, priceCents zerado quando grátis; event-registration: register pago gera token+PENDING+amount_cents gross-up, grossUpCents; event-payment.service: getPublicView 404, pay cartão/PIX, 409 já-pago, 400 grátis/sem cardToken; pagarme.gateway: createOrder cartão/PIX/sem-secret com fetch mockado; pagarme-webhook: charge.paid/failed de evento por metadata/order.code, idempotência, não toca associado) + e2e 318✓ (events-payment.e2e 10✓: 400 pago sem preço, register grátis sem token, register pago PENDING+token+gross-up, GET 404, pay cartão/PIX, pay sem cardToken 400, webhook PAID idempotente, 409 já-pago, admin vê payment_status); adm unit 100✓ (eventSchema: pago exige valor, reais→centavos, grátis zera) + tsc✓ + Playwright events 8✓ — commit: 1fac4d7 — merge: 095c413 — 2026-06-20 — PENDENTE-MANUAL: configurar PAGARME_SECRET_KEY de produção e registrar o webhook no painel Pagar.me (sem a chave o gateway dispara ServiceUnavailable; toda a lógica está testada com o gateway mockado via override de PAYMENT_GATEWAY). [PARCIAL] porque o caminho de cobrança real depende dessa credencial externa.

[PARCIAL] 70 — testes: api unit 594✓ (+15: mail.service best-effort sem/com RESEND_API_KEY + erro provedor/rede; event-payment-notifier dispara email+WhatsApp com link correto, pula canal ausente, sem-token não envia, falha de um canal não impede o outro; event-registration dispara no register pago e NÃO no grátis; resendPaymentLink 200/404/400) + e2e 322✓ (events-payment +4: resend ADMIN 201 {email:false,whatsapp:false}, SERVANT 403, sem-token 401, grátis 400 — canais inertes sem credencial, nenhum serviço externo chamado); portal.fonte unit 53✓ (+15: EventPaymentChoice valor/método/cartão-cardToken/PIX-QR, EventPaymentPage por status loading/erro/PENDING/PAID/FAILED/NONE, RegistrationSuccess grátis vs pago, hook getByToken/enabled/pay) + build✓ + Playwright 9✓ (+3: token inválido, PENDING→PIX QR, cartão→confirmação após PAID via polling; associado /p/:token intacto) — commit: 2fa84b8 — merge: 845fdb3 — 2026-06-20 — PENDENTE-MANUAL: (1) aprovar na Meta o template de WhatsApp do link de pagamento de evento (META_WA_TEMPLATE_EVENT_PAYMENT, default `pagamento_evento`, com botão de URL); (2) configurar credenciais de produção — RESEND_API_KEY + MAIL_FROM (e-mail via Resend HTTP) e META_WA_PHONE_NUMBER_ID/META_WA_TOKEN (WhatsApp); (3) definir PORTAL_URL (base do portal.fonte) p/ montar `<PORTAL_URL>/pagamento/:token` (fallback APP_ASSOCIADOS_URL). Sem essas credenciais os envios ficam inertes best-effort ({sent:false}) — nenhuma API externa é chamada. [PARCIAL] porque o envio real do link depende dessas credenciais/template externos; toda a lógica está testada com mail/WhatsApp mockados.

[OK] 71 — testes: api unit 597✓ (+3: ActivityService split toListView/toView — findAll omite `description` de cada item, findOne inclui no detalhe com valor e quando null) + e2e activities 324✓ no total (+2: GET /activities não traz `description`, GET /activities/:id traz); adm unit 100✓ + tsc -b✓ + Playwright activities 15✓ (descrição só no modal de detalhes); ops unit 31✓ + tsc --noEmit✓ — commit: 5b93b0e — merge: 0a3638d — 2026-06-20 — sem bloqueio (sem dependência externa; sem migration). `Activity.description` agora opcional em @fonte/types (build:types + build:api-client refeitos); cards adm/ops não exibem mais descrição; postman atualizado (List/Get descriptions). Nota de ambiente: um Vite estranho do projeto `markethub` estava ocupando `::1:3001` e mascarava a API de teste fonte (login 404 → todos os PW falhavam); processo morto (PID externo, não do repo) e a suíte voltou verde.

[OK] 72 — testes: api unit 620✓ (+3: ActivityService.create/update sanitiza markdown) + sanitize-markdown.spec 25✓ (vetores XSS barrados — HTML bruto, javascript:/data:/vbscript: — e markdown legítimo preservado: negrito/listas/links http/mailto) + e2e activities 39✓ (+1: update sanitiza markdown, preserva legítimo); adm unit 114✓ (+14: markdown.ts 8 testes MD→HTML→DOMPurify + links.ts 6 testes normalizeLinkHref, ambos 100% cobertura) + tsc -b✓ + build✓ + Playwright activities 16✓ (+1: edita descrição no editor WYSIWYG e persiste negrito; smoke XSS <script> não executa); ops unit 31✓ + tsc --noEmit✓ — commit: 769b2cd — merge: 78a8e1b — 2026-06-20 — sem bloqueio (sem migration; sem dependência externa). Stack: TipTap 3 + tiptap-markdown (ponte MD) no adm.fonte; marked + dompurify para render read-only; react-native-markdown-display no ops.fonte. Sanitização defesa-em-profundidade: backend (sanitizeMarkdown na escrita) + adm (DOMPurify no render, allowlist http/https/mailto) + ops (render lib sem HTML bruto, onLinkPress só abre http/https/mailto). Escopo só a descrição — comentários (65) seguem texto puro.

[OK] 73 — testes: api unit 636✓ (activity-attachment.service: allowlist de mimetype barrada, visibilidade por casa 404, upload image→type image / pdf→document grava no storage, comment attachment vinculado, delete por autor-DRAFT/ADMIN/comment-author OK e terceiro/criador-fora-de-DRAFT barrado 403, storage.delete chamado, canDelete na view; comment.service e activity.service specs atualizados p/ os novos deps) + e2e activities 51✓ (+12: allowlist 400, escopo 404, upload atividade pdf/imagem, detalhe embute attachments, upload comentário, comments embute attachments, admin delete, autor-comentário delete, criador-DRAFT delete, soft delete some do detalhe); adm unit 141✓ (+27: attachments.ts validação cliente, AttachmentItem botão condicional + link download, AttachmentUploader barra tipo/tamanho, CommentItem embute anexos) + tsc -b✓ + build✓ + Playwright activities 17✓ (+1: anexa pdf na atividade pelo modal e exclui); ops unit 49✓ (+18: attachments.ts) + tsc --noEmit✓ — commit: bb1ff51 — merge: 2a9fdda — 2026-06-20 — sem bloqueio. Migration ActivityAttachments1783900000000 (tabela activity_attachments: activity_id NOT NULL + comment_id nullable + FKs CASCADE/RESTRICT + índices). Endpoints novos: POST /activities/:id/attachments, POST /activities/:id/comments/:commentId/attachments, DELETE /activities/:id/attachments/:attachmentId (postman atualizado). Allowlist: imagens (jpeg/png/gif/webp) + pdf/doc/docx/xls/xlsx; limite 20 MB; SEM áudio (é a 74, que estende essa allowlist). Storage tratado nos testes via o StorageService já existente (S3 com fallback local) — em ambiente de teste sem credencial S3 grava em uploads/activities/ local, exatamente como as demais features de anexo (registration-files story 68, message); nenhum bucket real chamado, nenhuma chave inventada. Sem PENDENTE-MANUAL: o upload/download é testável localmente sem credencial; só uma futura ativação de S3 de produção exigiria as envs AWS_* (já existentes/compartilhadas com as outras features).

[OK] 74 — testes: api unit 647✓ (+11: activity-attachment.service aceita audio/webm|mp4|m4a|aac|mpeg|ogg|wav → type=audio, persiste durationSeconds arredondada, ignora duração de não-áudio e valores inválidos; comment.service aceita body ausente → string vazia) + e2e activities 53✓ (+3: upload de áudio com durationSeconds, mimetype de áudio fora da allowlist 400, comentário só-de-áudio body vazio + anexo de áudio; teste antigo "POST 400 com body vazio" reescrito p/ a nova regra) ; adm unit 163✓ (+ attachments.ts: allowlist com áudio, isAudioMimetype, validateAudioDuration, formatDuration, readAudioDuration; AudioPlayer: play/pause + ciclo 1x→1.5x→2x→1x ajusta playbackRate; AttachmentItem renderiza player p/ áudio) + tsc -b✓ + build✓ + Playwright activities 18✓ (+1: anexa áudio por upload, mostra player com botões Reproduzir/Velocidade, exclui) ; ops unit 67✓ (+ attachments.ts áudio: allowlist, isAudioMimetype, validateAudioDuration, formatDuration) + tsc --noEmit✓ — commit: 21db17e — merge: 481823e — 2026-06-21 — sem bloqueio. Estende a infra de anexos da 73 (NÃO cria modelo novo). Migration aditiva ActivityAttachmentDuration1784000000000 (activity_attachments.duration_seconds INTEGER nullable; client envia, backend não decodifica áudio). Allowlist do controller estendida com audio/webm, audio/mp4, audio/m4a, audio/aac, audio/mpeg, audio/ogg, audio/wav; attachmentTypeFromMimetype deriva 'audio'. Limite 20 MB (igual 73); duração máx 2 min validada NO CLIENTE (gravação auto-stop em 2:00; upload lê metadados e rejeita >2min). Comentário só-de-áudio = comentário com body vazio (DTO relaxado p/ body opcional, service normaliza p/ '') + 1 anexo de áudio. adm: AudioRecorder (MediaRecorder, output audio/webm) + AudioPlayer (<audio> + playbackRate). ops: AudioRecorder (expo-av Recording, audio/m4a, auto-stop 2:00) + AudioPlayer (expo-av Sound + setRateAsync) + pick de áudio via expo-document-picker. types: ActivityAttachmentType += 'audio', ActivityAttachment.durationSeconds, CreateActivityCommentInput.body opcional (build:types + build:api-client refeitos). Postman atualizado (allowlist de áudio, campo durationSeconds, body de comentário opcional). Storage testável local em uploads/activities/ via o StorageService da 73 — nenhum bucket real, nenhuma chave inventada; sem PENDENTE-MANUAL. Nota: 6 testes pré-existentes do payables.e2e (overdue sensível à data 2026-06-21) falham na main limpa também — não relacionados à 74.

## Resumo final da rodada 64–75 (CONCLUÍDA 2026-06-21)

**Todas as 12 stories mergeadas na main** (`--no-ff`, sem push; branches preservadas). 10 [OK] +
2 [PARCIAL] (69, 70 — lógica completa e testada com mock; só falta credencial externa).
Loop `/loop` (cron d4502925) encerrado.

- **Atividades** (track): 64 visual responsável, 65 comentários, 66 histórico, 71 descrição fora
  do board, 72 WYSIWYG markdown, 73 anexos, 74 áudio, 75 devolver REQUESTED→DRAFT — todas [OK].
- **Eventos** (track): 67 toggle inscrição, 68 campos custom [OK]; 69 pagamento backend, 70
  pagamento portal+notificações [PARCIAL].

Migrations novas da rodada: ActivityComments(1783400000000), ActivityEvents(1783500000000),
EventRegistrationEnabled(**1783600000000** — corrigida de 1783000000000, que rodava antes da tabela
events e colidia com PayableAttachment; agora idempotente), EventRegistrationFields(1783700000000),
EventPayments(1783800000000), ActivityAttachments(1783900000000),
ActivityAttachmentDuration(1784000000000). Próxima migration livre: ≥ 1784100000000.

### PENDENTE-MANUAL (necessário p/ ativar 69 e 70 em produção)
- **69**: `PAGARME_SECRET_KEY` de produção + registrar webhook no painel Pagar.me.
- **70**: aprovar template WhatsApp na Meta (`META_WA_TEMPLATE_EVENT_PAYMENT`); credenciais
  `RESEND_API_KEY`+`MAIL_FROM` e `META_WA_PHONE_NUMBER_ID`/`META_WA_TOKEN`; definir `PORTAL_URL`.

### Dívida técnica observada (fora do escopo desta rodada)
- `payables.e2e-spec.ts`: 6 testes falham por dependência de data (cálculo de `overdue` vs data de
  hoje). Confirmado falhando na main limpa, sem relação com as stories desta rodada. Vale uma story
  de correção (mockar a data/clock no teste).

### Reproduzir
Bootstrap: `pnpm docker:up && pnpm test:setup && pnpm build:types && pnpm build:api-client`, depois
`pnpm dev:api:test` (3001) e `pnpm --filter adm.fonte dev:test` (5174). Suíte por área conforme
cada linha do Log acima.
