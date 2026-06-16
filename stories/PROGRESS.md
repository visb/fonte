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
| 5 | 40 — app público associados (página de pagamento) | [PARCIAL] | associados build✓ + lint (tsc -b --noEmit)✓ + adm.fonte build✓ (sem regressão) — tokenização do cartão = stub (sem SDK/chave AbacatePay) | 284d1de | ec5fc86 |
| 6 | 39 — WhatsApp (Meta Cloud API) + scheduler diário 9h | [PARCIAL] | api unit 377✓ (+12 scheduler) + api e2e 184✓ (+4 charge manual) + build:api✓ — envio real Meta bloqueado (sem credencial/template) | 73568c9 | c2cdf8d |

## Log

[OK] 34 — testes: api unit 318 passed (6 novos no bible-course.service: lista ordenada, create default sequence, update/remove NotFound, soft delete) — api e2e bible-courses 16 passed (CRUD de módulo via HTTP + guard ADMIN: coordinator recebe 403 em GET/POST/DELETE, ADMIN autoriza) — adm `pnpm --filter adm.fonte build` verde (tsc -b + vite). adm Playwright bible-courses.spec (3 testes novos de módulo) NÃO rodou: o servidor de teste `dev:api:test` em :3001 está com build ANTIGO (anterior à story 31), responde 404 em `POST /auth/login` (espera `identifier`), o que faz TODA a suíte adm bible-courses falhar já no helper `login` — inclusive os testes de turma pré-existentes (não é regressão da story 34). Backend e2e (compilado do fonte atual) cobre integralmente o guard ADMIN. Migration: 1782300000000-BibleCourseModules (aplicada no db de teste via migration:run:test). Decisão UX: catálogo numa rota ADMIN `/bible-courses/modules`, acessível por botão "Módulos" (visível só p/ ADMIN) na BibleCoursesPage. Rota usa prefixo do controller existente `bible-course/modules` (não `bible-courses/modules` do plano) por consistência com classes/enrollments já existentes. Sem regra de unicidade de nome (plano marcava como opcional/confirmar). — commit: fdb0219 — merge: 34ce159 — 2026-06-15

[OK] 35 — testes: api unit 329 passed (+11 novos no bible-course.service: `average` ignora nulos/arredonda 2 casas, `upsertGrade` cria/edita sem duplicar + limpa nota com null + NotFound matrícula/módulo, `getClassGrades` monta matriz com média por módulo e do aluno ignorando vazios + NotFound turma) — api e2e bible-courses 22 passed (+6 novos: guard ADMIN 403 em GET grades e PUT grade p/ coordinator, 400 nota fora de 0–10, ADMIN lança prova criando a linha, edita a MESMA linha sem duplicar + adiciona trabalho, lê a matriz com médias calculadas (9)) — adm Playwright bible-courses.spec 10 passed (inclui o novo "lança nota numa turma com filho e módulo e vê a média": cria módulo+turma, matricula, abre aba Notas, digita prova 8 no blur e confirma média 8,0). adm `pnpm --filter adm.fonte build` verde (tsc -b + vite). Diferente da story 34, a suíte adm RODOU: o `dev:api:test` em :3001 está com código atual (login por `identifier` funciona). Migration: 1782400000000-BibleCourseGrades (tabela bible_course_grades, UNIQUE enrollment_id+module_id, FKs ON DELETE CASCADE p/ enrollment e module; aplicada no db de teste via migration:run:test). Endpoints (ADMIN only, prefixo `bible-course` p/ consistência): `GET bible-course/classes/:classId/grades` (matriz) + `PUT bible-course/enrollments/:enrollmentId/grades/:moduleId` (upsert idempotente). DTO `UpsertGradeDto` valida 0–10 (numeric 2 casas), aceita null p/ limpar. UX: aba "Notas" na BibleClassDetailPage (tabela filhos×módulos, célula prova/trabalho com autosave no blur + validação zod 0–10, média por módulo e do aluno). Tipos em @fonte/types e api-client (BibleClassGrades / UpsertBibleGradeInput). Postman atualizado (Get Class Grades + Upsert Grade). — commit: 912bd79 — merge: 5d8b569 — 2026-06-16

[OK] 37 — testes: api unit 340 passed (11 novos no associate.service: create gera payment_token uuid + status PENDING, persiste campos, email null quando omitido, view com numeric coerced; findAll com lastCharge; findOne detalhe + NotFound; update parcial + NotFound; soft delete + NotFound) — api e2e associates 16 passed (guard: 401 sem token, 403 p/ coordinator em POST/GET; validação 400 whatsapp não-E.164/contributionAmount<=0/dueDay>31/email inválido/body vazio; CRUD: create PENDING+token, sem email, list com lastCharge, get detalhe subscription+charges, 404, update, soft delete→404) — suite e2e total 173 passed (também corrigi login `identifier` nos specs street-sale e promote-to-servant, que estavam quebrados desde a story 31 — pré-existente, não regressão) — adm Playwright associates.spec 5 passed (link no submenu, valida E.164, cria com status Pendente, edita, exclui) + `pnpm --filter adm.fonte build` verde (tsc -b + vite). Migration: 1782500000000-Associates (4 tabelas do epic 36: associates, associate_subscriptions, associate_charges, associate_charge_notifications; só o cadastro ganha comportamento; numeric(10,2), uuid, soft delete; aplicada no db de teste via migration:run:test). Endpoints ADMIN: POST/GET/GET :id/PATCH/DELETE /associates. Tipos em @fonte/types + recurso `associates` no @fonte/api-client. Feature adm.fonte `associates` (vertical slice MVVM): hooks useAssociates/useAssociateById/useCreate/useUpdate/useDelete (query keys em lib/queryKeys), AssociatesPage (tabela), AssociateRow, AssociateForm rhf+zod, Create/Edit dialogs autossuficientes, AssociateStatusBadge. Rota /billing/associados e item de menu agora ADMIN-only (substituem o placeholder AssociadosPage). Postman atualizado (seção Associates). — commit: 34d9d29 — merge: add83e1 — 2026-06-16

[OK] 38 — PREMISSA BLOQUEANTE CONFIRMADA: AbacatePay SUPORTA cartão de crédito + assinatura/recorrência mensal + webhooks de eventos. Doc oficial: https://docs.abacatepay.com (welcome, /pages/subscriptions/create, /pages/customers/create, /pages/webhooks/reference) + https://www.abacatepay.com/assinaturas (ciclos semanal/mensal/semestral/anual) + https://www.abacatepay.com/llms.txt. Taxa de cartão = 3,5% + R$ 0,60 (mesma do pagamento único), usada como default do gross-up. API v2 base https://api.abacatepay.com/v2; auth Bearer ABACATEPAY_API_KEY. Eventos relevantes: subscription.completed/.renewed/checkout.completed (paga), subscription.cancelled (cancelada). — IMPLEMENTADO: computeGrossUp puro (gross=round2((net+f)/(1-p)), fee=gross-net) com taxas via env ABACATEPAY_CARD_FEE_PCT/FIXED; AbacatePayClient atrás de interface (token ABACATEPAY_CLIENT) + impl HTTP v2 (HttpAbacatePayClient: createCustomer/createSubscription/cancelSubscription) encapsulada no módulo; AssociatePaymentService (subscribe: gross-up → reusa/cria customer → cria assinatura → persiste subscription ACTIVE + 1ª charge PENDING; getPublicView sem dados sensíveis); endpoints PÚBLICOS (sem JWT, por payment_token, ThrottlerGuard) GET /public/associates/:token e POST /public/associates/:token/subscribe; webhook POST /webhooks/abacatepay (valida ?webhookSecret= vs ABACATEPAY_WEBHOOK_SECRET; idempotente por abacatepay_charge_id; transições paga→PAID+ACTIVE, falhou→FAILED+PAST_DUE, cancelada→CANCELED); migration 1782600000000 (índice único parcial em associate_charges.abacatepay_charge_id WHERE NOT NULL p/ idempotência no nível do banco); tipos públicos em @fonte/types (AssociatePublicView/SubscribeInput/SubscribeResult) + recurso público no @fonte/api-client (associates.public.getByToken/subscribe) p/ a story 40; Postman atualizado (Public Get/Subscribe + Webhook). Testes: api unit 365 passed (computeGrossUp casos de borda/arredondamento/erro; subscribe com client MOCKADO cria charge PENDING + gross-up correto + reuso de customer + 409 se já ativo; webhook idempotente + transições + verifySecret) + api e2e 180 passed (GET público token válido/inválido, subscribe com gateway mockado via overrideProvider, webhook 401 secret errado / PAID+ACTIVE idempotente / CANCELED). Gateway SEMPRE mockado — a API real do AbacatePay NUNCA é chamada (não há chave configurada). PENDENTE DE CREDENCIAL/MANUAL (não bloqueia o código): (1) validação em sandbox AbacatePay com cartão de teste — exige ABACATEPAY_API_KEY real; (2) confirmar na sandbox o formato EXATO do payload de webhook (nomes de campos data.chargeId/subscriptionId/externalId são tolerantes/genéricos no handler) e se a v2 usa assinatura HMAC em header em vez de ?webhookSecret= (TODO marcado no service) — ajustar verifySecret/parse após o teste real; (3) confirmar o contrato exato de POST /subscriptions/create p/ cartão recorrente (a doc pública descreve o fluxo de checkout hosted; a impl envia customerId/cardToken/amount-em-centavos/dueDay/externalId e lê data.id/url/charge.id — revisar contra a sandbox); (4) preencher ABACATEPAY_API_KEY/BASE_URL/WEBHOOK_SECRET e confirmar as taxas reais da conta (PCT/FIXED) em produção. — commit: 8ff5f31 — merge: cecbae7 — 2026-06-16

[PARCIAL] 40 — testes: `pnpm --filter associados build` verde (tsc -b + vite, 184 módulos) + lint `tsc -b --noEmit` limpo + `pnpm --filter adm.fonte build` verde (sem regressão em types/api-client). NOVO app `apps/associados` (React + Vite) espelhando a base mínima do adm.fonte (vite/tsconfig/index.html/main/QueryClientProvider/router). Workspace pnpm já cobre `apps/*` (sem mudar pnpm-workspace.yaml); registrei `pnpm install` + scripts raiz `dev:associados` e `build:associados` espelhando `dev:adm`; base da API via `VITE_API_URL`. Página pública (rotas `/p/:token` e `/:token`): consome o checkout público da story 38 via `@fonte/api-client` (`associates.public.getByToken/subscribe`) — sem duplicar HTTP. Fluxo: GET por token → token inválido/expirado mostra tela de erro amigável; válido mostra nome + valor pré-preenchido EDITÁVEL (default `suggestedAmount`) com rhf+zod; `AmountSummary` exibe transparente o gross-up (contribuição + taxa, preview espelhando a fórmula da 38 via `VITE_ABACATEPAY_CARD_FEE_PCT/FIXED`) e deixa claro que é cobrança MENSAL RECORRENTE; submit `POST subscribe { contributionAmount, cardToken }` → tela de confirmação ("contribuição mensal ativada") / erro via `getErrorMessage`; se já tem assinatura ativa, tela "você já contribui". Mobile-first (CSS próprio, max-width 480px, abre pelo WhatsApp). Estados Loading/Error em componentes compartilhados; page fina orquestrando hooks; query keys em lib/queryKeys; sem fetch direto na page. **MOTIVO DO PARCIAL — tokenização do cartão é STUB:** não há SDK/iframe nem chave pública do AbacatePay no ambiente. O ponto de tokenização ficou isolado atrás da interface `CardTokenizer` (`src/lib/cardTokenizer.ts`): em DEV (sem `VITE_ABACATEPAY_PUBLIC_KEY`) devolve um `cardToken` fake (`dev_tok_*`) para deixar UI/fluxo completos; com a chave definida cai em `tokenizeWithGateway`, que tem TODO claro e lança erro até o SDK real ser integrado. PAN nunca trafega pelo nosso backend (PCI/LGPD) — o app só envia o `cardToken`. Badge "modo desenvolvimento" aparece na UI enquanto stub. PENDENTE/MANUAL (não bloqueia o código): integrar o SDK de tokenização do AbacatePay + chave pública e validar o caminho feliz em sandbox com cartão de teste (cruzar com a story 38). E2E Playwright não adicionado (opcional na story; exigiria mock dos endpoints públicos). — commit: 284d1de — merge: ec5fc86 — 2026-06-16

[PARCIAL] 39 — testes: api unit 377 passed (+12 novos no AssociateChargeScheduler: query seleciona só PENDING+PAST_DUE; ADHESION p/ PENDING com due_day vencido; pula PENDING com due_day futuro no mês; REACTIVATION p/ PAST_DUE independente do dia; dedupe 5 dias pula quem já recebeu; janela de dedupe ~5 dias atrás; best-effort não grava log quando envio falha (reenvia na próxima rodada); monta link com payment_token via urlButtonParam; chargeManually envia+loga PENDING, pula inexistente/ACTIVE/já-notificado) + api e2e 184 passed (+4 novos em associates-charge: POST /associates/:id/charge 401 sem token, 403 coordinator, ADMIN cobra PENDING e o 2º call no mesmo período é deduped, associado inexistente {sent:false,skipped:true} — cliente WhatsApp MOCKADO via overrideProvider, Meta nunca chamada) + `pnpm build:api` verde (nest build). IMPLEMENTADO: `WhatsAppClient` atrás de interface (DI token `WHATSAPP_CLIENT`) + impl `MetaWhatsAppClient` (Meta Cloud API, POST graph.facebook.com/<ver>/<phoneId>/messages, Bearer token; env META_WA_PHONE_NUMBER_ID/TOKEN/TEMPLATE_NAME/API_VERSION + APP_ASSOCIADOS_URL; `sendTemplate({toE164,templateName,variables,urlButtonParam})` monta link `<APP_ASSOCIADOS_URL>/p/<payment_token>`; best-effort: sem credencial ou erro de rede/Meta loga e devolve {sent:false}, nunca derruba o job). `AssociateChargeScheduler` `@Cron('0 9 * * *',{name:'associate-charge',timeZone:'America/Sao_Paulo'})`: consulta só PENDING+PAST_DUE (In) não-deletados; gatilho PENDING→ADHESION se due_day≤hoje, PAST_DUE→REACTIVATION sempre, ACTIVE/CANCELED ignorados; dedupe 5 dias via `associate_charge_notifications.exists({sentAt>=now-5d})` espelhando `existsForResidentSince` do notification module; após envio com sucesso grava log (type ADHESION/REACTIVATION, channel WHATSAPP, sent_at); retorna {sent,skipped} e loga. Endpoint manual ADMIN POST /associates/:id/charge (`chargeManually`, mesmo dedupe; ACTIVE/CANCELED/inexistente → skipped). Sem migration nova (tabela `associate_charge_notifications` já criada na story 37). Aproveitado do parcial pré-existente: scheduler, whatsapp.client/types e edição parcial do module já estavam escritos e bem feitos — completei o wiring do module (provider WHATSAPP_CLIENT=MetaWhatsAppClient + AssociateChargeScheduler + AssociateChargeController), corrigi `.exist()`→`.exists()` (TypeORM 0.3.20, padrão do repo), criei o controller manual, o spec unit, o e2e e atualizei .env.example + Postman. — commit: 73568c9 — merge: c2cdf8d — 2026-06-16 — BLOQUEADO: envio real Meta + template aprovado (sem credencial). Sem `META_WA_*` no ambiente, a API real NUNCA é chamada (testes mockam o cliente). MANUAL/PENDENTE (não bloqueia o código): (1) criar e submeter à Meta o template de cobrança com botão de URL dinâmica recebendo o payment_token e anotar o nome aprovado em `META_WA_TEMPLATE_NAME`; (2) preencher `META_WA_PHONE_NUMBER_ID/META_WA_TOKEN/META_WA_API_VERSION` e `APP_ASSOCIADOS_URL`; (3) validar o envio real num número de teste/sandbox da Meta e conferir o formato exato dos `components` (body params × botão url) contra o template aprovado — o handler monta um payload tolerante mas pode precisar de ajuste fino ao template real.

## Fechamento do epic 36 (Cobrança recorrente de associados)

Epic 36 CONCLUÍDO: todas as filhas entregues e mergeadas na main — 37 (backend associate + CRUD adm, [OK] 34d9d29/add83e1), 38 (integração AbacatePay: cartão recorrente + gross-up + webhook, [OK] 8ff5f31/cecbae7), 40 (app público de pagamento, [PARCIAL] 284d1de/ec5fc86) e 39 (WhatsApp Meta + scheduler diário 9h, [PARCIAL] 73568c9/c2cdf8d). Fluxo end-to-end: ADMIN cadastra associado (37) → job das 9h (39) dispara WhatsApp de cobrança ao PENDING vencido/PAST_DUE com link da página pública → associado abre o link no app (40) e assina via AbacatePay (38) → webhook (38) confirma pagamento e move para ACTIVE (gateway passa a cobrar a recorrência sozinho; ACTIVE não recebe mais WhatsApp). Modelo: `associates` + `associate_subscriptions` + `associate_charges` + `associate_charge_notifications` (migrations 1782500000000 e 1782600000000). PENDÊNCIAS DE CREDENCIAL/MANUAL que mantêm 39 e 40 como PARCIAL (não bloqueiam o código, exigem ambiente externo): credencial+template aprovado da **Meta WhatsApp** (39); chave de API + validação em sandbox + contrato exato de webhook do **AbacatePay** (38); **SDK de tokenização de cartão** do AbacatePay + chave pública no app público (40, hoje stub `dev_tok_*`). Gateways e WhatsApp são sempre MOCKADOS nos testes — nenhuma API externa é chamada na suíte.

## Fechamento do epic 33 (Notas do curso bíblico)

Epic 33 CONCLUÍDO: filhas 34 (catálogo de módulos) e 35 (lançamento de notas) entregues e mergeadas na main. Fluxo end-to-end funcional: cadastrar módulo no catálogo → matricular filho na turma → lançar prova/trabalho por módulo → ver média do módulo e do aluno. Modelo: `bible_course_modules` (catálogo compartilhado) + `bible_course_grades` (nota por matrícula×módulo, UNIQUE, prova/trabalho numeric(4,2) 0–10, médias calculadas no service). Tudo ADMIN only. Fora de escopo do epic (anotado): avaliações dinâmicas/extras, escala configurável, aprovação/boletim/PDF, lançamento por coordenador/servo, visualização por familiar/interno.

## Story 41 — trocar gateway de associados para Pagar.me (substitui AbacatePay das stories 38/40)

[OK] 41 — testes: api unit **379 passed** + api e2e **186 passed** (TODA a suíte) + `pnpm --filter associados build` e `pnpm --filter adm.fonte build` verdes + adm Playwright associates.spec **5 passed**. Gateway SEMPRE mockado (sem chave; Pagar.me real nunca chamada). DECISÃO (usuário, 2026-06-16): trocar **AbacatePay → Pagar.me** — o AbacatePay exige produto de preço fixo pré-cadastrado no painel (sem amount arbitrário na API) e usa checkout por redirect sem SDK de tokenização; a Pagar.me tem tokenização client-side + assinatura com valor inline + cancelamento. Doc confirmada: tokenizecard.js / `POST /tokens?appId=<public_key>` (token 60s, PAN não toca backend); `POST /subscriptions` com `items.pricing_scheme.price` (valor inline, sem plano) + `interval:month`; `DELETE /subscriptions/{id}`; webhooks `charge.paid`/`charge.payment_failed`/`subscription.canceled`. IMPLEMENTADO: camada `gateway/` (interface `PaymentGateway` + token DI `PAYMENT_GATEWAY` + impl `HttpPagarmeGateway`, base https://api.pagar.me/core/v5, auth Basic base64(secret:)); valor da assinatura agora **FIXO** (= contribution_amount) — subscribe recebe só `{ cardToken }`; `PagarmeWebhookService`+Controller `POST /webhooks/pagarme` (HTTP Basic via PAGARME_WEBHOOK_USER/PASSWORD; idempotente por gateway_charge_id; paga→PAID+ACTIVE, falhou→FAILED+PAST_DUE, cancelada→CANCELED); endpoint ADMIN `POST /associates/:id/cancel-subscription` (cancela no gateway + CANCELED) + botão "Cancelar recorrência" no adm.fonte (AssociateRow quando ACTIVE|PAST_DUE → AlertDialog → `useCancelAssociateSubscription`). Migration **1782700000000-AssociateGatewayRename** renomeia colunas `abacatepay_*` → `gateway_*` (genéricas) + índice de idempotência (aplicada no db de teste). App `associados`: tokenização REAL Pagar.me (`/tokens?appId=VITE_PAGARME_PUBLIC_KEY`; stub `dev_tok_*` em DEV sem chave) + valor read-only fixo (SubscribeForm sem campo de valor). Removida a camada `abacatepay/`. Tipos (@fonte/types: gatewaySubscriptionId/gatewayChargeId/gatewayCustomerId; `SubscribeInput` só cardToken) + api-client (`cancelSubscription`) + `.env.example` (PAGARME_*) + Postman (subscribe sem amount, "Cancelar recorrência" ADMIN, "Webhook — Pagar.me") atualizados. Atualiza os PARCIAIS das stories 38/40: o gateway agora é Pagar.me e a tokenização do app deixou de ser stub (vira real quando `VITE_PAGARME_PUBLIC_KEY` estiver setada). PENDENTE DE CREDENCIAL/MANUAL (não bloqueia o código): (1) `PAGARME_SECRET_KEY` + validar em sandbox com cartão de teste; confirmar contrato exato de `POST /subscriptions` e payload do webhook; (2) `PAGARME_WEBHOOK_USER/PASSWORD` (Basic configurado no painel); (3) `VITE_PAGARME_PUBLIC_KEY` no app + validar tokenizecard.js no caminho feliz; (4) confirmar taxas reais da conta (`PAGARME_CARD_FEE_PCT/FIXED`) p/ o gross-up. — commit: feat(story-41) — merge: "merge: story 41 — trocar gateway associados para Pagar.me + cancelamento no admin" — 2026-06-16

---

# PROGRESS — stories 44-55

Associados (overview/autocancel/tela), Contas a Pagar, Atividades Kanban e o epic 49 (cobertura de
testes + filhas 50–55). Conduzido por `AUTORUN.md`. Fonte de verdade: esta seção + `git log` de `main`.

## Legenda

`[OK]` story implementada, suíte tocada verde, commitada e mergeada · `[PARCIAL]` código completo mas
parte depende de serviço externo sem credencial (mock nos testes) · `[BLOQUEADO]` impedida (ver motivo)
· `[ ]` pendente

## Fila (ordem: 44 → 46 → 45 → 47 → 48 → 49 → 55 → 51 → 52 → 50 → 53 → 54)

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 44 — overview de faturamento dos associados | [OK] | api unit 384✓ (+5) + api e2e 190✓ (+4) + adm Playwright 7✓ + adm build✓ | 8afc6df | ede1b98 |
| 2 | 46 — melhorias tela associados (detalhe + máscara + scroll infinito) | [OK] | api unit 386✓ + api e2e 193✓ + adm Playwright 11✓ + adm build✓ | 97f440f | 7518568 |
| 3 | 45 — link de autocancelamento no lembrete WhatsApp | [PARCIAL] | api unit 394✓ (+8) + api e2e 197✓ (+4) + associados build✓ + build:api✓ | 850af90 | 1e2b741 |
| 4 | 47 — Contas a Pagar (módulo payable + adm) | [ ] | | | |
| 5 | 48 — Atividades Kanban (backend + adm + ops) | [ ] | | | |
| 6 | 49 — EPIC cobertura de testes (código: skills + scripts; coordena 50–55) | [ ] | | | |
| 7 | 55 — unit tests @fonte/api-client | [ ] | | | |
| 8 | 51 — unit tests adm.fonte (Vitest + RTL) | [ ] | | | |
| 9 | 52 — testes app associados (Vitest + Playwright) | [ ] | | | |
| 10 | 50 — auditoria + gaps de teste services/api | [ ] | | | |
| 11 | 53 — testes ops.fonte (jest-expo + Playwright web) | [ ] | | | |
| 12 | 54 — testes app.fonte (jest-expo + Playwright web) | [ ] | | | |

## Log

<!-- anexar uma linha por story concluída/bloqueada:
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <timestamp> — <bloqueio se houver>
-->

[PARCIAL] 45 — testes: api unit 394 passed (+8: AssociateChargeScheduler streak<2 → template padrão sem botão de cancelar; streak>=2 → template cancelável `cobranca_associado_cancelavel` + cancelUrlButtonParam setado; PAID recente zera o streak (count filtrado por sentAt>=paid_at); AssociatePaymentService.getCancelView/cancelByToken cancela por token, idempotência já-CANCELED sem chamar gateway, token inválido→404) + api e2e 197 passed (+4 em associates-payment: GET/POST /public/associates/:token/cancel-view|cancel com gateway mockado via overrideProvider — cancel-view nome+hasActiveSubscription, cancel idempotente cancela no gateway 1x + CANCELED, 404 token inválido; assinatura seedada via SQL p/ não estourar o throttle 5/min do /subscribe) + `pnpm --filter associados build` (tsc -b + vite, 523 módulos) + `pnpm build:api` (nest build) verdes. IMPLEMENTADO: streak no scheduler (injeta Repository<AssociateCharge>, conta associate_charge_notifications com sent_at após o paid_at da cobrança PAID mais recente; reminderStreak>=2 = 3º+ envio → template cancelável); WhatsAppClient.SendTemplateInput ganha `cancelUrlButtonParam?` + MetaWhatsAppClient monta 2º button sub_type:url index '1' com buildCancelLink(token)=<APP_ASSOCIADOS_URL>/cancelar/:token; config META_WA_TEMPLATE_NAME_CANCELABLE (default cobranca_associado_cancelavel) documentada em .env.example; cancelByToken/getCancelView públicos (sem JWT) reusam o cancelamento da story 41 (gateway + subscription.status=CANCELED + associate.status=CANCELED), idempotentes; PublicAssociateController GET :token/cancel-view + POST :token/cancel (@Throttle 5/min). SEM migration (colunas/tabelas existentes). Tipo AssociateCancelView em @fonte/types + re-export api-client + associates.public.getCancelView/cancelByToken. App associados: rota /cancelar/:token, feature `cancel` (hook useAssociateCancelView/useCancelByToken com query key dedicada, CancelPage espelhando /p/:token — nome + botão "Confirmar cancelamento" → sucesso "Assinatura cancelada", idempotente, erros via getErrorMessage, LoadingState/MessageScreen). Postman atualizado (Public Cancel view + Cancel subscription). WhatsApp client SEMPRE mockado nos testes (Meta nunca chamada). — commit: 850af90 — merge: 1e2b741 — 2026-06-16 — BLOQUEADO: envio real Meta + template aprovado com 2 botões de URL (sem credencial). Preencher META_WA_TEMPLATE_NAME_CANCELABLE com o template aprovado pela Meta (2 botões url: pagar + cancelar) e ajustar os `components` do payload ao formato real do template.

[OK] 46 — testes: api unit 386 passed (+2 no AssociateService.findAll: paginado take/skip, shape {items,total}; specs do overview da story 44 seguem verdes) + api e2e 193 passed (associates.e2e ajustado ao shape {items,total}, paginação ?limit/?offset) + adm Playwright associates.spec 11 passed (overview/lista, máscara WhatsApp E.164, detalhe com data de adesão + histórico/empty state, stopPropagation nos botões de ação, CRUD) + adm build (tsc -b + vite) verde. Backend: AssociateService.findAll({limit,offset}) → findAndCount → PaginatedAssociates {items,total} (mantém lastCharge por item); ListAssociatesDto (class-validator @IsInt/@Min/@Max/@Type, defaults limit=20 máx 100, offset=0) no controller @Query. Tipos: PaginatedAssociates em @fonte/types + re-export api-client; associates.list aceita {limit,offset}. adm: useInfiniteAssociates (useInfiniteQuery, getNextPageParam por total) substitui useAssociates; useInfiniteScroll (IntersectionObserver, sentinela) em hooks/; AssociateDetailDialog autossuficiente (useAssociateById enabled:open) com data de adesão (createdAt) + ChargeRow/ChargeStatusBadge; máscara WhatsApp (whatsappMask.ts, formatWhatsapp/toE164, valor submetido E.164) via Controller no AssociateForm; AssociatesListPage achata pages e abre detalhe pela linha. Postman atualizado (GET /associates paginado, response {items,total}). Sem migration (só leitura). — commit: 97f440f — merge: 7518568 — 2026-06-16

[OK] 44 — testes: api unit 384 passed (+5 novos no AssociateService.getOverview: nº de meses pedido terminando no corrente, default 12, mapeamento esperado(due_date)/arrecadado(paid), churn+recorrência a partir de contagens, mês sem dados = zeros sem div/0) + api e2e 190 passed (+4 em associates.e2e: overview 401 sem token / 403 coordinator / shape com 12 meses default / respeita ?months=3) + adm Playwright associates.spec 7 passed (overview default em /billing/associados, navegação overview↔lista, + CRUD/validação na lista) + adm build (tsc -b + vite) verde. Endpoint GET /associates/overview (ADMIN, declarado ANTES de :id) agrega via QueryBuilder (to_char/range, sem N+1): série esperado×arrecadado bruto+líquido dos últimos N meses (default 12) + índices do mês corrente (novos, ativos/recorrência, churn count+rate, inadimplência FAILED|PENDING vencida + PAST_DUE). Sem migration (só leitura). Tipo AssociatesOverview em @fonte/types + re-export api-client + associates.getOverview(months?). Frontend adm: rota /billing/associados→AssociatesOverviewPage (default) e /billing/associados/lista→AssociatesListPage (ex-AssociatesPage, ganhou "Voltar ao overview"); menu inalterado. Hook useAssociatesOverview + queryKeys.associates.overview(months). Página fina orquestra OverviewKpiCards/OverviewIndicesCards/BillingMonthlyChart (recharts, espelha SalesHistoryChart) + botão "Ver associados". Helper de moeda criado em features/associates/lib/format.ts (não havia em lib/; AssociateRow passou a reusá-lo). Postman atualizado (Associates Overview). — commit: 8afc6df — merge: ede1b98 — 2026-06-16

## Bloqueios esperados (dependência externa sem credencial)

- **Story 45** — envio real Meta WhatsApp + **novo template aprovado** com os dois botões de URL
  (pagar + cancelar). Sem `META_WA_*` no ambiente: cliente mockado nos testes, Meta nunca chamada.
  Preencher `META_WA_TEMPLATE_NAME` com o template aprovado e ajustar os `components` ao formato real.
- **Stories 48/53/54 (mobile nativo)** — e2e Maestro/emulador segue bloqueado por infra (ver stories
  19/25 acima). Mitigação do epic 49: unit `jest-expo` + e2e web (Playwright contra `expo export
  --platform web`), sem device. Maestro permanece opcional, não é gate de merge.
