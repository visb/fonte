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
| 5 | 25 — code quality review frontends | [ ] | — | — |

## Log

<!-- [OK|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp> -->

[OK] 23 — testes: adm e2e document-templates.spec 1 passed + api document-template.service 6 passed + tsc -b limpo; base do editor e do PDF unificadas em 12pt; `nextFontPt` extraída pura. Ponto manual: migração visual de templates já salvos (+~60% base) é verificação pós-deploy. — commit: 79eef59 — 2026-06-09
[OK] 22 — testes: api document-template 7 passed (1 novo: upload repassa buffer/mimetype intactos) + adm e2e document-templates 2 passed (23+22) + tsc limpo. Confirmado: sem sharp/resize no upload; "tratamento" era display sem width/height — agora grava dimensões naturais no nó. Postman intacto. — commit: fad4c09 — 2026-06-09
[OK] 21 — testes: adm e2e document-templates 4 passed (2 novos: tabela 2×2 persiste, "2 colunas" salva class) + api 7 passed + tsc -b limpo. Dep `@tiptap/extension-table@3.22.5` (exata, casa core/react/starter-kit 3.22.5; v3 é pacote único). `DocTableView extends TableView` espelha class na tabela viva (TableView ignora class/HTMLAttributes). CSS de tabela espelhado editor↔PDF. — commit: 023eb44 — 2026-06-09
[OK] 24 — testes: adm e2e document-templates 6 passed (2 novos: editor dentro de `.a4-page` largura 794px / conteúdo curto 1 página; conteúdo longo >1 folha mostra guia de quebra) + api document-template 8 passed (1 novo: PDF injeta `DOCUMENT_PRINT_CSS`), suite api 308 passed + build adm prod OK + tsc -b limpo. CONSOLIDAÇÃO: criado `packages/doc-styles` (`DOCUMENT_PRINT_CSS` + geometria A4 + `EDITOR_PAGE_CSS`), consumido por adm.fonte E api 1:1 — removida a duplicação de CSS de print do `document-template.service.ts` (wrapPage) e do `index.css` (.ProseMirror). Preserva tabela (21), base 12pt (23), guarda de imagem (22). Geometria: puppeteer `margin:0`, margem da página = `padding:48px 40px` do body (altura útil 1027px), A4 794×1123. PAGINAÇÃO: **MVP visual** (guias de quebra via `repeating-linear-gradient` calibradas à mesma geometria do PDF) — NÃO usei extensão TipTap de paginação. Motivo: `tiptap-pagination-plus`/`tiptap-extension-pagination` mediriam altura no DOM de forma independente (não garante casar com o flow do puppeteer) e conflitam com os NodeViews custom (imagem/tabela); guias desenhadas a partir das constantes compartilhadas são determinísticas e batem com o PDF (DoD). Subcomponente `A4EditorFrame` extraído (régua de zoom 50/75/100% + folha A4 + guias), TemplateEditor não inflou. Postman intacto (sem mudança de endpoint). — commit: dcd7921 — 2026-06-09

## Bootstrap (2026-06-09)

Serviços no ar: docker postgres, db teste seedado, `build:types`+`build:api-client` ok, API teste :3001 (404 root = ok), adm teste :5174 (200).
