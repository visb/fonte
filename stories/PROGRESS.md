# PROGRESS — ledger ativo

Rodada aberta via `/autorun 165+166`. Protocolo: `stories/AUTORUN.md`.

## Config da rodada

- **Tema:** sessão expirada nos apps Expo (165) + cobertura e2e da aba de anexos do filho (166).
- **Ordem:** 165 → 166.
- **Branch base:** `main` (a partir de `5262852`).
- **Deps rígidas:** nenhuma. As stories são independentes; 165 vem antes só porque toca
  `packages/api-client` — rebuildar o `dist/` antes de rodar a suíte adm da 166.
- **Cuidados da rodada:**
  - **Contratos:** 165 pode alterar `ApiClientConfig.onUnauthorized` em `packages/api-client`.
    Se alterar, `pnpm build:api-client` (e `build:types` se `packages/types` mudar) **antes** de
    subir API/adm — sem `dist/` a suíte adm inteira quebra. Manter compatível com a assinatura sem
    parâmetro usada hoje pelo `adm.fonte`.
  - **Migrations:** nenhuma prevista nas duas stories. Se surgir, criar nova (nunca editar aplicada)
    + `migration:run:test`.
  - **Postman:** 166 declara explicitamente que **não** altera endpoint ⇒ não mexer na coleção.
    165 também não toca rota. Se qualquer endpoint mudar, atualizar
    `fonte-api.postman_collection.json`.
  - **Dep externa sem credencial:** nenhuma prevista (sem WhatsApp/pagamento/bucket/Sentry no
    escopo). Se aparecer, implementar atrás de interface + mock e marcar PENDENTE-MANUAL.
  - **Gate de cobertura ≥ 90** no escopo tocado, além da suíte verde, antes de qualquer merge.
  - **166 exige a suíte adm inteira verde** (não só o spec novo) e **duas execuções seguidas sem
    recriar o banco**, para provar que o `afterAll` limpa a fixture de templates.
  - **165 exige `test:api-client` + `test:ops:unit` + `test:app:unit`** e smoke `test:adm`
    (único consumidor atual de `onUnauthorized`).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 165 — sessão expirada redireciona para login no ops.fonte e app.fonte | [OK] | api-client 276 · ops 604 · app 128 · adm e2e 173 | `02565d0` | `0d302e3` |
| 2 | 166 — e2e da aba de anexos do filho com fixture de templates via API | [ ] | — | — | — |

## Log

[OK] 165 — testes: api-client 276/276, ops:unit 604/604, app:unit 128/128, adm e2e 173/173;
cobertura ops 92.11 / app 92.47 / `client.ts` 100 — commit: `02565d0` — merge: `0d302e3` — 2026-08-09
— nota: `test:api-client:cov` já era vermelho na main (threshold 99% linhas vs. baseline 95.01%,
buraco em `src/modules/residents.ts`, fora do escopo); a story subiu para 95.75%.

## Resumo final

<vazio>
