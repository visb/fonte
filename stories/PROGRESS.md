# PROGRESS — ledger ativo

## Config da rodada

- **Tema:** PDF combinado dos documentos do filho para impressão em lote (story 152).
- **Ordem:** 152 (rodada de uma story).
- **Branch base:** main (`a6fa647`).
- **Deps rígidas:** nenhuma.
- **Cuidados da rodada:**
  - **Dep nova**: `pdf-lib` em `services/api` (merge de PDF). `pnpm install` no filtro certo; sem binário nativo.
  - **Contrato muda**: `packages/api-client` ganha `downloadCombinedDocumentsPdf` → rodar
    `pnpm build:types && pnpm build:api-client` antes das suítes do adm.
  - **Postman obrigatório**: `fonte-api.postman_collection.json` com o `POST :id/documents/combined-pdf`.
  - **Sem migration** — story não toca schema.
  - **Convenção de margem da story 24 é intocável**: `page.pdf` com margin zerada, margem real vem do
    `padding` do body no `DOCUMENT_PRINT_CSS`. Por isso o merge é de N PDFs (pdf-lib), não HTML
    concatenado com `page-break-after`.
  - **Puppeteer no CI local**: `generatePdf` já roda nos testes existentes; reusar o mesmo browser
    singleton e fechar cada `page` no `finally`.
  - **Cobertura ≥90** do escopo tocado. Scripts: api `pnpm test:api:cov`; adm
    `pnpm --filter adm.fonte test:unit:cov` (**não** `test:cov`).
  - `AttachmentsTab.tsx` tem 403 linhas — a story exige decompor (limite ~150 do CLAUDE.md).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 152 — PDF combinado dos documentos para impressão em lote | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
