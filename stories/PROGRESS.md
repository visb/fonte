# PROGRESS — ledger ativo

Rodada aberta: **153-154 — documentos: variável de responsável + margem de página no PDF**.

## Config da rodada

- **Tema:** geração de documentos (templates + PDF) — uma variável condicional nova e a correção da
  margem de página em documentos multipágina.
- **Ordem:** 153 → 154.
- **Branch base:** `main` (a cada story, branch nova a partir da `main` já com o merge anterior).
- **Deps rígidas:** nenhuma entre as duas. Ambas tocam
  `services/api/src/.../document-template.service.ts`, então a ordem serial evita conflito de merge;
  se 153 bloquear, 154 segue normalmente.
- **Cuidados da rodada:**
  - **Sem migration** nas duas stories (153 é in-memory no render; 154 é CSS/opção do puppeteer).
  - **Sem mudança de rota/DTO/response** ⇒ **não** mexer em `fonte-api.postman_collection.json`.
  - **Contratos:** 153 não muda `packages/types`/`api-client`. 154 muda **`packages/doc-styles`** —
    rebuildar (`pnpm build:types && pnpm build:api-client` + build do doc-styles) antes de rodar os
    testes do adm e da api, senão o `dist/` velho mascara a mudança.
  - **154 tem conferência visual obrigatória** (margem renderizar na página 2) que nenhum teste
    cobre; registrar como PENDENTE-MANUAL no log, sem travar a fila.
  - **154 tem regressão aceita e declarada**: documentos de 1 página com 1027–1075px de conteúdo
    passam a ocupar 2 páginas (decisão 6 da story).
  - **Gate:** `pnpm test:api` + `pnpm test:api:cov` (≥90 do escopo tocado),
    `pnpm --filter adm.fonte test:unit:cov`, `pnpm build:api`; e2e da 154 (`pnpm test:api:e2e`)
    exige `pnpm test:setup` + `pnpm dev:api:test`.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 153 — variável `{{responsibleWithRelationship}}` | [OK] | api 1295/1296 · adm 1435/1435 | `d26a9d1` | `b38c8d0` |
| 2 | 154 — margem de página em todas as páginas do PDF | [ ] | — | — | — |

## Log

[OK] 153 — testes: `test:api` 1295/1296, `document-template.service.ts` 95.67% stmts / 89.41% branches;
adm `test:unit:cov` 1435/1435, arquivos tocados 100% — commit: `d26a9d1` — merge: `b38c8d0` — 2026-08-02.
**Nota (não é da story):** `src/database/clear-bucket.spec.ts:144` já falhava na `main` limpa — o
`buildStorage()` lê o `.env` ambiente, que tem credenciais S3, então `isS3Mode()` volta `true`.
Verificado rodando o spec na `main` sem nenhuma mudança da story. Vale uma story pra isolar esse spec do ambiente.

## Resumo final

<vazio>
