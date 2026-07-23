# PROGRESS — rodada 146–151 (arquivada)

## Config da rodada

- **Tema:** App adm — reintrodução de acolhido, detalhes do filho/casa + saneamento double-mask CPF/RG (faixa 146–151).
- **Ordem:** 146 → 147 → 148 → 149 → 150 → 151.
- **Branch base:** main.
- **Deps rígidas:**
  - **146 antes de 151** — a 146 introduz os helpers `displayCpf`/`displayRg` em `lib/masks.ts`; a 151 reusa.
  - **146 antes de 147** — ambas tocam `ReadmissionForm.tsx` (banner). 146 primeiro evita conflito.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 146 — reintrodução exibir CPF completo (double-mask) | [OK] | 1371/1371, cov≥90 | 6ce8b70 | merged |
| 2 | 147 — editar dados de identidade na reintrodução | [OK] | api 1276, e2e 491, api-client 266, adm 1381; cov≥90 | 627edf5 | merged |
| 3 | 148 — reintrodução volta com status ativo | [OK] | api 1279/1279, cov≥90 | 65e2ad3 | merged |
| 4 | 149 — esconder acesso digital do filho (flag) | [OK] | adm 1384/1384, tocado 100% | abb927e | merged |
| 5 | 150 — aba filhos da casa com infinite scroll | [OK] | adm 1396/1396, tocado ≥97% | fa64c33 | merged |
| 6 | 151 — sanear double-mask CPF/RG no adm | [OK] | adm 1403/1403, tocado ≥99% | b328717 | merged |

## Log

[OK] 146 — adm unit 1371/1371, cov≥90 (masks.ts 100%) — commit: 6ce8b70 — merge --no-ff na main — 2026-07-23 — helpers displayCpf/displayRg criados (reuso pela 151). Nota: script de cobertura adm é `test:unit:cov`.
[OK] 147 — api 1276/1276, e2e 491/491, api-client 266/266, adm 1381/1381, cov≥90 — commit: 627edf5 — merge --no-ff — 2026-07-23 — endpoint PATCH /residents/:id/identity @Roles(ADMIN); Postman+contratos atualizados. Banner label virou "Dados de identificação". ReadmissionForm passou a consumir useAuth.
[OK] 148 — api 1279/1279 (resident 61/61), cov≥90 — commit: 65e2ad3 — merge --no-ff — 2026-07-23 — readmit vira ACTIVE (admission+resident) + notifyAdmissionCreated. Backend-only.
[OK] 149 — adm 1384/1384, tocado 100% — commit: abb927e — merge --no-ff — 2026-07-23 — flag RESIDENT_APP_ENABLED=false em apps/adm.fonte/src/config/features.ts esconde seção "Acesso Digital" do filho. Frontend-only.
[OK] 150 — adm 1396/1396, tocado ≥97% — commit: fa64c33 — merge --no-ff — 2026-07-23 — ResidentsTab reusa useInfiniteResidents (houseId fixo); ResidentsFilters ganhou hideHouseFilter; extraídos HouseResidentRow/HouseResidentDetailDialog. useHouseResidents mantido (usado por ministry dialogs).
[OK] 151 — adm 1403/1403, tocado ≥99% — commit: b328717 — merge --no-ff — 2026-07-23 — displayCpf/displayRg (da 146) aplicados em StaffOverviewTab, residents OverviewTab (exibição) e staffSchema/residentSchema (prefill, sem dígito falso). Input masks intactas.

## Resumo final

Rodada **146–151 (App adm + saneamento double-mask CPF/RG) — 6/6 [OK], zero bloqueios.** Todas mergeadas na main (--no-ff), planos arquivados em stories/done/. Sem push, sem PR.

- **146** — banner de reintrodução exibe CPF/RG completo; criados helpers `displayCpf`/`displayRg` em `apps/adm.fonte/src/lib/masks.ts` (raiz da correção double-mask reusada pela 151). `6ce8b70`.
- **147** — endpoint `PATCH /residents/:id/identity` `@Roles(ADMIN)` + `UpdateResidentIdentityDto` + `EditResidentIdentityDialog`; Postman e contratos (`@fonte/types`/`api-client`) atualizados. `627edf5`.
- **148** — `readmit()` volta o filho como `ACTIVE` (admission+resident) e dispara `notifyAdmissionCreated`. `65e2ad3`.
- **149** — flag `RESIDENT_APP_ENABLED=false` (`apps/adm.fonte/src/config/features.ts`) esconde a seção "Acesso Digital" do filho. `abb927e`.
- **150** — aba Filhos da casa reusa `useInfiniteResidents` (infinite scroll + busca + status/sort), `hideHouseFilter` no `ResidentsFilters`, itens extraídos. `fa64c33`.
- **151** — `displayCpf`/`displayRg` aplicados em exibição (StaffOverviewTab, residents OverviewTab) e prefill de edição (staffSchema, residentSchema); elimina o risco de salvar CPF corrompido. `b328717`.

**Gates reproduzíveis:** backend — `pnpm test:api:cov` + `pnpm test:api:e2e` (api 1279, e2e 491, api-client 266); frontend — `pnpm --filter adm.fonte test:unit:cov` (adm 1403, tocado ≥90). Pré-req: `pnpm docker:up` + `pnpm test:setup` + `pnpm dev:api:test` (3001).

**Notas p/ futuras rodadas:** (1) o script de cobertura do adm é `test:unit:cov` (não `test:cov`). (2) `ReadmissionForm` passou a consumir `useAuth` — mockar `@/contexts/AuthContext` em specs que o montam. (3) prefill de forms reusou `displayCpf/displayRg` em vez de helpers `prefillCpf/prefillRg` dedicados. (4) branch-coverage de `residents OverviewTab` tem baseline pré-existente baixo (fallbacks `|| '—'`) — statements/lines do tocado 100%.

**Serviços deixados de pé:** docker (postgres+redis), API test (3001), adm test (5174). Branches por story preservadas (não deletadas, sem push).
