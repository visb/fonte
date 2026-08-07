# Plan: variável `{{exitDate}}` — data de saída nos documentos

## Context

O editor de templates hoje oferece `{{entryDate}}` ("Data de entrada") mas **não** tem a contraparte
de saída, embora `resident.exit_date` exista na entity desde o schema inicial
(`resident.entity.ts:60`) e seja preenchido tanto pela alta/evasão manual quanto pelo import em lote
(story [[120-import-status-alta-evasao-por-saida]], que passou a gravar a `exitDate` vinda da
planilha). Quem precisa imprimir declaração de desligamento, atestado de permanência ou ficha de
alta escreve a data à mão.

Esta story adiciona a variável de **texto** `{{exitDate}}` — não é variável de bloco como
`{{signature}}` / `{{residentPhoto}}`, é uma linha a mais no map `vars` do backend
(`document-template.service.ts:379-403`) e uma entrada no catálogo do frontend.

### Decisões travadas (refinadas nesta sessão)

1. **Sem data de saída → imprime `não informado`.** Diverge de propósito das outras datas
   (`birthDate`, `entryDate`, `date`) que passam por `formatDate` e caem no traço
   `___/___/______` quando nulas (`document-template.service.ts:437-439`). A razão: um filho **sem**
   saída é o caso normal (está ATIVO), e o traço convida a preencher à mão uma data que não existe.
   `não informado` é o mesmo fallback já usado por `rg`, `city`, `address` e
   `responsibleRelationship`.
2. **`{{exitDate}}` nunca bloqueia a geração.** Entra em `ALWAYS_AVAILABLE`
   (`documentFields.ts:25-27`), ao lado de `entryDate` — sem essa entrada, o
   `MissingFieldsDialog` teria que pedir a data de saída de todo filho ativo, em todo documento que
   usasse a variável. A entrada torna isso **intencional e testado** (hoje `findMissingFields` já a
   ignoraria por acaso, por não existir em `VAR_TO_FIELD`).
3. **Só formato curto (dd/mm/aaaa).** Não existe `{{exitDateLong}}` — `dateLong` hoje só existe para
   a data de hoje, e nenhum documento pediu extenso para a saída.
4. **Sem migration, sem endpoint novo, sem mudança de contrato.** O campo já está na entity e já
   trafega no `Resident`; a substituição é in-memory no render, e os três endpoints que geram
   documento já recebem o `resident` inteiro. Portanto **não há atualização de
   `fonte-api.postman_collection.json`** nesta story.

Não depende de nenhuma story em aberto.

## Desenho

### Backend (`services/api`, módulo `document-template`)

1. Em `applyVariables` (`document-template.service.ts:379`), logo abaixo de `entryDate` (`:396`),
   acrescentar:
   ```ts
   exitDate: resident.exitDate
     ? this.formatDate(resident.exitDate as Date | null)
     : 'não informado',
   ```
   O ternário é necessário porque `formatDate(null)` devolve `___/___/______` — decisão 1. Comentar
   a divergência ali, senão parece descuido em relação às outras datas.

2. Nada mais muda: `renderForResident`, `generatePdf`, `generateCombinedPdf` e os controllers já
   compartilham o mesmo `applyVariables`, então preview HTML, PDF individual e PDF combinado
   ([[152-documentos-pdf-combinado-impressao]]) herdam a variável de graça.

### Frontend (`adm.fonte`)

3. **Catálogo** (`features/settings/components/templateVariables.ts:38`) — entrada nova
   imediatamente após `{{entryDate}}`, para os dois campos ficarem lado a lado na barra:
   ```ts
   { key: '{{exitDate}}', label: 'Data de saída', description: 'Data de saída da comunidade (dd/mm/aaaa); "não informado" se o filho ainda está na casa' },
   ```
   `filterVariables` e `buildVariableInsertion` funcionam sem alteração; barra lateral
   ([[139-barra-variaveis-colapsavel-fixa]]), drag-and-drop ([[140-drag-and-drop-variaveis-editor]])
   e autocomplete inline ([[144-editor-autocomplete-variaveis]]) herdam de graça.

4. **Gate de campos faltantes** (`features/residents/lib/documentFields.ts:25-27`) — incluir
   `exitDate` em `ALWAYS_AVAILABLE`, com comentário apontando a decisão 2. `VAR_TO_FIELD` **não**
   ganha entrada; `useDocumentGeneration` não muda.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. **Gate: código novo sem teste não
fecha a story** — `pnpm test:api` + `pnpm test:api:cov` e `pnpm --filter adm.fonte test:unit:cov`
verdes, com cobertura ≥90 do código tocado e sem reduzir a de `document-template` nem a de
`features/settings` / `features/residents`. Sem mudança de contrato ⇒ `build:types` /
`build:api-client` não são exigidos; sem migration ⇒ sem `migration:run:test`.

- **Unit `document-template.service.spec.ts`** (junto dos casos das demais variáveis de texto):
  - filho **com** `exitDate` → o HTML traz a data em `dd/mm/aaaa`, no fuso UTC (mesma regra do
    `entryDate`, para não retroceder um dia);
  - filho **sem** `exitDate` (`null`) → o HTML traz exatamente `não informado` e **não** traz
    `___/___/______` (é o ponto todo da decisão 1);
  - template sem o token → nada muda no HTML;
  - `{{exitDate}}` repetido no mesmo template → todas as ocorrências substituídas (o `replace` global
    já cobre, mas o caso trava a regressão);
  - **regressão**: `{{entryDate}}` continua caindo em `___/___/______` quando nulo — a decisão 1
    vale **só** para a saída.
- **E2E `services/api/test/document-templates.e2e-spec.ts`** — `GET
  /residents/:id/documents/:templateId/render` com um template que usa `{{exitDate}}`: filho com
  data devolve a data; filho ativo devolve `não informado`; nenhum dos dois devolve o token cru.
- **Unit `adm.fonte`**:
  - `templateVariables.test.ts` — `{{exitDate}}` está em `VARIABLES`; `filterVariables('saída')` e
    `filterVariables('saida')` a encontram (accent-insensitive, via `normalizeForSearch`);
    `buildVariableInsertion('exitDate')` devolve exatamente um par de chaves;
  - `documentFields.test.ts` — `findMissingFields(['exitDate'], residentSemSaida)` devolve `[]`
    (regressão do `ALWAYS_AVAILABLE`, decisão 2).

## Fora de escopo

- **`{{exitDateLong}}`** / data de saída por extenso (decisão 3).
- **Variáveis derivadas da saída** — tempo de permanência, motivo do desligamento, status de
  alta/evasão. São outros campos, outra story.
- **Editar a data de saída pelo `MissingFieldsDialog`** (decisão 2) — a alta continua sendo o único
  caminho que grava `exitDate` no fluxo manual.
- **Múltiplos acolhimentos**: `{{exitDate}}` lê o campo do `resident` (a saída corrente), não o
  histórico de `admissions` da [[121-import-multiplos-acolhimentos]].
- **Caixa/placeholder no editor** — é variável de texto, não de bloco; nada de TipTap.
- `ops.fonte` / `app.fonte` — quem edita template e gera documento é o `adm.fonte`.
