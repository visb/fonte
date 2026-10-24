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
| 1 | 221 — cards Filhos e Servos no dashboard do ops | [OK] | ops 1722 · web 36 | 06a92e4 | c42ee7b |
| 2 | 222 — lista de filhos do ops por data de entrada | [OK] | ops 1733 | 8c65c29 | 316c18d |
| 3 | 223 — busca e filtros na lista de servos do adm | [OK] | api 2379 · e2e 762 · client 323 · adm 2222 · pw 17 | 5749044 | 44b8844 |
| 4 | 224 — criar atividade por coluna com responsável no ops | [OK] | api 2411 · e2e 769 · ops 1784 · web 4 | 8054881 | 0c22bf1 |

## Log

[OK] 221 — testes: ops unit 1722/1722, Playwright web 36/36; cobertura ops 96.2 stmts, StatCard/StatCards/DashboardPage 100 — commit: 06a92e4 — merge: c42ee7b — 2026-10-23
PENDENTE-MANUAL: Maestro `e2e/dashboard.yaml` (sem emulador). Nota: removido `useIncidentsToday`; prefetch agora aquece `incidents.byHouse`.

[OK] 222 — testes: ops unit 1733/1733; `lib/sortResidents.ts` 100 — commit: 8c65c29 — merge: 316c18d — 2026-10-23
PENDENTE-MANUAL: Maestro (fluxos selecionam por texto, não mudaram). Nota: suíte ops paralela com máquina carregada teve timeout 5s em 3 arquivos alheios; `--maxWorkers=4` verde.

[OK] 223 — testes: api 2379/2379, api:e2e 762/762, api-client 323/323, adm unit 2222/2222, Playwright staff*/residents/preferences verde; cobertura modules/staff 99.4/100 lines, hooks/comp novos 100 — commit: 5749044 — merge: 44b8844 — 2026-10-23
Nota: busca por CPF compara só dígitos dos dois lados (`regexp_replace` em `staff.cpf`, CPF pode estar formatado); `%`/`_` escapados.

[OK] 224 — testes: api 2411/2411, api:e2e 769/769, ops unit 1784/1784 (revalidado pelo orquestrador, `--maxWorkers=4`), Playwright web activities* 4/4; cobertura activity 96.5/87.1/98.5 lines, ops activities 96.5 lines — commit: 8054881 — merge: 0c22bf1 — 2026-10-23
PENDENTE-MANUAL: Maestro `e2e/activities.yaml` (reescrito, sem emulador). Nota: `assertStaffInHouse` agora recusa servo desligado — vale também p/ trocar responsável/aprovar (220).

## Resumo final

- **Passou:** 221, 222, 223, 224 — todas mergeadas na `main` local (`c42ee7b`, `316c18d`, `44b8844`, `0c22bf1`). Branches `feat/story-22{1..4}-*` preservadas. Sem push. `main` foi avançada (ff) até `dev` na abertura da rodada.
- **PENDENTE-MANUAL:** `pnpm test:ops` (Maestro: `dashboard.yaml`, `activities.yaml`) — exige emulador API ≤34 + APK e2e (`pnpm --filter ops.fonte build:e2e:android`).
- **Desvios do plano:** 223 compara CPF só por dígitos; 224 extraiu `NewActivityForm` (sem `useForm` em page) e endureceu `assertStaffInHouse` (servo desligado).
- **Ambiente:** `pnpm build:web:test` do ops quebra no Windows (env POSIX); usar `npx expo export --platform web --clear` com `EXPO_PUBLIC_API_URL`. Suíte ops com máquina carregada: `--maxWorkers=4`. `tsc --noEmit` do ops tem erros pré-existentes em arquivos de teste.
- **Reproduzir gates:** `pnpm test:api` · `pnpm test:api:e2e` (com `pnpm dev:api:test`) · `pnpm test:api-client` · `pnpm test:adm:unit` · `pnpm test:adm` (com adm `dev:test`) · `pnpm --filter ops.fonte test:unit --maxWorkers=4` · `pnpm test:api:cov`.
