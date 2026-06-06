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

### Pendências/riscos para o usuário
- **ops Maestro (story 19):** corrigir build nativo do app ops no emulador (erro `ExpoModulesCorePlugin.gradle` linha 95 ao `assembleDebug` após prebuild) e então rodar `maestro test apps/ops.fonte/e2e/notifications.yaml`. O agente sinalizou que o passo final do yaml (`tapOn: "Notificações"` para fechar o sheet) pode não dispensar o modal — revisar o yaml ao rodar.
- **WebSocket em prod (story 19 §7b):** confirmar que o proxy reverso/PaaS de produção permite upgrade WebSocket no mesmo host:porta para o namespace `/notifications`; o gateway está com CORS `origin: '*'` — restringir antes do rollout.

### Como reproduzir (serviços já no ar nesta máquina)
```
pnpm docker:up
pnpm test:setup
pnpm dev:api:test                       # :3001 (NODE_ENV=test)
pnpm --filter adm.fonte dev:test        # :5174
pnpm test:api                           # unit backend
pnpm test:api:e2e                       # e2e backend
cd apps/adm.fonte && pnpm exec playwright test   # adm (78 verdes)
```
Serviços deixados de pé: API teste :3001, adm teste :5174, Metro ops :8082, emulador Test_Emulator (emulator-5554).

## Resumo final

(preencher ao terminar: o que passou, o que bloqueou, comandos para reproduzir)
