# Plan: Parse da planilha de referência de filhos (.xlsx)

> **Status: PLANEJAMENTO.** Story-filha 1 de [[100]]. Implementar só após aprovação.

## Context

Filha 1 do epic [[100]]. Primeiro passo do import em lote: o usuário faz upload da planilha de
referência e o backend a transforma numa lista normalizada de linhas, uma por filho, agrupada por
casa. Essa lista alimenta o cross-match da story [[102]] e o preenchimento de contribuições no commit
([[103]]).

A planilha (`stories/lista-filhos.xlsx`, dados desatualizados mas representativos do formato):
- **Uma aba por casa** — o nome da aba é o nome da casa.
- **Ignorar a aba "curso biblico"** (case-insensitive, com/sem acento).
- Colunas por linha: **nome, cpf, contato de familiar, data de entrada, data de saída, histórico
  de contribuição familiar**. O histórico de contribuição é a lista de meses/competências pagas
  (formato exato a confirmar lendo o arquivo — pode ser colunas por mês ou uma célula com lista).

### Decisões travadas

- Endpoint **stateless**: faz o parse e devolve o JSON normalizado; **não persiste nada**. O front
  guarda o resultado em memória durante a sessão de import.
- **Chave de match** por linha: `cpf` (dígitos, sem máscara) e `nameNormalized` (lowercase, sem
  acento, trim, espaços colapsados — reusar a normalização da story [[32]]).
- Datas normalizadas para ISO `YYYY-MM-DD`; valores de contribuição vira lista de meses ISO
  (`YYYY-MM-01`) para casar com `BulkCreateContributionsDto`.
- Linhas sem nome **e** sem cpf são descartadas (linha vazia/rodapé); contabilizar em `skipped`.

## Desenho

### Backend (`services/api`, módulo `resident`)

- **Nova lib de parse** `SpreadsheetImportService` (ou `spreadsheet-parser.service.ts` ao lado de
  `docx-parser.service.ts`). Usar biblioteca de leitura de `.xlsx` já disponível ou adicionar
  `exceljs` (preferir `exceljs`; confirmar se `xlsx`/`sheetjs` já é dependência antes de adicionar).
- **Endpoint** `POST /residents/import/parse-spreadsheet` (guard ADMIN, COORDINATOR), upload via
  `FileInterceptor` com `memoryStorage` e `fileFilter` para o mime de `.xlsx`
  (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), `MaxFileSizeValidator`
  (ex: 10 MB). Espelhar o padrão do `parseDocx`.
- **Retorno** `ParseSpreadsheetResult`:
  ```ts
  interface SpreadsheetImportRow {
    houseName: string;          // nome da aba
    name: string | null;
    nameNormalized: string | null;
    cpf: string | null;         // só dígitos
    familyContact: string | null;
    entryDate: string | null;   // ISO
    exitDate: string | null;    // ISO
    contributionMonths: string[]; // ['2023-01-01', ...]
  }
  interface ParseSpreadsheetResult {
    rows: SpreadsheetImportRow[];
    houses: string[];           // abas consideradas
    skipped: number;            // linhas descartadas
    ignoredSheets: string[];    // ['curso biblico']
  }
  ```
- **Service**: iterar abas, pular a de curso bíblico, mapear colunas por cabeçalho (tolerar
  variação de acento/caixa nos títulos), normalizar datas e contribuições. Logar via `Logger`.

### Tipos / api-client compartilhados

- `packages/types`: `SpreadsheetImportRow`, `ParseSpreadsheetResult`.
- `packages/api-client/src/modules/residents.ts`: `parseSpreadsheet(formData)`.

### Postman

- Adicionar `POST /residents/import/parse-spreadsheet` em `fonte-api.postman_collection.json`.

## Validação

Gate: **código novo sem teste não fecha a story** (`pnpm test:api:cov`; sem
`skip`/`only`/`xfail` injustificado).

- **`pnpm test:api`** (unit do parser — usar uma fixture `.xlsx` pequena em `test/fixtures/`):
  - Lê abas como casas; **ignora a aba "curso biblico"** (e variações de caixa/acento).
  - Normaliza cpf (só dígitos), nome (sem acento/lowercase), datas para ISO.
  - Converte histórico de contribuição em lista de meses ISO.
  - Descarta linha sem nome e sem cpf, contabilizando em `skipped`.
  - Arquivo inválido/corrompido → `BadRequestException`.
- **`pnpm test:api:e2e`** (`test/residents.e2e-spec.ts` ou novo `resident-import.e2e-spec.ts`):
  upload da fixture → 200 com `rows`/`houses`/`ignoredSheets`; guard 403 p/ role sem permissão;
  não-`.xlsx` → 400.
- `pnpm build:types && pnpm build:api-client` (mexeu em contratos).

## Fora de escopo

- Cross-match com a ficha `.docx` (fica em [[102]]).
- Persistir qualquer coisa (endpoint é stateless).
- Interface de upload (fica em [[104]]).
- Mapear colunas customizadas pela UI (cabeçalhos fixos no parser).
