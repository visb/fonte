# PROGRESS — ledger ativo

Rodada de autorun **225–230** — aberta em 2026-10-27.

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
| 3 | 227 — ocorrência com múltiplos filhos | [ ] | | | |
| 4 | 229 — ocorrência positiva/negativa (substitui severidade) | [ ] | | | |
| 5 | 230 — categoria da ocorrência | [ ] | | | |
| 6 | 228 — ops, ocorrências na aba Acompanhamento | [ ] | | | |

## Log

[OK] 225 — testes: api 2482/2482 (daily 99.7 stmts), ops unit 1857/1857, e2e daily 8/8, PW web daily-offline verde — commit: b3f40de — merge: d564960 — 2026-10-28 — PENDENTE-MANUAL: Maestro daily.yaml (sem emulador), teste 2 celulares, APK novo (gesture-handler nativo). Pré-existentes fora da story: audit.e2e 2 falhas, PW offline-field-flows › mensagens (seed).
[OK] 226 — testes: ops unit 1868/1868 (arquivos tocados 100%), PW offline-field-flows 9/10 (mensagens pré-existente) — commit: 813086b — merge: b634a54 — 2026-10-28 — PENDENTE-MANUAL: Maestro incidents.yaml. Nota: mensagens de erro reusam DATE_FIELD_MESSAGES.

## Resumo final

<vazio até o fim da rodada>
