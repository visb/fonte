# PROGRESS — ledger ativo

Rodada aberta por `/autorun`. Protocolo: `stories/AUTORUN.md`. Ao encerrar, arquivar em
`stories/done/PROGRESS-163-164.md` e restaurar o stub.

## Config da rodada

- **Tema:** assinatura por upload (163) + carnê por acolhimento (164)
- **Ordem:** 163 → 164
- **Branch base:** `main` (72b249d)
- **Deps rígidas:** nenhuma — stories independentes; se 163 bloquear, 164 segue.
- **Cuidados:**
  - **163 é frontend-only** (`apps/adm.fonte`): sem migration, sem `build:types`/`build:api-client`,
    **sem alteração no Postman**. Gates: `pnpm --filter adm.fonte test:unit:cov` (≥90 do tocado, sem
    reduzir `features/auth`) + `pnpm test:adm`. Mocks obrigatórios de `canvas.getContext`/`toBlob` e
    `createImageBitmap` (não existem no jsdom).
  - **164 muda schema e contrato:** migration nova (timestamp **acima de 1783037000000**, nunca
    editar migration aplicada), `packages/api-client/src/types.ts`, `pnpm build:types` +
    `pnpm build:api-client`, `pnpm migration:run:test` (up **e** revert) e **Postman atualizado**
    (`GET /residents/:id/receivables` ganha `admissionId`; ordem de `/admissions` documentada).
    Coluna `admission_id` **nullable** — não pôr `NOT NULL`. Gates: `pnpm test:api:cov`,
    `pnpm test:api:e2e`, `pnpm --filter adm.fonte test:unit:cov`, `pnpm test:adm`.
    Seed de teste precisa de filho com 2 acolhimentos (incl. `exit_date < entry_date`).
  - **Ambos:** cobertura ≥90 do escopo trava o merge. Sem push, sem PR.
- **Dependências externas sem credencial:** nenhuma nesta rodada.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 163 — enviar imagem como assinatura (upload) no perfil | [OK] | unit 1583/1583, e2e 172/172 | 553c2dd | a16e793 |
| 2 | 164 — carnê de contribuição por acolhimento | [ ] | — | — | — |

## Log

```
[OK] 163 — testes: adm unit 1583/1583 (features/auth 98.78% stmts), e2e adm 172/172 — commit: 553c2dd — merge: a16e793 — 2026-08-08
     nota: decodeImageFile precisou de fallback createImageBitmap → <img> (Chromium recusa PNG válido com InvalidStateError).
```

## Resumo final

<vazio>
