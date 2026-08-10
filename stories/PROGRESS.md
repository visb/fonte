# PROGRESS — ledger ativo

Rodada aberta: **offline-first do ops.fonte (epic 167) + idempotência de escrita no backend**.

## Config da rodada

- **Tema:** `ops.fonte` offline-first (epic [[167]]) com o pré-requisito de backend [[172]].
- **Ordem:** 172 → 168 → 169 → 170 → 171.
- **Branch base:** `main` (atual a cada story — cada branch parte da main já mergeada).
- **Deps rígidas (cadeia):** 172 antes de 169 (idempotência do replay); 168 antes de 169
  (persistência/rede antes da outbox); 169 antes de 170 (dead-letter antes da tela `/sync`);
  170 antes de 171 (fluxos de campo dependem da fila + tela de pendências). Se uma bloquear,
  as seguintes da cadeia bloqueiam junto — **não pular**.
- **167 não é implementada** — é o documento do epic; arquivar em `done/` só ao fechar 171.

### Cuidados da rodada

- **172 corrige a story 169.** O `ValidationPipe` da API usa `forbidNonWhitelisted: true`, então
  campo extra no body é 400. A decisão 9 da [[169]] ("campo extra ignorado pelo backend") está
  errada e deve ser reescrita para o header `Idempotency-Key` na implementação da 172.
- **Migration nova em 172** (`idempotency_keys`): timestamp posterior a
  `1783037400000-AddAdmissionToReceivables.ts`; nunca editar migration aplicada; rodar
  `migration:run:test` antes dos e2e.
- **Contratos:** 172 mexe em backend/contrato ⇒ atualizar `fonte-api.postman_collection.json` e
  rodar `pnpm build:types && pnpm build:api-client` se `packages/types`/`api-client` mudarem.
  168–171 **não** tocam backend (decisão 6 do epic) ⇒ sem Postman, sem rebuild de contrato.
- **LGPD (168):** persistência de cache por **allowlist** de query keys em
  `lib/offline/constants.ts` — nunca virar denylist; limpar cache no logout e na sessão expirada.
- **Invariante do app:** `mutationKey` + `setMutationDefaults` + `networkMode: 'offlineFirst'` nos
  fluxos de campo; `mutationFn` inline é proibido (não serializa, perde lançamento no restart).
- **Testes de offline** vão no Playwright web (`apps/ops.fonte/e2e-web/`, `context.setOffline`) —
  Maestro não controla rede.
- **Gate:** suíte da área tocada verde + cobertura ≥ 90 no pacote tocado antes de qualquer merge.
- **Sem push, sem PR.**

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 172 — idempotência de escrita no backend | [OK] | api 1469 unit / 522 e2e / api-client 286 | df482dc | e8bed67 |
| 2 | 168 — persistência de cache e estado de rede | [OK] | ops 670 unit / 7 e2e web | da0e35b | 75526da |
| 3 | 169 — outbox e replay de escrita | [ ] | — | — | — |
| 4 | 170 — tela de pendências de sincronização | [ ] | — | — | — |
| 5 | 171 — fluxos de campo offline | [ ] | — | — | — |

## Log

```
[OK] 172 — testes: api 1469 unit + 522 e2e + api-client 286, cobertura do escopo 100/90+ — commit: df482dc — merge: e8bed67 — 2026-08-09
     Header `Idempotency-Key` + tabela `idempotency_keys` + `@Idempotent()`/interceptor global. Decisão 9 da 169 já corrigida no plano dela.
[OK] 168 — testes: ops 670 unit + 7 e2e web, cobertura ops 92.25/82.32/90.97/93.8 — commit: da0e35b — merge: 75526da — 2026-08-09
     PENDENTE-MANUAL: `@react-native-community/netinfo` é módulo nativo ⇒ próximo APK exige prebuild/rebuild.
     Maestro (`pnpm test:ops`) não rodou — sem emulador no ambiente; fluxos cobertos pelo e2e web.
```

## Resumo final

<vazio>
