# PROGRESS — ledger ativo

Rodada de autorun **214–219** — aberta em 2026-10-20.

## Config da rodada

- **Tema:** coordenação da casa, histórico (acolhimentos e serviço), desligamento de servo, reacolhimento na contagem e CPF único do filho.
- **Ordem:** 214 → 215 → 216 → 217 → 219 → 218
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** 215 → 216 (reusa `AdmissionCard`/`AdmissionFormDialog`) → 217 (usa `staff_service_periods`). Se uma bloquear, as seguintes da cadeia bloqueiam junto. 219 vem antes da 218 para a 218 já consumir o 409 `conflictResidentId` (não é dep rígida).
- **Escopo técnico por story:**
  - 214 — api + adm; sem migration; Postman (roles das rotas, `coordinators`); `BUSINESS_RULES.md`.
  - 215 — api + adm; sem migration; types + api-client (`createAdmission`/update); Postman (2 endpoints).
  - 216 — api + adm; migration `CreateStaffServicePeriods` (tabela + índice parcial + backfill); types + api-client; Postman (3 endpoints).
  - 217 — api + adm; migration (`staff.dismissed_at`, `end_reason`, `end_notes`); types + api-client; Postman; rebasear predicado de coordenador da 214 (COORDINATOR|ADMIN **e** ativo).
  - 219 — types (`normalizeCpf`/`isValidCpf`/`formatCpf`) + api + adm + ops; migration `UniqueResidentCpf` com `down` e tabela de backup; Postman (400/409).
  - 218 — api + ops; sem migration; types + api-client (`residents.lookup`); Postman.
- **Cuidados da rodada:** timestamps de migration crescentes e posteriores à última existente; rebuild `pnpm build:types && pnpm build:api-client` sempre que contrato mudar; `migration:run:test` após migration nova; ops é offline-first (mutations com `mutationKey` + `setMutationDefaults` + `networkMode: 'offlineFirst'`, 409 vai para `/sync`); CPF segue mascarado pelo `sensitive-data.interceptor`; e2e idempotentes (fixture própria, limpeza por id); cobertura ≥90 no escopo tocado. 219 em produção exige ensaio em dump recente → PENDENTE-MANUAL.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 214 — admin lotado conta como coordenador da casa | [OK] | api 2177 · e2e 713 · adm 2053+13 · ops 1593 | 22ed19f | 6e153ae |
| 2 | 215 — criar e editar acolhimentos no Histórico | [OK] | api 2209 · e2e 720 · adm 2086+2 · client 313 | f4eb3b0 | d7a29a0 |
| 3 | 216 — período de serviço do servo no Histórico | [OK] | api 2236 · e2e 727 · adm 2126+19 · client 316 | 9064cc4 | e235e21 |
| 4 | 217 — desligamento e reintegração de servo | [OK] | api 2266 · e2e 734 · adm 2171+pw · client 319 | 5971688 | dc76705 |
| 5 | 219 — CPF do filho único | [ ] | | | |
| 6 | 218 — contagem do ops reacolhe filho existente | [ ] | | | |

## Log

[OK] 214 — testes: api 2177/2177, api e2e 713/713, adm unit 2053 + e2e houses 13/13, ops 1593; cov api 93,66% stmts — commit: 22ed19f — merge: 6e153ae — 2026-10-20
Predicado de coordenador em `services/api/src/common/auth/house-coordinator.ts` (+ espelho `apps/ops.fonte/lib/houseCoordinator.ts`) — 217 rebaseia aqui.
[OK] 215 — testes: api 2209/2209 (cov 93,75%), api e2e 720/720, adm unit 2086 + e2e admission-history 2/2, api-client 313 — commit: f4eb3b0 — merge: d7a29a0 — 2026-10-20
Regra extra: passagem antiga tem de começar antes da entrada do atual (senão viraria o "atual"). 216: `buildHistory` aceita `kind: 'service'`; `findAdmissionOverlap` reutilizável.
[OK] 216 — testes: api 2236/2236 (cov 93,83%), api e2e 727/727, adm unit 2126 + e2e 19/19, api-client 316 — commit: 9064cc4 — merge: e235e21 — 2026-10-20
Migration 1783038200000 (próxima > isso). `StaffServicePeriodService` + `openServicePeriod(manager,…)`; índice único parcial = 1 aberto por staff. Staff já soft-deletado ficou sem período.
[OK] 217 — testes: api 2266/2266 (cov 93,88%), api e2e 734/734, adm unit 2171 + pw staff*/houses verdes (2x), api-client 319 — commit: 5971688 — merge: dc76705 — 2026-10-20
Migration 1783038300000. Predicado único `modules/staff/active-staff.ts`; "titular não pode ser desligado" lido como "desligado não pode ser titular" (dismiss limpa titular).

## Resumo final

<vazio até o fim da rodada>

---

## Modelo de seção por rodada

```markdown
Rodada de autorun **NN–MM** — aberta em AAAA-MM-DD.

## Config da rodada

- **Tema:** <uma frase>
- **Ordem:** NN → ... → MM
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** <A → B, com o motivo; se A bloquear, B bloqueia junto>
- **Escopo técnico por story:** <migration, contratos, Postman e apps tocados>
- **Cuidados da rodada:** <contratos, migrations, dependências externas, invariantes e cobertura ≥90>

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | NN — <título> | [ ] | | | |

## Log

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data>
<bloqueio/PENDENTE-MANUAL e no máximo uma nota crítica; até três linhas por entrada>

## Resumo final

<vazio até o fim da rodada>
```
