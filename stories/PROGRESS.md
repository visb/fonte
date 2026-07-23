# PROGRESS — ledger ativo

## Config da rodada

- **Tema:** App adm — reintrodução de acolhido, detalhes do filho/casa + saneamento double-mask CPF/RG (faixa 146–151).
- **Ordem:** 146 → 147 → 148 → 149 → 150 → 151.
- **Branch base:** main.
- **Deps rígidas:**
  - **146 antes de 151** — a 146 introduz os helpers `displayCpf`/`displayRg` em `lib/masks.ts`; a 151 reusa. Se 146 bloquear, 151 cria o helper (mas manter a ordem).
  - **146 antes de 147** — ambas tocam `ReadmissionForm.tsx` (banner). 146 primeiro evita conflito; 147 usa o display já saneado.
- **Cuidados da rodada:**
  - **147** é a única full-stack: novo endpoint `PATCH /residents/:id/identity` `@Roles(ADMIN)` + `UpdateResidentIdentityDto` + método no `@fonte/api-client` → **rebuild `build:types`/`build:api-client`** e **atualizar `fonte-api.postman_collection.json`**. Sem migration (campos já existem).
  - **148** backend-only, sem DTO/migration; mexe em `readmit()` (status + notif).
  - **146/149/150/151** frontend-only (`adm.fonte`), sem contrato.
  - **149** introduz flag `RESIDENT_APP_ENABLED=false`.
  - **150** reusa `useInfiniteResidents` (sem endpoint novo).
  - **Gate:** suíte da área tocada verde + cobertura ≥90 do código novo. `test:api:cov` p/ 147/148; `adm test:cov` p/ 146/147/149/150/151.
  - Sem dep externa sem credencial nesta faixa.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 146 — reintrodução exibir CPF completo (double-mask) | [OK] | 1371/1371, cov≥90 | 6ce8b70 | merged |
| 2 | 147 — editar dados de identidade na reintrodução | [OK] | api 1276, e2e 491, api-client 266, adm 1381; cov≥90 | 627edf5 | merged |
| 3 | 148 — reintrodução volta com status ativo | [OK] | api 1279/1279, cov≥90 | 65e2ad3 | merged |
| 4 | 149 — esconder acesso digital do filho (flag) | [ ] | | | |
| 5 | 150 — aba filhos da casa com infinite scroll | [ ] | | | |
| 6 | 151 — sanear double-mask CPF/RG no adm | [ ] | | | |

## Log

[OK] 146 — adm unit 1371/1371, cov≥90 (masks.ts 100%) — commit: 6ce8b70 — merge --no-ff na main — 2026-07-23 — helpers displayCpf/displayRg criados (reuso pela 151). Nota: script de cobertura adm é `test:unit:cov`.
[OK] 147 — api 1276/1276, e2e 491/491, api-client 266/266, adm 1381/1381, cov≥90 — commit: 627edf5 — merge --no-ff — 2026-07-23 — endpoint PATCH /residents/:id/identity @Roles(ADMIN); Postman+contratos atualizados. Banner label virou "Dados de identificação". ReadmissionForm passou a consumir useAuth.
[OK] 148 — api 1279/1279 (resident 61/61), cov≥90 — commit: 65e2ad3 — merge --no-ff — 2026-07-23 — readmit vira ACTIVE (admission+resident) + notifyAdmissionCreated. Backend-only.

## Resumo final

<vazio>
