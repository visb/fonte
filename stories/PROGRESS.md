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
| 2 | 215 — criar e editar acolhimentos no Histórico | [ ] | | | |
| 3 | 216 — período de serviço do servo no Histórico | [ ] | | | |
| 4 | 217 — desligamento e reintegração de servo | [ ] | | | |
| 5 | 219 — CPF do filho único | [ ] | | | |
| 6 | 218 — contagem do ops reacolhe filho existente | [ ] | | | |

## Log

[OK] 214 — testes: api 2177/2177, api e2e 713/713, adm unit 2053 + e2e houses 13/13, ops 1593; cov api 93,66% stmts — commit: 22ed19f — merge: 6e153ae — 2026-10-20
Predicado de coordenador em `services/api/src/common/auth/house-coordinator.ts` (+ espelho `apps/ops.fonte/lib/houseCoordinator.ts`) — 217 rebaseia aqui.

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
