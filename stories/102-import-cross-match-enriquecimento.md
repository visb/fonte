# Plan: Cross-match planilha × ficha e enriquecimento da extração

> **Status: PLANEJAMENTO.** Story-filha 2 de [[100]]. Depende de [[101]]. Implementar após aprovação.

## Context

Filha 2 do epic [[100]]. Depois que a planilha vira linhas normalizadas ([[101]]) e a ficha `.docx`
é extraída pela IA (`DocxParserService.parseDocx`), esta story **casa a ficha com a linha da
planilha** e **enriquece** o resultado da extração: a planilha é a fonte de verdade de data de
entrada, data de saída, contato familiar e histórico de contribuição; a ficha traz o resto e a foto.

### Decisões travadas

- **Cross-match no backend** (é regra de negócio: normalização + prioridade de campos). O front
  envia o `.docx` **e** as linhas da planilha (`SpreadsheetImportRow[]`) já obtidas em [[101]];
  o backend faz o merge e devolve o resultado enriquecido pronto para revisão.
- **Match por CPF primeiro** (dígitos, quando ambos têm cpf); **fallback por nome normalizado**
  (sem acento/lowercase — util da story [[32]]). Match único → enriquece; múltiplos candidatos →
  não enriquece e emite warning "ambíguo"; nenhum → warning "sem correspondência na planilha".
- **Prioridade de campos da planilha:** `entryDate`, `exitDate`, `familyContact` (→ vira/atualiza
  um relative de contato) e `contributionMonths` vêm da planilha quando presentes; se a ficha
  também trouxe e **divergem**, manter o valor da planilha e registrar warning de divergência
  (`{ campo: 'ficha=X, planilha=Y' }`). Demais campos permanecem os da ficha.
- `contributionMonths` viaja no payload de preview para ser persistido no commit ([[103]]); **não é
  persistido aqui**.

## Desenho

### Backend (`services/api`, módulo `resident`)

- **Estender o endpoint de extração** em vez de criar outro fluxo: novo
  `POST /residents/import/parse-docx-with-spreadsheet` (guard ADMIN, COORDINATOR) que recebe o
  `.docx` (multipart) **+** o campo `rows` (JSON string de `SpreadsheetImportRow[]`) no mesmo
  `multipart/form-data`. Alternativa considerada: manter `parse-docx` e fazer o match numa segunda
  chamada — descartada por exigir 2 idas ao servidor por ficha.
- **Service** `DocxParserService` (ou novo `ImportMatchService` que compõe o parser): após
  `parseDocx`, chamar `matchAndEnrich(parseResult, rows)`:
  - Acha a linha correspondente (CPF → nome normalizado).
  - Mescla os campos priorizados; injeta/atualiza o relative de contato familiar.
  - Anexa `contributionMonths` ao resultado.
  - Preenche `warnings` de divergência/ambiguidade/sem-match.
- **Retorno** estende `ParseDocxResult`:
  ```ts
  interface ImportPreviewResult extends ParseDocxResult {
    matchedHouseName: string | null;   // casa da planilha (aba)
    contributionMonths: string[];
    matchStatus: 'matched' | 'ambiguous' | 'unmatched';
  }
  ```

### Tipos / api-client compartilhados

- `packages/types`: `ImportPreviewResult`, `matchStatus`.
- `packages/api-client/src/modules/residents.ts`: `parseDocxWithSpreadsheet(formData)`.

### Postman

- Adicionar `POST /residents/import/parse-docx-with-spreadsheet` em
  `fonte-api.postman_collection.json`.

## Validação

Gate: **código novo sem teste não fecha a story** (`pnpm test:api:cov`; sem
`skip`/`only`/`xfail` injustificado).

- **`pnpm test:api`** (unit `matchAndEnrich`, mockando `parseDocx`):
  - Match por CPF; match por nome normalizado quando sem cpf; **acento/caixa não impedem o match**.
  - Múltiplos candidatos → `matchStatus: 'ambiguous'`, sem enriquecer, com warning.
  - Sem correspondência → `matchStatus: 'unmatched'`, warning, resultado = só a ficha.
  - Divergência ficha×planilha em `entryDate` → mantém planilha + warning de divergência.
  - `familyContact` da planilha vira/atualiza relative de contato.
  - `contributionMonths` propagado no resultado.
- **`pnpm test:api:e2e`**: `POST /import/parse-docx-with-spreadsheet` com `.docx` fixture + `rows`
  → 200 com `matchStatus` e campos enriquecidos; guard 403; validação de `rows` malformado → 400.
- `pnpm build:types && pnpm build:api-client` (mexeu em contratos).

## Fora de escopo

- Persistir resident/relatives/contribuições (fica em [[103]]).
- Detecção de conflito com filhos já cadastrados (fica em [[103]]).
- UI (fica em [[104]]/[[105]]).
