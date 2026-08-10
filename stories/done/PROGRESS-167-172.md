# PROGRESS — rodada encerrada: offline-first do ops.fonte (epic 167) + idempotência (172)

Rodada de autorun aberta em 2026-08-09 e encerrada em 2026-08-10.

## Config da rodada

- **Tema:** `ops.fonte` offline-first (epic 167) com o pré-requisito de backend 172.
- **Ordem:** 172 → 168 → 169 → 170 → 171.
- **Branch base:** `main` (cada branch partiu da main já com o merge anterior).
- **Deps rígidas (cadeia):** 172 antes de 169; 168 antes de 169; 169 antes de 170; 170 antes de 171.
- **167 não foi implementada** — documento do epic, arquivado em `done/` ao fechar a 171.

### Cuidados da rodada

- 172 corrigiu a decisão 9 da 169 (`ValidationPipe` com `forbidNonWhitelisted: true` ⇒ transporte
  por header, não campo no body).
- Migration nova em 172 (`idempotency_keys`), timestamp posterior a
  `1783037400000-AddAdmissionToReceivables.ts`.
- 168–171 não tocaram backend (decisão 6 do epic) ⇒ sem Postman, sem rebuild de contrato.
- LGPD: persistência por allowlist de query keys; limpeza no logout e na sessão expirada.
- Invariante: `mutationKey` + `setMutationDefaults` + `networkMode: 'offlineFirst'`.
- Offline testado no Playwright web (`apps/ops.fonte/e2e-web/`, `context.setOffline`).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 172 — idempotência de escrita no backend | [OK] | api 1469 unit / 522 e2e / api-client 286 | df482dc | e8bed67 |
| 2 | 168 — persistência de cache e estado de rede | [OK] | ops 670 unit / 7 e2e web | da0e35b | 75526da |
| 3 | 169 — outbox e replay de escrita | [OK] | ops 772 unit / 8 e2e web | 727d399 | da8130f |
| 4 | 170 — tela de pendências de sincronização | [OK] | ops 847 unit / 10 e2e web | 52901a5 | a32836b |
| 5 | 171 — fluxos de campo offline | [OK] | ops 930 unit / 14 e2e web | 66b1c58 | 2d1f10a |

## Log

```
[OK] 172 — testes: api 1469 unit + 522 e2e + api-client 286, cobertura do escopo 100/90+ — commit: df482dc — merge: e8bed67 — 2026-08-09
     Header `Idempotency-Key` + tabela `idempotency_keys` + `@Idempotent()`/interceptor global. Decisão 9 da 169 corrigida no plano dela.
[OK] 168 — testes: ops 670 unit + 7 e2e web, cobertura ops 92.25/82.32/90.97/93.8 — commit: da0e35b — merge: 75526da — 2026-08-09
     PENDENTE-MANUAL: `@react-native-community/netinfo` é módulo nativo ⇒ próximo APK exige prebuild/rebuild.
     Maestro (`pnpm test:ops`) não rodou — sem emulador no ambiente; fluxos cobertos pelo e2e web.
[OK] 169 — testes: ops 772 unit + 8 e2e web, cobertura ops 92.9/82.55/91.65/94.34 — commit: 727d399 — merge: da8130f — 2026-08-10
     Chave de idempotência vive nas variáveis da mutation (context não chega na mutationFn). Logout descarta fila pendente (LGPD) — resolvido com aviso na 170.
     Nomes: `storeroom`=Dispensa, `supply-room`=Almoxarifado na UI (o texto do epic troca os termos).
[OK] 170 — testes: ops 847 unit + 10 e2e web, cobertura ops 93.27/83.02/92.11/94.59 — commit: 52901a5 — merge: a32836b — 2026-08-10
     Corrigido laço de render em `usePendingMutations` (novo array a cada notificação do MutationCache). Fila virou união `PendingSyncItem | FailedSyncItem`.
[OK] 171 — testes: ops 930 unit + 14 e2e web, cobertura ops 93.42/83.56/92.21/94.73 — commit: 66b1c58 — merge: 2d1f10a — 2026-08-10
     Id local (`local:<uuid>`) + mapa persistido resolve o encadeamento cadastro→movimentação; `scope` por recurso serializa o replay.
     PENDENTE-MANUAL: `useChangeActivityStatus` ficou fora da fila (exige rede) — `api.activities.changeStatus` não aceita `RequestOptions`/`Idempotency-Key`.
```

## Resumo final

**Todas as 5 stories fecharam [OK].** O `ops.fonte` passou a ser offline-first de ponta a ponta e o
backend deduplica escrita repetida.

O que entrou:

- **172 (backend):** header `Idempotency-Key`, tabela `idempotency_keys`, decorator `@Idempotent()`
  + interceptor global (espelhando `@Audit`), limpeza agendada. Aplicado nas escritas de campo
  (censo, resident PATCH, ocorrência, dispensa, almoxarifado, venda de rua, atividade e comentário).
  `@fonte/api-client` passa a chave por chamada via `RequestOptions`. Postman atualizado.
- **168:** cache do React Query persistido em AsyncStorage por **allowlist** de query keys (LGPD),
  NetInfo → `onlineManager`, AppState → `focusManager`, `OfflineBanner`, limpeza do cache no logout
  e na sessão expirada. Erro de rede continua não sendo sessão expirada.
- **169:** outbox persistida — `mutationKey` + `setMutationDefaults` + `offlineFirst` nos seis
  domínios de campo, dead-letter via `MutationCache.onError`, update otimista onde a resposta
  imediata importa, selo "Pendente" nos cards.
- **170:** tela `/sync` (pendentes × falhados), reenvio preservando a chave de idempotência,
  descarte só por ação explícita do operador, badge na home, aviso de que sair do app apaga a fila.
- **171:** fluxos de campo adaptados — id local `local:<uuid>` com mapa persistido resolvendo
  cadastro→movimentação, `scope` por recurso serializando o replay, `fieldSubmit` acabando com o
  botão girando offline, e avisos claros nos fluxos que exigem rede.

Cobertura do `ops.fonte` subiu a cada story: 91.3/81.12/89.97/93.1 → **93.42/83.56/92.21/94.73**
(gate 90/81/89/93). Backend: 1469 unit + 522 e2e verdes, sem regressão.

### PENDENTE-MANUAL

1. **Rebuild nativo do APK** — `@react-native-community/netinfo` traz módulo nativo; o APK atual não
   o tem. Próximo build exige `expo prebuild`/rebuild (recipe conhecida do build local Android).
2. **Maestro não rodou** (`pnpm test:ops` / `test:app`) — sem emulador ou dispositivo no ambiente.
   Nenhum yaml foi alterado; os fluxos equivalentes estão cobertos pelo e2e web.
3. **Mudança de situação de atividade fora da fila** — `api.activities.changeStatus` não aceita
   `RequestOptions`/`Idempotency-Key`; hoje a ação exige rede e avisa na tela. Colocá-la na fila
   pede uma story tocando `packages/api-client` + o endpoint no dedupe da 172.

### Branches (preservadas, sem push)

`feat/story-172-idempotencia-escrita-backend` ·
`feat/story-168-ops-offline-persistencia-cache-e-rede` ·
`feat/story-169-ops-offline-outbox-e-replay` ·
`feat/story-170-ops-offline-tela-pendencias-sincronizacao` ·
`feat/story-171-ops-offline-fluxos-de-campo`

### Reproduzir os gates

```bash
pnpm docker:up
pnpm test:setup
pnpm build:types && pnpm build:api-client
pnpm dev:api:test                 # porta 3001, em outro terminal
pnpm test:api                     # 1469 unit
pnpm test:api:e2e                 # 522 e2e
pnpm test:api:cov                 # thresholds de cobertura do backend
pnpm test:ops:unit                # 930 unit do ops (com cobertura/gate 90/81/89/93)
pnpm --filter ops.fonte test:e2e:web   # 14 specs Playwright (inclui os de offline)
```
