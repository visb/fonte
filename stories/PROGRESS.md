# PROGRESS — ledger ativo

Rodada de autorun **185–187** — aberta em 2026-08-17.

## Config da rodada

- **Tema:** fechar os três achados da rodada 182–184 — ficha do filho hidratada sem `houseId`,
  carnê inacessível ao servo e flakiness não medida da suíte Maestro.
- **Ordem:** 185 → 186 → 187
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** 185 → 186 — as duas editam `apps/ops.fonte/e2e/product-contributions.yaml`
  (185 remove o `swipe` de contorno, 186 troca o login para operador). Rodar 185 antes evita
  conflito no yaml e uma passada extra de Maestro. 187 é independente das duas.
- **Escopo técnico por story:**
  - **185** — frontend-only: `apps/ops.fonte/lib/offline/store/hydrate.ts` + o yaml do e2e.
    Sem backend, sem contratos, sem migration, sem Postman.
  - **186** — `packages/types` (`ResidentReceivableSummary`), `packages/api-client`
    (`residents.getReceivablesSummary`), `services/api` (rota `GET :id/receivables/summary` +
    projeção no `ReceivableService` + `offline-sync.service.ts`), `apps/ops.fonte`
    (`useProductContributions`, `lib/receivables.ts`), **Postman**, `BUSINESS_RULES.md`,
    `docs/lgpd/DIAGNOSTICO_LGPD.md`. Sem migration.
  - **187** — bancada: `apps/ops.fonte/scripts/maestro-flakiness-run.js` + unit dos puros +
    `.gitignore`. Entregável é o laudo em `stories/done/187-laudo-maestro-flakiness.md`.
- **Cuidados da rodada:**
  - **Sem emulador Android conectado** no início da rodada (`adb devices` vazio) ⇒ **toda validação
    Maestro (`pnpm test:ops`) é PENDENTE-MANUAL**, e o **experimento da 187 não pode rodar**
    (a 187 tende a fechar PARCIAL: código + unit verdes, laudo pendente).
  - **186 toca contratos** ⇒ `pnpm build:types && pnpm build:api-client` antes de subir API/apps,
    e a suíte do `adm.fonte` tem que passar **sem mudança de expectativa** (regressão da rota cheia).
  - **Postman é obrigatório na 186** (endpoint novo) — `fonte-api.postman_collection.json`.
  - Nenhuma migration nova na rodada; não editar migration aplicada.
  - Gate de cobertura por story: `services/api` baseline 92.55 / 79.85 / 90 / 94.32
    (thresholds 90/75/87/92); `ops.fonte` baseline 94.5 / 85.2 / 93.15 / 95.6
    (thresholds 90/81/89/93). Não reduzir.
  - Suítes e2e são idempotentes (story 182): `pnpm test:setup` só na primeira vez.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 185 — ficha do filho hidratada do store não nasce fresca | [ ] | | | |
| 2 | 186 — recorte do carnê para o servo | [ ] | | | |
| 3 | 187 — diagnóstico da flakiness da suíte Maestro | [ ] | | | |

## Log

```
```

## Resumo final

<vazio até o fim da rodada>
