# Plan: UF padrão "PR" no import de filhos (IA e lote)

## Context

Bloco do BACKLOG: **melhorias no import de filhos** (fichas via IA + planilha em lote).
Contexto compartilhado com as stories 120–122 (mesmo fluxo de importação/aprovação de fichas).

A comunidade Fonte de Misericórdia fica no Paraná e a esmagadora maioria dos filhos
acolhidos é do estado. Hoje, quando a UF não é extraída, o campo fica vazio e o operador
precisa preencher manualmente em quase toda ficha.

**Decisão de produto:** ao importar, assumir `state = "PR"` como default quando a UF não veio
preenchida. É só um default de conveniência — permanece **editável** na revisão da ficha e
**não sobrescreve** UF já extraída (ex: IA leu "SC" → mantém "SC").

**Decisão de design (travada):** aplicar o default no **frontend (adm.fonte)**, nos pontos onde
o preview/extração vira valores do formulário. É o ponto único por caminho, editável antes de
salvar, e testável via vitest. Não mexer no backend (parsers continuam retornando `state: null`
quando não acham — a verdade da extração não muda).

Os dois caminhos do import montam os valores iniciais do form em lugares distintos:

- **IA (ficha única):** `pages/ImportResidentPage.tsx` passa `initialValues={parseResult.resident}`
  para `components/import/ImportReviewStep.tsx`, que faz merge em `defaultValues` e no `reset`.
- **Lote (planilha):** `components/import/ImportFichaModal.tsx` monta os valores via
  `previewToFormValues(preview.resident)` em `lib/importCommit.ts`.

Ambos compartilham `residentSchema` + `ResidentFormSections`, mas o pré-carregamento dos valores
é separado — por isso o default entra nos **dois** pontos.

## Desenho

Regra única de default (helper compartilhado para não repetir a constante):

```ts
// lib/importCommit.ts (ou lib próximo)
export const DEFAULT_IMPORT_STATE = 'PR';

/** UF do import: mantém a extraída; cai no default só quando vazia. */
export function defaultImportState(state: unknown): string {
  return (typeof state === 'string' ? state.trim() : '') || DEFAULT_IMPORT_STATE;
}
```

1. **Lote — `lib/importCommit.ts` → `previewToFormValues`:** ao extrair os `FORM_KEYS`, passar
   `state` por `defaultImportState(...)`. Cobre `ImportFichaModal` e `buildCommitPayload`.

2. **IA — `components/import/ImportReviewStep.tsx`:** normalizar `initialValues.state` com
   `defaultImportState` antes do merge em `defaultValues` **e** no `reset` do `useEffect`
   (os dois pontos que hoje espalham `...initialValues`), para o valor sobreviver ao
   re-upload/StrictMode.

3. Nada muda no schema/DTO/backend. O campo continua opcional; só o valor inicial exibido muda.

Comportamento resultante:
- UF extraída não-vazia → preservada.
- UF vazia/ausente (IA sem achar, ou lote sem coluna UF) → "PR".
- Operador pode trocar a UF no form antes de aprovar.

## Validação

Camada tocada: **frontend adm.fonte** (vitest + RTL). Backend intocado.

- **`lib/importCommit.test.ts`** (novo ou estendido):
  - `defaultImportState`: retorna a UF extraída quando preenchida (`'SC'` → `'SC'`);
    retorna `'PR'` para `null`/`undefined`/`''`/`'   '`.
  - `previewToFormValues`: preview sem `state` → `state: 'PR'`; preview com `state: 'SC'` → `'SC'`.
- **`components/import/ImportReviewStep.test.tsx`** (estender o existente):
  - `initialValues` sem `state` → input UF renderiza com `'PR'`.
  - `initialValues` com `state: 'SC'` → input UF renderiza `'SC'` (não sobrescreve).
- **`components/import/ImportFichaModal.test.tsx`** (estender): preview de lote sem UF →
  campo UF aparece com `'PR'`.

**Gate de cobertura (obrigatório):** código novo sem teste não fecha a story. Rodar o runner de
cobertura do adm.fonte (`pnpm --filter adm.fonte test -- --coverage`) e garantir ≥90% de cobertura
do código novo/alterado. Sem `skip`/`only` injustificado. `pnpm test:adm` (Playwright) não é
exigido — mudança é de default de campo, sem novo fluxo de usuário; se algum spec de import
existente cobrir o campo UF, mantê-lo verde.

## Fora de escopo

- Default para `city`/`address` ou qualquer outro campo — só UF.
- Alterar os parsers de backend (docx/spreadsheet) — a extração continua igual.
- Validação/normalização de siglas UF inválidas — não faz parte deste ajuste.
- Import de staff/associados — só o import de filhos.
