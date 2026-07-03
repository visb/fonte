# Plan: Tela de import em lote — upload planilha, fila e cards inline

> **Status: PLANEJAMENTO.** Story-filha 4 de [[100]]. Depende de [[101]] e [[102]]. Após aprovação.

## Context

Filha 4 do epic [[100]]. A tela nova do `adm.fonte` que orquestra o import em lote: upload da
planilha de referência, área de drag-drop das fichas `.docx`, e a **fila processada em tempo real**
com um card por ficha. A ficha completa/editável e a aprovação ficam na filha [[105]] (o card só
expõe os botões).

### Decisões travadas

- **Batch size configurável** via constante `IMPORT_BATCH_SIZE = 5` (fácil de mudar). No máximo N
  fichas em extração simultânea; as demais aguardam na fila.
- Duas etapas na mesma página: (1) upload da planilha (obrigatório antes de arrastar fichas);
  (2) área de drag-drop / click-to-open para múltiplos `.docx`.
- Cada ficha vira um card com estado: `queued` → `processing` → `ready` | `error`.
- Ao extrair (`ready`), o card mostra inline: **foto, data de entrada, data de saída (se houver),
  casa atual (se ainda interno)**, **resumo** (ok / N alertas), e **badge de conflito** (chama a
  checagem de conflito da [[103]]). Botões **Aprovar** e **Ver ficha** ficam no card mas a ação
  completa é da [[105]].

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **Página** `BulkImportPage` em `features/residents/pages/` + rota nova (ex:
  `/residents/import-lote`) e ponto de entrada (botão na `ResidentsPage`). Page só orquestra —
  sem fetch direto (segue CLAUDE.md).
- **Componentes** (respeitar limite ~150 linhas, extrair):
  - `SpreadsheetUploadStep` — dropzone da planilha; ao subir, chama `useParseSpreadsheet` e guarda
    as `rows` no estado da sessão.
  - `FichaDropzone` — área drag-drop / click-to-open aceitando múltiplos `.docx`.
  - `ImportQueue` — lista dos cards.
  - `ImportItemCard` — um item da fila (foto, entrada/saída, casa, resumo, badge de conflito,
    botões). **Extrair o card** (nunca item inline em lista, CLAUDE.md).
- **Hooks** em `features/residents/hooks/useBulkImport.ts`:
  - `useParseSpreadsheet()` — mutation → `api.residents.parseSpreadsheet` ([[101]]).
  - `useImportQueue(rows)` — controla a fila com concorrência limitada a `IMPORT_BATCH_SIZE`,
    chamando `api.residents.parseDocxWithSpreadsheet` ([[102]]) por ficha; expõe estado por item.
  - `useCheckImportConflict()` — consulta conflito ([[103]]) quando o item fica `ready`.
  - Query keys em `lib/queryKeys.ts` (nunca literal).
- **Estados** via `LoadingState`/`EmptyState`/`ErrorState`; erros via `getErrorMessage`. `EmptyState`
  na fila vazia ("Arraste as fichas .docx para começar"); desabilitar a dropzone de fichas enquanto
  a planilha não foi carregada.
- **Configuração de exibição** (labels, cores de status, textos) em `features/residents/constants.ts`.

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL do `adm.fonte`)**:
  - `useImportQueue`: respeita `IMPORT_BATCH_SIZE` (nunca mais que N `processing` ao mesmo tempo);
    transição de estados `queued→processing→ready/error`; erro num item não derruba a fila.
  - `ImportItemCard`: renderiza foto/entrada/saída/casa; mostra "N alertas" a partir de `warnings`;
    esconde "casa atual" quando há `exitDate`; badge de conflito quando a checagem retorna conflito.
  - `SpreadsheetUploadStep`/`FichaDropzone`: bloqueia fichas sem planilha; rejeita não-`.docx`.
- **`pnpm test:adm`** (Playwright, estender `e2e/residents.spec.ts` ou novo
  `bulk-import.spec.ts`): subir planilha (fixture) → arrastar 2+ `.docx` → cards processam e ficam
  `ready` com os dados inline; item com conflito mostra o alerta. (Aprovação/persistência coberta
  em [[105]].)

## Fora de escopo

- Modal da ficha completa editável e a aprovação/persistência (fica em [[105]]).
- Endpoints backend (fichas [[101]]/[[102]]/[[103]]).
- Reprocessar/retentar item com erro além de remover e re-arrastar (retry fino fica para depois).
