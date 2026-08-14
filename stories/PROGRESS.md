# PROGRESS — ledger ativo

Rodada de autorun **175–180** — aberta em 2026-08-14.

## Config da rodada

- **Tema:** offline-first do `ops.fonte` (snapshot da casa + store SQLite + navegação) e melhorias de
  identificação visual do filho (contagem no ops, matriculados no adm), mais a estrutura genérica de
  templates de recibo.
- **Ordem:** 177 → 175 → 176 → 179 → 178 → 180.
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:**
  - **177 → 175** (declarada na 175): sem `GET /houses/:id/offline-snapshot` o aquecimento da 175
    nasce com `1 + N×4` requests e teria de ser reescrito. Se a 177 bloquear, a 175 bloqueia junto.
  - **175 → 179** (ordem, não conteúdo): as duas tocam a área de filhos do `ops.fonte`; a 179 abre o
    modal em cima do dado que a 175 passa a servir do store local.
- **Escopo técnico por story:**
  - **177** — backend + contratos: migration nova (índices `updated_at`/FKs), `packages/types`
    (`HouseOfflineSnapshot`, `OfflineSnapshotDeleted`), `api-client`
    (`offlineSync.houseSnapshot`), Postman (endpoint novo, 2 variantes).
  - **175** — frontend-only (`ops.fonte`): `expo-sqlite` + driver web (AsyncStorage), `user_version`
    para migração do store. Sem backend/contrato/Postman.
  - **176** — frontend-only (`ops.fonte`), tab "Menu" no lugar de "Perfil". Sem backend/Postman.
  - **179** — frontend-only (`ops.fonte`), modal do filho na contagem + foto em tela cheia. Sem
    `test:api`, `build:types`, `build:api-client` ou Postman.
  - **178** — backend + adm: migration nova (templates genéricos/kind), `packages/types` (enums),
    `api-client` (`documentTemplates.list({ kind })`), Postman (rota nova + query param + campos).
  - **180** — adm + response body de `GET /bible-courses/classes/:id` (sem migration);
    `build:api-client` + Postman (campo novo no exemplo).
- **Cuidados da rodada:**
  - **Contratos:** 177, 178 e 180 mudam `packages/types`/`api-client` → `pnpm build:types &&
    pnpm build:api-client` antes de subir API/adm e antes dos gates; sem `dist/` do api-client a
    suíte adm inteira quebra.
  - **Migrations:** 177 e 178 criam migration nova — `pnpm migration:run:test` após cada uma.
    **Nunca** editar migration existente. Timestamps crescentes na ordem de merge.
  - **Postman:** 177, 178 e 180 obrigam atualizar `fonte-api.postman_collection.json` (regra do
    CLAUDE.md).
  - **Offline-first é invariante do `ops.fonte`** (175/176/179): mutation de fluxo de campo sempre
    `mutationKey` + `setMutationDefaults` + `networkMode: 'offlineFirst'`; allowlist de query keys em
    `lib/offline/constants.ts` nunca vira denylist; rejeição do servidor vai para `/sync`, erro de
    rede não descarta item; 401 só desloga em 401 real.
  - **Maestro** (`test:ops`/`test:app`) costuma não rodar sem emulador conectado → registrar
    PENDENTE-MANUAL em vez de bloquear; cobertura de fluxo offline vai no Playwright web (`e2e-web/`).
  - Gate de cobertura ≥ 90 no escopo tocado; merge só com suíte da área verde.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 177 — backend: snapshot offline da casa (agregado + delta) | [OK] | api 1516 · e2e 541 · api-client 290 | ff28960 | 6dad0c0 |
| 2 | 175 — ops: ficha dos filhos persistente em SQLite | [OK] | ops unit 1093 · e2e-web 17 | 61e3422 | 14cb6ec |
| 3 | 176 — ops: tab "Menu" no lugar de "Perfil" | [OK] | ops unit 1146 · e2e-web 19 | ec5f8b7 d72f9f3 | e10a321 |
| 4 | 179 — ops: modal de detalhes do filho na contagem + foto em tela cheia | [OK] | ops unit 1186 · e2e-web 20 | 4c0770b | 1080774 |
| 5 | 178 — templates de recibo: estrutura genérica + contribuição mensal | in_progress | | | |
| 6 | 180 — adm: foto e acesso ao perfil na listagem de matriculados | [ ] | | | |

## Log

```
[OK] 177 — testes: api 1516/1516 · e2e 541/541 (offline-snapshot 19/19) · api-client 290/290;
     cobertura offline-sync 100%, global api 92.3% — commit: ff28960 — merge: 6dad0c0 — 2026-08-14
     Nota: delta comparava timestamp em hora local (driver pg vs. coluna sem timezone) — corrigido
     com `common/lib/db-timestamp.ts`; carnê (`receivables`) não desce para SERVANT.

[OK] 175 — testes: ops unit 1093/1093 · e2e-web 17/17; cobertura store/sync 100%, all files 94.3%
     — commit: 61e3422 — merge: 14cb6ec — 2026-08-14
     PENDENTE-MANUAL: Maestro e roteiro manual (modo avião + restart) sem emulador nesta máquina.
     Nota: `driver.web.ts` colidia com extensão de plataforma do Metro (quebrava só no bundle web);
     hidratação de `residents.byHouse` marca lista/contagem como pendentes para não furar o censo.

[OK] 176 — testes: ops unit 1146/1146 · e2e-web 19/19; cobertura features/menu 100%, global 94.4%
     — commit: ec5f8b7 + d72f9f3 — merge: e10a321 — 2026-08-14
     PENDENTE-MANUAL: Maestro (`e2e/auth.spec.yaml` já ajustado, falta rodar em aparelho).
     Nota: `canAccessMenuItem` virou fonte única (tabs + menu + atalhos); paridade com as regras
     antigas travada por teste-oráculo — diff de acesso revisado pelo orquestrador antes do merge.

[OK] 179 — testes: ops unit 1186/1186 · e2e-web 20/20 (inclui modal sem sinal); cobertura global 94.5%
     — commit: 4c0770b — merge: 1080774 — 2026-08-14
     PENDENTE-MANUAL: Maestro — falta `e2e/helpers/login-coordinator.yaml` + `census.yaml` (não há
     fluxo de contagem em `e2e/` e a tela é COORDINATOR-only); sem emulador nesta rodada.
     Nota: `lib/offline/` intocado — o modal lê `['resident', id]` do store da 175 e não escreve.
```

## Resumo final

<vazio>
