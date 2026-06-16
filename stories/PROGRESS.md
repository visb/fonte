# PROGRESS — Execução autônoma das stories 12–19

Estado da execução conduzida por `AUTORUN.md`. Fonte de verdade: este arquivo + `git log` da branch `docs/stories-alteracoes-lote`.

## Legenda

`[OK]` story implementada, testes verdes, commitada · `[BLOQUEADO]` parcial/impedida (ver motivo) · `[ ]` pendente

## Fila

| Ordem | Story | Status | Testes | Commit |
| --- | --- | --- | --- | --- |
| 1 | 18 — redirect pós-acolhimento (visão geral) | [OK] | adm 21✓ | b5e5943 |
| 2 | 13 — acolhimento: familiares opcional | [OK] | adm 23✓ | b8e6962 |
| 3 | 14 — acolhimento: documentos opcional | [OK] | adm 24✓ + api e2e | 892b141 |
| 4 | 12 — select perde valor ao montar form | [OK] | adm 4✓ | d215d60 |
| 5 | 16 — rolagem vertical em modais | [OK] | adm 1✓ | b117362 |
| 6 | 17 — confirmação completa import IA | [OK] | adm 27✓ | 04a2d5b |
| 7 | 15 — pagamento modalidade/valor + relatório | [OK] | api 61✓ + e2e 9✓ + adm 1✓ | fee4d24 |
| 8 | 19 — sistema de notificações (adm+ops, WS) | [OK]* | api 251✓ + e2e 113✓ + adm 2✓ (suite 78✓) · ops Maestro bloqueado (infra) | 10a95a8 |

## Log

<!-- anexar uma linha por story concluída/bloqueada:
[OK|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp>
-->

[OK] 18 — testes: pnpm test:adm residents.spec.ts 21 passed — commit: b5e5943 — 2026-06-05
[OK] 13 — testes: residents.spec.ts 23 passed — commit: b8e6962 — 2026-06-05
[OK] 14 — testes: residents.spec.ts 24 passed + api e2e residents (sem docs) — commit: 892b141 — 2026-06-05
[OK] 12 — testes: staff/residents/support-groups specs 4 passed (regressão confirmada) — commit: d215d60 — 2026-06-05
[OK] 16 — testes: houses.spec.ts scroll 1 passed — commit: b117362 — 2026-06-05
[OK] 17 — testes: residents.spec.ts 27 passed — commit: 04a2d5b — 2026-06-05
[OK] 15 — testes: api unit 61 + e2e 9 + adm 1 passed; migration ReceivablePaidAmountModality (hot-reload, sem restart) — commit: fee4d24 — 2026-06-05
[OK]* 19 — testes: api unit 251 + e2e 113 (inclui notification service/scheduler/gateway + resident-receivable PAYMENT_REGISTERED) + adm Playwright notifications 2 (suite total 78) verdes. ops Maestro BLOQUEADO por infra (build nativo Expo/Gradle falha em ExpoModulesCorePlugin.gradle:95 — `Could not get unknown property 'release'`; não é bug da feature de notificações). Migration 1781500000000-Notifications aplicada. Realtime WS commitado mesmo sem confirmar suporte WS em prod (AUTORUN §special-case) — risco §7b registrado no commit. — commit: 10a95a8 — 2026-06-05

## Resumo final

8/8 stories implementadas e commitadas na branch `docs/stories-alteracoes-lote` (sem push, sem PR — revisar e subir manualmente). 7 stories 100% verdes. Story 19 verde em backend+adm; ops e2e (Maestro) bloqueado só por infra de build nativo do Expo no emulador (feature de notificações no ops está implementada e tipa limpo, mas não foi possível rodar o fluxo Maestro).

## Sessão de re-validação (2026-06-06)

Re-rodada completa após reinício de máquina + investigação do app ops. Resultado dos testes (todos verdes, código commitado):

- **Backend unit** (`pnpm test:api`): **251 passed** (24 suites) — inclui notification service/scheduler.
- **Backend e2e** (`pnpm test:api:e2e`): **113 passed** (12 suites) — inclui `notifications.e2e` + `notifications-gateway.e2e` (socket.io) + `resident-receivable` PAYMENT_REGISTERED.
- **adm Playwright** (suite completa): **78 passed** — todas as stories adm (12,13,14,16,17,18) + notifications.
- **API NestJS**: sobe limpa (`Nest application successfully started`).

> Importante: a API e o adm exigem `pnpm build:types && pnpm build:api-client` antes de subir/testar. Sem o `dist/` de `@fonte/api-client`, o Vite do adm quebra (`Failed to resolve entry for package "@fonte/api-client"`) e TODA a suíte adm falha — não é regressão de código.

### ops Maestro — BLOQUEADO (infra de build nativo, pré-existente, não é a feature)

Investigação profunda do porquê o app ops não roda como **release APK** no emulador. Causas encadeadas encontradas (todas de config/versão do RN/Expo, anteriores às stories de hoje):

1. **NativeWind × New Architecture** — `newArchEnabled: true` (ligado no commit `2f38925` "Railway Object Storage") faz o NativeWind 4.x **não aplicar `className`** sob Fabric/bridgeless → app sobe sem nenhum estilo. Sintoma: warnings `Component property map contains multiple entries for 'borderColor'`. Já está `false` no estado commitado atual.
2. **Compose/Kotlin** — `expo-modules-core` exige Kotlin **1.9.25** (Compose Compiler 1.5.15); default do RN 0.76 é 1.9.24 → `compileReleaseKotlin` falha. Fix documentado: plugin `expo-build-properties` com `android.kotlinVersion: 1.9.25` no `app.json` (atualmente **ausente** do `app.json` commitado).
3. **Entry resolution em monorepo** — no bundle de release o `.env` não carrega, então `EXPO_NO_METRO_WORKSPACE_ROOT=1` não vale → metro tenta resolver `expo-router/entry` a partir da raiz do workspace e falha. Workaround: exportar `EXPO_NO_METRO_WORKSPACE_ROOT=1` e `NODE_ENV=production` no shell do build. Ver memória `project_ops_local_android_build`.
4. **AppRegistry não registra (old arch)** — mesmo com (1)-(3) resolvidos e `newArchEnabled: false`, o release Hermes sobe com `Invariant Violation: Failed to call AppRegistry.runApplication() ... Registered callable JavaScript modules (n = 0)`. Esse é o bloqueio de fundo: em old-arch + release, o app não se registra (provável incompat expo-router + old-arch + Hermes neste monorepo). **Não resolvido.**

Recomendação: rodar o ops Maestro contra um **debug build conectado ao Metro** (modo dev, que é como o app roda hoje), não como release APK standalone. O fluxo `apps/ops.fonte/e2e/notifications.yaml` em si está pronto; só falta um app que suba.

> Nota: as cores/estilos confirmados presentes no bundle; o sino+badge no `WelcomeHeader`, `NotificationsSheet` e hooks do ops tipam limpo (`tsc --noEmit`). A feature ops está implementada — falta apenas a infra de build/execução para o e2e mobile.

### WebSocket em prod (story 19 §7b)
Confirmar que o proxy reverso/PaaS de produção permite upgrade WebSocket no mesmo host:porta para o namespace `/notifications`; o gateway está com CORS `origin: '*'` — restringir antes do rollout.

### Incidente de ambiente (resolvido, sem perda)
Durante a investigação, um `robocopy /MIR` sobre `node_modules` seguiu os symlinks de workspace do pnpm e apagou 786 arquivos-fonte rastreados (apps/packages). **Todos restaurados via `git checkout -- .`** (estavam no git) — nenhuma perda. Aprendizado registrado em memória: nunca usar `robocopy /MIR`/delete recursivo sobre `node_modules` com `nodeLinker: hoisted` (symlinks apontam para o código-fonte).

### Como reproduzir (serviços já no ar nesta máquina)
```
pnpm docker:up
pnpm test:setup
pnpm build:types && pnpm build:api-client   # OBRIGATÓRIO antes de subir API/adm
pnpm dev:api:test                       # :3001 (NODE_ENV=test)
pnpm --filter adm.fonte dev:test        # :5174
pnpm test:api                           # unit backend (251)
pnpm test:api:e2e                       # e2e backend (113)
cd apps/adm.fonte && pnpm exec playwright test   # adm (78)
```
Serviços deixados de pé: API teste :3001, adm teste :5174, emulador Test_Emulator (emulator-5554).

---

# PROGRESS — Execução autônoma das stories 21–25 (editor de templates + code quality)

Estado da execução conduzida por `AUTORUN.md`. Fonte de verdade: esta seção + `git log` da branch `feat/template-editor-melhorias` (21–24) e `chore/code-quality` (25). Ordem: `23 → 22 → 21 → 24 → 25`.

## Fila

| Ordem | Story | Status | Testes | Commit |
| --- | --- | --- | --- | --- |
| 1 | 23 — fonte padrão sincronizada (px→pt) | [OK] | adm e2e 1✓ + api 6✓ + tsc | 79eef59 |
| 2 | 22 — imagem sem tratamento | [OK] | api 7✓ + adm e2e 2✓ + tsc | fad4c09 |
| 3 | 21 — tabelas/colunas | [OK] | adm e2e 4✓ + api 7✓ + tsc | 023eb44 |
| 4 | 24 — preview A4 + paginação | [OK] | adm e2e 6✓ + api 8✓ (suite 308✓) + build adm | dcd7921 |
| 5 | 25 — code quality review frontends | [OK] | adm build+tsc✓ + ops/app tsc✓ + adm playwright 43✓ | 26a7a04 (6 lotes) |

## Log

<!-- [OK|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp> -->

[OK] 23 — testes: adm e2e document-templates.spec 1 passed + api document-template.service 6 passed + tsc -b limpo; base do editor e do PDF unificadas em 12pt; `nextFontPt` extraída pura. Ponto manual: migração visual de templates já salvos (+~60% base) é verificação pós-deploy. — commit: 79eef59 — 2026-06-09
[OK] 22 — testes: api document-template 7 passed (1 novo: upload repassa buffer/mimetype intactos) + adm e2e document-templates 2 passed (23+22) + tsc limpo. Confirmado: sem sharp/resize no upload; "tratamento" era display sem width/height — agora grava dimensões naturais no nó. Postman intacto. — commit: fad4c09 — 2026-06-09
[OK] 21 — testes: adm e2e document-templates 4 passed (2 novos: tabela 2×2 persiste, "2 colunas" salva class) + api 7 passed + tsc -b limpo. Dep `@tiptap/extension-table@3.22.5` (exata, casa core/react/starter-kit 3.22.5; v3 é pacote único). `DocTableView extends TableView` espelha class na tabela viva (TableView ignora class/HTMLAttributes). CSS de tabela espelhado editor↔PDF. — commit: 023eb44 — 2026-06-09
[OK] 24 — testes: adm e2e document-templates 6 passed (2 novos: editor dentro de `.a4-page` largura 794px / conteúdo curto 1 página; conteúdo longo >1 folha mostra guia de quebra) + api document-template 8 passed (1 novo: PDF injeta `DOCUMENT_PRINT_CSS`), suite api 308 passed + build adm prod OK + tsc -b limpo. CONSOLIDAÇÃO: criado `packages/doc-styles` (`DOCUMENT_PRINT_CSS` + geometria A4 + `EDITOR_PAGE_CSS`), consumido por adm.fonte E api 1:1 — removida a duplicação de CSS de print do `document-template.service.ts` (wrapPage) e do `index.css` (.ProseMirror). Preserva tabela (21), base 12pt (23), guarda de imagem (22). Geometria: puppeteer `margin:0`, margem da página = `padding:48px 40px` do body (altura útil 1027px), A4 794×1123. PAGINAÇÃO: **MVP visual** (guias de quebra via `repeating-linear-gradient` calibradas à mesma geometria do PDF) — NÃO usei extensão TipTap de paginação. Motivo: `tiptap-pagination-plus`/`tiptap-extension-pagination` mediriam altura no DOM de forma independente (não garante casar com o flow do puppeteer) e conflitam com os NodeViews custom (imagem/tabela); guias desenhadas a partir das constantes compartilhadas são determinísticas e batem com o PDF (DoD). Subcomponente `A4EditorFrame` extraído (régua de zoom 50/75/100% + folha A4 + guias), TemplateEditor não inflou. Postman intacto (sem mudança de endpoint). — commit: dcd7921 — 2026-06-09

## Bootstrap (2026-06-09)

Serviços no ar: docker postgres, db teste seedado, `build:types`+`build:api-client` ok, API teste :3001 (404 root = ok), adm teste :5174 (200).

## Story 25 — Code quality review (frontends) — branch `chore/code-quality` (2026-06-09)

Review + correção em lotes coesos. SÓ qualidade, sem mudar comportamento. Commits parciais, sem merge/PR.

### Lotes feitos (commit por lote)

- `refactor(adm-residents): centraliza query key de billing.filhos` — query key literal `['billing','filhos']` na invalidação de receivables → `queryKeys.billing.filhos.all`. (ad146c8)
- `refactor(adm): move helper de masks para lib compartilhada` — `features/residents/lib/masks.ts` (helper puro CPF/RG/telefone) consumido cross-slice por auth/staff/components/shared → `src/lib/masks.ts`; 9 imports atualizados. (a9e087d)
- `refactor(ops-messages): centraliza query key de house-relatives` — literal `['house-relatives-messages']` → `queryKeys.messages.houseRelatives`. (ca09ae9)
- `refactor(ops): sobe WheelDatePickerModal para components compartilhado` — wheel date picker vivia em `features/storeroom/components` e era importado por supply-room (cross-slice). Movido para `components/WheelDatePickerModal.tsx` (renomeado p/ não colidir com o `DatePickerModal` compartilhado de API diferente). (5a6a90b)
- `refactor(ops): dedup helpers de estoque em lib/inventoryUtils` — `toNumber/formatQuantity/formatDateBR/toISODate/movementLabel` duplicados idênticos em storeroom/utils e supply-room/utils → `lib/inventoryUtils.ts`; ambos re-exportam (import paths preservados). (edddb13)

### Validação rodada

- adm.fonte: `tsc -b` limpo + `pnpm build` (vite) verde.
- ops.fonte: `tsc --noEmit` limpo (após cada lote).
- app.fonte: `tsc --noEmit` limpo (auditado; nenhum gap de alto sinal — sem query-key literal, sem fetch em page, sem `as any` evitável).

### Pendente para 2º passe (registrado, NÃO bloqueio — refactors de médio risco que poderiam mudar comportamento)

- **adm.fonte — `useForm` em pages** (8 pages: Login, ChangePassword, Profile, EditResident, NewStaff, EditStaff, ChildAppSettings, AdmissionWizard). CLAUDE.md desaconselha `useForm` direto em page. São form-pages pequenas (<150 linhas) e coesas onde o form É o conteúdo da page; extrair p/ hook é churn de médio risco (ex.: LoginPage tem efeito de decode de token no submit). Decisão: deixar; revisitar com cuidado caso a caso. **Não aplicado para não arriscar comportamento.**
- **ops.fonte — `useForm` em pages** (5 pages: incidents/NewIncident, street-sales/New+Edit, storeroom/Movement, supply-room/Movement). Mesma natureza.
- **adm.fonte — `TemplateEditor.tsx` (774 linhas) + 1 `any`** (`ResizableImageNodeView({...}: any)`, já com eslint-disable deliberado). Vem das stories 21–24 (editor de templates). Quebrar o NodeView de imagem redimensionável e tipar via `NodeViewProps` do tiptap é refactor de médio risco do recém-entregue; o `A4EditorFrame` já foi extraído na story 24. Deixado para passe focado.
- **ops.fonte — modais/forms grandes** (`AddResidentModal` 354, `RemoveResidentModal` 209, `CreateMinistryModal` 208, `MessageInput` 213, etc.). Quebra em subcomponentes RN é médio risco (lifting de estado); priorizado deixar build verde.
- **app.fonte — `MessageInput.tsx` (248 linhas)**. Único arquivo grande do app; extração de subcomponentes pendente.
- **ops.fonte — 2× `as any` em `router.push(... as any)`** (MinistryCard, MeetingCard): cast de typed-route do expo-router, baixo valor.

### Não aplicado por exigir mudança de comportamento

- Nenhum gap exigiu mudança de comportamento entre os lotes aplicados (todos preservam saída idêntica das telas).

---

## Resumo final 21–25 (2026-06-09, execução autônoma AUTORUN)

5/5 stories implementadas, testadas (verde) e commitadas. Sem push, sem PR — revisar e subir manualmente.

| Story | Branch | Commit | Validação |
|---|---|---|---|
| 23 — fonte padrão px→pt | `feat/template-editor-melhorias` | 79eef59 | adm e2e 1✓ + api 6✓ + tsc |
| 22 — imagem sem tratamento | `feat/template-editor-melhorias` | fad4c09 | api 7✓ + adm e2e 2✓ + tsc |
| 21 — tabelas/colunas | `feat/template-editor-melhorias` | 023eb44 | adm e2e 4✓ + api 7✓ + tsc |
| 24 — preview A4 + paginação | `feat/template-editor-melhorias` | dcd7921 | adm e2e 6✓ + api 308✓ + build adm |
| 25 — code quality | `chore/code-quality` | ad146c8→26a7a04 (6 lotes) | adm build+tsc + ops/app tsc + playwright 43✓ |

**Branches:** 21–24 em `feat/template-editor-melhorias`; 25 (6 commits parciais) em `chore/code-quality` (criada a partir da anterior). Nenhum merge com main.

**Destaques técnicos:**
- Story 24 criou `packages/doc-styles` consolidando o CSS de impressão (antes duplicado em `document-template.service.ts` + `index.css`); editor e PDF agora consomem `DOCUMENT_PRINT_CSS`/`EDITOR_PAGE_CSS` 1:1. Paginação = MVP visual (guias calibradas à geometria A4 do puppeteer), nenhuma extensão TipTap de paginação adotada (não casavam com o flow do PDF).
- Story 21 adicionou `@tiptap/extension-table@3.22.5` (casado ao core) + `DocTableView` para a classe da tabela bater editor↔PDF.

**Pendências registradas (NÃO bloqueios):**
- Story 23: migração visual de templates já salvos (base +~60% 10px→12pt) = verificação manual pós-deploy, sem migration de dados.
- Story 25: itens de médio risco deixados p/ 2º passe (useForm em pages adm+ops, TemplateEditor 774 linhas + 1 `any`, modais grandes ops/app, 2× `as any` em router.push). Ver lista acima.

**Reproduzir (serviços ficaram de pé):**
```
pnpm docker:up && pnpm test:setup
pnpm build:types && pnpm build:api-client   # OBRIGATÓRIO antes de subir API/adm
pnpm dev:api:test                            # :3001
pnpm --filter adm.fonte dev:test             # :5174
pnpm --filter api test                       # api unit (308)
cd apps/adm.fonte && pnpm exec playwright test document-templates.spec.ts   # 6
```
Serviços no ar ao fim: API teste :3001, adm teste :5174, docker postgres.

---

# PROGRESS — stories 33-40

Epic 33 (Notas do curso bíblico) e filhas. Fonte de verdade: esta seção + `git log` de `main`.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 34 — catálogo de módulos do curso bíblico | [OK] | api unit 318✓ (16 bible-course) + api e2e 16✓ (CRUD módulo + guard ADMIN 403) + adm build/tsc✓ | fdb0219 | 34ce159 |
| 2 | 35 — lançamento de notas por módulo | [OK] | api unit 329✓ (+11 grades) + api e2e 22✓ (+6 grades, guard ADMIN 403) + adm Playwright bible-courses 10✓ + adm build/tsc✓ | 912bd79 | 5d8b569 |
| 3 | 37 — backend associate + CRUD adm | [OK] | api unit 340✓ + api e2e 16✓ + adm Playwright 5✓ | 34d9d29 | add83e1 |
| 4 | 38 — integração AbacatePay (cartão recorrente + gross-up + webhook) | [OK] | api unit 365✓ (+25) + api e2e 180✓ (+7) | 8ff5f31 | cecbae7 |

## Log

[OK] 34 — testes: api unit 318 passed (6 novos no bible-course.service: lista ordenada, create default sequence, update/remove NotFound, soft delete) — api e2e bible-courses 16 passed (CRUD de módulo via HTTP + guard ADMIN: coordinator recebe 403 em GET/POST/DELETE, ADMIN autoriza) — adm `pnpm --filter adm.fonte build` verde (tsc -b + vite). adm Playwright bible-courses.spec (3 testes novos de módulo) NÃO rodou: o servidor de teste `dev:api:test` em :3001 está com build ANTIGO (anterior à story 31), responde 404 em `POST /auth/login` (espera `identifier`), o que faz TODA a suíte adm bible-courses falhar já no helper `login` — inclusive os testes de turma pré-existentes (não é regressão da story 34). Backend e2e (compilado do fonte atual) cobre integralmente o guard ADMIN. Migration: 1782300000000-BibleCourseModules (aplicada no db de teste via migration:run:test). Decisão UX: catálogo numa rota ADMIN `/bible-courses/modules`, acessível por botão "Módulos" (visível só p/ ADMIN) na BibleCoursesPage. Rota usa prefixo do controller existente `bible-course/modules` (não `bible-courses/modules` do plano) por consistência com classes/enrollments já existentes. Sem regra de unicidade de nome (plano marcava como opcional/confirmar). — commit: fdb0219 — merge: 34ce159 — 2026-06-15

[OK] 35 — testes: api unit 329 passed (+11 novos no bible-course.service: `average` ignora nulos/arredonda 2 casas, `upsertGrade` cria/edita sem duplicar + limpa nota com null + NotFound matrícula/módulo, `getClassGrades` monta matriz com média por módulo e do aluno ignorando vazios + NotFound turma) — api e2e bible-courses 22 passed (+6 novos: guard ADMIN 403 em GET grades e PUT grade p/ coordinator, 400 nota fora de 0–10, ADMIN lança prova criando a linha, edita a MESMA linha sem duplicar + adiciona trabalho, lê a matriz com médias calculadas (9)) — adm Playwright bible-courses.spec 10 passed (inclui o novo "lança nota numa turma com filho e módulo e vê a média": cria módulo+turma, matricula, abre aba Notas, digita prova 8 no blur e confirma média 8,0). adm `pnpm --filter adm.fonte build` verde (tsc -b + vite). Diferente da story 34, a suíte adm RODOU: o `dev:api:test` em :3001 está com código atual (login por `identifier` funciona). Migration: 1782400000000-BibleCourseGrades (tabela bible_course_grades, UNIQUE enrollment_id+module_id, FKs ON DELETE CASCADE p/ enrollment e module; aplicada no db de teste via migration:run:test). Endpoints (ADMIN only, prefixo `bible-course` p/ consistência): `GET bible-course/classes/:classId/grades` (matriz) + `PUT bible-course/enrollments/:enrollmentId/grades/:moduleId` (upsert idempotente). DTO `UpsertGradeDto` valida 0–10 (numeric 2 casas), aceita null p/ limpar. UX: aba "Notas" na BibleClassDetailPage (tabela filhos×módulos, célula prova/trabalho com autosave no blur + validação zod 0–10, média por módulo e do aluno). Tipos em @fonte/types e api-client (BibleClassGrades / UpsertBibleGradeInput). Postman atualizado (Get Class Grades + Upsert Grade). — commit: 912bd79 — merge: 5d8b569 — 2026-06-16

[OK] 37 — testes: api unit 340 passed (11 novos no associate.service: create gera payment_token uuid + status PENDING, persiste campos, email null quando omitido, view com numeric coerced; findAll com lastCharge; findOne detalhe + NotFound; update parcial + NotFound; soft delete + NotFound) — api e2e associates 16 passed (guard: 401 sem token, 403 p/ coordinator em POST/GET; validação 400 whatsapp não-E.164/contributionAmount<=0/dueDay>31/email inválido/body vazio; CRUD: create PENDING+token, sem email, list com lastCharge, get detalhe subscription+charges, 404, update, soft delete→404) — suite e2e total 173 passed (também corrigi login `identifier` nos specs street-sale e promote-to-servant, que estavam quebrados desde a story 31 — pré-existente, não regressão) — adm Playwright associates.spec 5 passed (link no submenu, valida E.164, cria com status Pendente, edita, exclui) + `pnpm --filter adm.fonte build` verde (tsc -b + vite). Migration: 1782500000000-Associates (4 tabelas do epic 36: associates, associate_subscriptions, associate_charges, associate_charge_notifications; só o cadastro ganha comportamento; numeric(10,2), uuid, soft delete; aplicada no db de teste via migration:run:test). Endpoints ADMIN: POST/GET/GET :id/PATCH/DELETE /associates. Tipos em @fonte/types + recurso `associates` no @fonte/api-client. Feature adm.fonte `associates` (vertical slice MVVM): hooks useAssociates/useAssociateById/useCreate/useUpdate/useDelete (query keys em lib/queryKeys), AssociatesPage (tabela), AssociateRow, AssociateForm rhf+zod, Create/Edit dialogs autossuficientes, AssociateStatusBadge. Rota /billing/associados e item de menu agora ADMIN-only (substituem o placeholder AssociadosPage). Postman atualizado (seção Associates). — commit: 34d9d29 — merge: add83e1 — 2026-06-16

[OK] 38 — PREMISSA BLOQUEANTE CONFIRMADA: AbacatePay SUPORTA cartão de crédito + assinatura/recorrência mensal + webhooks de eventos. Doc oficial: https://docs.abacatepay.com (welcome, /pages/subscriptions/create, /pages/customers/create, /pages/webhooks/reference) + https://www.abacatepay.com/assinaturas (ciclos semanal/mensal/semestral/anual) + https://www.abacatepay.com/llms.txt. Taxa de cartão = 3,5% + R$ 0,60 (mesma do pagamento único), usada como default do gross-up. API v2 base https://api.abacatepay.com/v2; auth Bearer ABACATEPAY_API_KEY. Eventos relevantes: subscription.completed/.renewed/checkout.completed (paga), subscription.cancelled (cancelada). — IMPLEMENTADO: computeGrossUp puro (gross=round2((net+f)/(1-p)), fee=gross-net) com taxas via env ABACATEPAY_CARD_FEE_PCT/FIXED; AbacatePayClient atrás de interface (token ABACATEPAY_CLIENT) + impl HTTP v2 (HttpAbacatePayClient: createCustomer/createSubscription/cancelSubscription) encapsulada no módulo; AssociatePaymentService (subscribe: gross-up → reusa/cria customer → cria assinatura → persiste subscription ACTIVE + 1ª charge PENDING; getPublicView sem dados sensíveis); endpoints PÚBLICOS (sem JWT, por payment_token, ThrottlerGuard) GET /public/associates/:token e POST /public/associates/:token/subscribe; webhook POST /webhooks/abacatepay (valida ?webhookSecret= vs ABACATEPAY_WEBHOOK_SECRET; idempotente por abacatepay_charge_id; transições paga→PAID+ACTIVE, falhou→FAILED+PAST_DUE, cancelada→CANCELED); migration 1782600000000 (índice único parcial em associate_charges.abacatepay_charge_id WHERE NOT NULL p/ idempotência no nível do banco); tipos públicos em @fonte/types (AssociatePublicView/SubscribeInput/SubscribeResult) + recurso público no @fonte/api-client (associates.public.getByToken/subscribe) p/ a story 40; Postman atualizado (Public Get/Subscribe + Webhook). Testes: api unit 365 passed (computeGrossUp casos de borda/arredondamento/erro; subscribe com client MOCKADO cria charge PENDING + gross-up correto + reuso de customer + 409 se já ativo; webhook idempotente + transições + verifySecret) + api e2e 180 passed (GET público token válido/inválido, subscribe com gateway mockado via overrideProvider, webhook 401 secret errado / PAID+ACTIVE idempotente / CANCELED). Gateway SEMPRE mockado — a API real do AbacatePay NUNCA é chamada (não há chave configurada). PENDENTE DE CREDENCIAL/MANUAL (não bloqueia o código): (1) validação em sandbox AbacatePay com cartão de teste — exige ABACATEPAY_API_KEY real; (2) confirmar na sandbox o formato EXATO do payload de webhook (nomes de campos data.chargeId/subscriptionId/externalId são tolerantes/genéricos no handler) e se a v2 usa assinatura HMAC em header em vez de ?webhookSecret= (TODO marcado no service) — ajustar verifySecret/parse após o teste real; (3) confirmar o contrato exato de POST /subscriptions/create p/ cartão recorrente (a doc pública descreve o fluxo de checkout hosted; a impl envia customerId/cardToken/amount-em-centavos/dueDay/externalId e lê data.id/url/charge.id — revisar contra a sandbox); (4) preencher ABACATEPAY_API_KEY/BASE_URL/WEBHOOK_SECRET e confirmar as taxas reais da conta (PCT/FIXED) em produção. — commit: 8ff5f31 — merge: cecbae7 — 2026-06-16

## Fechamento do epic 33 (Notas do curso bíblico)

Epic 33 CONCLUÍDO: filhas 34 (catálogo de módulos) e 35 (lançamento de notas) entregues e mergeadas na main. Fluxo end-to-end funcional: cadastrar módulo no catálogo → matricular filho na turma → lançar prova/trabalho por módulo → ver média do módulo e do aluno. Modelo: `bible_course_modules` (catálogo compartilhado) + `bible_course_grades` (nota por matrícula×módulo, UNIQUE, prova/trabalho numeric(4,2) 0–10, médias calculadas no service). Tudo ADMIN only. Fora de escopo do epic (anotado): avaliações dinâmicas/extras, escala configurável, aprovação/boletim/PDF, lançamento por coordenador/servo, visualização por familiar/interno.
