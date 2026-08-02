# PROGRESS — ledger ativo

## Config da rodada

- **Tema:** variável `{{residentPhoto}}` — foto do filho nos documentos gerados.
- **Stories:** 157 (rodada de uma story só).
- **Ordem:** 157.
- **Branch base:** `main` (af5a49e).
- **Deps rígidas:** nenhuma. Não depende de story em aberto.
- **Cuidados da rodada:**
  - **Sem migration, sem endpoint novo, sem mudança de contrato** ⇒ **não** atualizar
    `fonte-api.postman_collection.json`; `build:types`/`build:api-client` não são exigidos pela
    story (mas rodam no bootstrap porque a suíte adm precisa do `dist/` do api-client).
  - **Refatoração de código já testado, nos dois lados** — é o risco principal:
    - backend: extrair `replaceBlockToken` do caminho hoje exclusivo de `{{signature}}`
      (`SIG_WRAP` → `TOKEN_WRAP`);
    - adm: generalizar `SignaturePlaceholder.ts` numa fábrica `createTokenPlaceholder`.
    Em ambos, **os testes existentes de assinatura (stories 128/135/136/137/141) rodam
    inalterados** — são o critério de que a generalização não mudou comportamento. Exports e
    atributos DOM da assinatura (`SIGNATURE_TOKEN`, `findSignatureRanges`,
    `buildSignatureDecorations`, `data-signature-placeholder`, `data-signature-remove`) preservados.
  - Foto **nunca** bloqueia a geração: `residentPhoto` entra em `ALWAYS_AVAILABLE`
    (`documentFields.ts`), e `useDocumentGeneration.ts` **não muda**.
  - Modo local serve `/uploads/residents/…`, que o puppeteer não resolve → `toDataUri`
    (regressão da story 135). Canonicalizar a URL antes de assinar.
  - **Gate de cobertura ≥90** do código tocado: `pnpm test:api:cov` +
    `pnpm --filter adm.fonte test:unit:cov`. E2E: `test:api:e2e` e `test:adm` (Playwright, exige adm
    em 5174 + API de teste em 3001).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 157 — variável `{{residentPhoto}}` nos documentos | [ ] | — | — | — |

## Log

<vazio>

## Resumo final

<vazio>
