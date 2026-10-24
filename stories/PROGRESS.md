# PROGRESS — ledger ativo

Rodada de autorun **221–224** — aberta em 2026-10-23.

## Config da rodada

- **Tema:** ops — cards Filhos/Servos no dashboard, filhos por data de entrada, criar atividade por coluna com responsável; adm — busca e filtros (status/casa) na lista de servos.
- **Ordem:** 221 → 222 → 223 → 224
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** nenhuma entre as stories da rodada (224 depende da 220, já na `main`).
- **Escopo técnico por story:**
  - 221: só `ops.fonte` (`features/dashboard`, `features/menu`); talvez remover `useIncidentsToday` + query key/allowlist. Sem backend.
  - 222: só `ops.fonte` (`features/residents`), ordenação no cliente. Sem backend.
  - 223: backend `modules/staff` (DTO `search`/`houseId`, query builder), `packages/types` (`StaffFiltersPreference`, `STAFF_FILTERS_PREFERENCE_KEY`), `api-client` (`staff.list`), Postman, `adm.fonte/features/staff`. Sem migration.
  - 224: backend `modules/activity` (matriz de criação por status, responsável na criação, eventos), `BUSINESS_RULES.md`, Postman, contratos se o input mudar, `ops.fonte/features/activities`. Sem migration.
- **Cuidados da rodada:** sem migration prevista; rebuild `pnpm build:types && pnpm build:api-client` após 223/224 se contratos mudarem; Postman em 223 e 224; ops offline-first (allowlist intacta, criação de atividade segue outbox com `Idempotency-Key`); LGPD — `houseId` do `GET /staff` ignorado para não-ADMIN; e2e idempotentes (fixtures por id, story 182); Maestro exige emulador (PENDENTE-MANUAL se indisponível); cobertura ≥90 no código novo, sem reduzir a dos módulos tocados.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 221 — cards Filhos e Servos no dashboard do ops | [ ] | | | |
| 2 | 222 — lista de filhos do ops por data de entrada | [ ] | | | |
| 3 | 223 — busca e filtros na lista de servos do adm | [ ] | | | |
| 4 | 224 — criar atividade por coluna com responsável no ops | [ ] | | | |

## Log

## Resumo final

<vazio até o fim da rodada>
