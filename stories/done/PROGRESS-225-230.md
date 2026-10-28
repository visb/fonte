# PROGRESS — rodada 225–230 (arquivada)

Rodada de autorun **225–230** — aberta em 2026-10-27, encerrada em 2026-10-28.

## Config da rodada

- **Tema:** ops — módulo Daily (board de ministérios em tempo real); nova ocorrência: data com calendário, múltiplos filhos, tipo positivo/negativo (substitui severidade), categoria, e ocorrências na aba Acompanhamento do filho.
- **Ordem:** 225 → 226 → 227 → 229 → 230 → 228 (228 por último: já nasce com tipo/categoria/N filhos, sem retrabalho no `IncidentTrackingItem`).
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** 227 → 228 (`Incident.residents[]` + filtro `?residentId=` via join); 229 → 230 (campo `type`). Se 227 bloquear, 228 bloqueia; se 229 bloquear, 230 bloqueia.
- **Escopo técnico por story:**
  - 225: backend `modules/daily` novo (migration `daily_sessions`/`daily_session_assignments`, gateway socket `/daily`), `MinistryService` (extrair `setResidentMinistry`/`setStaffMinistry`), `packages/types`, `api-client`, Postman, `BUSINESS_RULES.md`, `ops.fonte/features/daily` + menu.
  - 226: só `ops.fonte` (`IncidentFormFields`, schema do `NewIncidentPage`, helper de hoje local). Sem backend.
  - 227: migration `incident_residents` (backfill + drop `incidents.resident_id`), DTO `residentIds` + `residentId` legado, contratos, Postman, ops (`ResidentMultiPicker`, `IncidentCard`, fila offline).
  - 229: migration `incidents.type` (backfill `NEGATIVE`, drop `severity`), DTO com legado `severity`, contratos, Postman, ops (`IncidentTypeSelector`, `INCIDENT_TYPE_CONFIG`).
  - 230: migration `incidents.category` (null nas antigas), `INCIDENT_CATEGORIES_BY_TYPE` em `packages/types`, DTO, Postman, ops (`IncidentCategoryPicker`).
  - 228: só `ops.fonte` (`useResidentIncidents`, `mergeTrackingTimeline`, `IncidentTrackingItem` já com tipo/categoria/outros filhos, query key persistida).
- **Cuidados da rodada:** 4 migrations novas (225, 227, 229, 230) — timestamps crescentes, `migration:run:test` após cada, nunca editar migration aplicada; rebuild `pnpm build:types && pnpm build:api-client` após 225/227/229/230; Postman em 225/227/229/230; payload legado da fila offline (`residentId`, `severity` sem `type`/`category`) tem que continuar replayando (ValidationPipe `forbidNonWhitelisted`); ops offline-first (allowlist intacta; Daily exige rede, fora da outbox); e2e idempotentes (fixtures por id, story 182); Maestro exige emulador (PENDENTE-MANUAL se indisponível); teste manual de 2 celulares na Daily = PENDENTE-MANUAL; cobertura ≥90 no código novo, sem reduzir a dos módulos tocados.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 225 — ops, Daily: board de ministérios em tempo real | [OK] | api 2482/2482, ops 1857/1857, e2e daily 8/8 | b3f40de | d564960 |
| 2 | 226 — ops, data da ocorrência com calendário | [OK] | ops 1868/1868, PW web 9/10 (pré-exist.) | 813086b | b634a54 |
| 3 | 227 — ocorrência com múltiplos filhos | [OK] | api 2499/2499, e2e 780/782 (pré-exist.), ops 1879/1879 | be1f0fd | a32be67 |
| 4 | 229 — ocorrência positiva/negativa (substitui severidade) | [OK] | api 2514/2514, e2e 786/786, ops 1887/1887, PW 10/10 | 104f367 | 79021ef |
| 5 | 230 — categoria da ocorrência | [OK] | api 2531/2531, e2e 791/791, ops 1903/1903, PW 9/10 (pré-exist.) | 9572914 | 2dc3870 |
| 6 | 228 — ops, ocorrências na aba Acompanhamento | [OK] | ops 1929/1929, PW 12/13 (pré-exist.) | 37b8a08 | 47941f4 |

## Log

[OK] 225 — testes: api 2482/2482 (daily 99.7 stmts), ops unit 1857/1857, e2e daily 8/8, PW web daily-offline verde — commit: b3f40de — merge: d564960 — 2026-10-28 — PENDENTE-MANUAL: Maestro daily.yaml (sem emulador), teste 2 celulares, APK novo (gesture-handler nativo). Pré-existentes fora da story: audit.e2e 2 falhas, PW offline-field-flows › mensagens (seed).
[OK] 226 — testes: ops unit 1868/1868 (arquivos tocados 100%), PW offline-field-flows 9/10 (mensagens pré-existente) — commit: 813086b — merge: b634a54 — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents.yaml. Nota: mensagens de erro reusam DATE_FIELD_MESSAGES.
[OK] 227 — testes: api 2499/2499 (incident 100 stmts), e2e 780/782 (audit pré-exist.), api-client 330/330, ops 1879/1879, PW offline 9/10 (mensagens pré-exist.) — commit: be1f0fd — merge: a32be67 — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents.yaml, APK novo. Nota: PERSIST_BUSTER não incrementado (preserva fila); IncidentCard tolera cache sem `residents`.
[OK] 229 — testes: api 2514/2514 (incident 100 stmts), e2e 786/786, api-client 330/330, ops 1887/1887, PW offline 10/10 — commit: 104f367 — merge: 79021ef — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents.yaml, APK novo. Nota p/ 228: reusar `incidentTypeConfig(type)` de IncidentCard.tsx.
[OK] 230 — testes: api 2531/2531, e2e 791/791, api-client 330/330, ops 1903/1903, PW offline 9/10 (mensagens pré-exist.) — commit: 9572914 — merge: 2dc3870 — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents.yaml, APK novo. Nota: payload com `type` sem `category` = 400 (só afetaria APK da era 229; 229/230 vão juntas, sem push entre elas). 228: reusar `incidentCategoryLabel()` de features/incidents/constants.ts.
[OK] 228 — testes: ops unit 1929/1929 (código novo 100%), PW offline-resident-store 3/3 + offline-field-flows (12/13, mensagens pré-exist.) — commit: 37b8a08 — merge: 47941f4 — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents/residents.yaml, APK novo. Nota: fixture de ocorrência no PW não é removida (ocorrência não pode ser deletada); nome único via Date.now().

## Resumo final

**6/6 stories OK**, todas mergeadas na `main` local (`--no-ff`), sem push. Branches preservadas:
`feat/story-225-ops-daily-board-ministerios`, `feat/story-226-ops-ocorrencia-data-com-calendario`,
`feat/story-227-ocorrencia-multiplos-filhos`, `feat/story-229-ocorrencia-tipo-positivo-negativo`,
`feat/story-230-ocorrencia-categoria`, `feat/story-228-ops-ocorrencias-na-aba-acompanhamento`.

Migrations novas: `1783038600000-CreateDailySessions`, `1783038700000-CreateIncidentResidents`,
`1783038800000-AddIncidentType`, `1783038900000-AddIncidentCategory`.

**PENDENTE-MANUAL**
- Maestro (sem emulador): `e2e/daily.yaml`, `e2e/incidents.yaml`, `e2e/residents.yaml`.
- Daily com 2 celulares reais (long-press/arrasto/auto-scroll, movimento < 1s no outro aparelho, arrasto simultâneo).
- APK novo (`react-native-gesture-handler` nativo entrou na 225; multi-picker/tipo/categoria só chegam ao campo com APK novo). APKs antigos seguem replayando a fila (`residentId`/`severity` legados aceitos).
- Deploy: 229 e 230 têm que ir juntas para produção (payload com `type` sem `category` = 400).

**Falhas pré-existentes / intermitentes (fora da rodada)**
- `audit.e2e-spec.ts`: 2 falhas dependentes de ordem das suítes (transferência de filho, update de servo); passam isoladas.
- Playwright `offline-field-flows › mensagens`: conversa "Maria Testadora" ausente no seed de teste (intermitente).

**Reproduzir os gates**
```bash
pnpm test:setup && pnpm build:types && pnpm build:api-client
pnpm dev:api:test                        # background, porta 3001
pnpm test:api:cov
pnpm test:api:e2e
pnpm test:api-client
pnpm --filter ops.fonte test:unit:cov
# Playwright web do ops (na pasta apps/ops.fonte):
#   EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1 npx expo export --platform web
#   npx playwright test e2e-web/
```
