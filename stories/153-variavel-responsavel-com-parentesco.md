# Plan: variável de template `{{responsibleWithRelationship}}`

## Context

Os templates de documento têm hoje rodapés escritos à mão como
`{{responsibleName}}({{responsibleRelationship}})`. Como as duas variáveis são substituídas
independentemente e cada uma cai em `'não informado'` quando falta o dado
(`document-template.service.ts:293-295`), um acolhido sem familiar responsável imprime
`não informado(não informado)`, e um responsável sem parentesco preenchido imprime
`Maria Souza(não informado)`. Nos dois casos o documento sai impresso com lixo no lugar onde
alguém deveria assinar.

A story cria **uma variável única e condicional**, `{{responsibleWithRelationship}}`, que decide o
texto pelo que existe de fato — o operador escreve um token só no template e nunca precisa
prever os buracos.

### Decisões travadas (refinadas nesta sessão)

1. **Formato com nome + parentesco: `Nome (Parentesco)`** — espaço antes do parêntese. Difere do
   `Nome(Parentesco)` colado que o rodapé atual produz; a troca é intencional (legibilidade em
   texto corrido), então quem migrar o template vai ver essa diferença de um espaço.
2. **Sem parentesco → só o nome**, sem parênteses vazios: `Maria Souza`.
3. **Sem responsável → o literal `Responsável`**, servindo de rótulo abaixo da linha de assinatura.
   Não é string vazia.
4. **Parentesco em branco conta como "sem parentesco"** — `trim()` antes de decidir, para que um
   `relationship` com só espaços não vire `Maria Souza ( )`. `relationship` é **texto livre**
   (`string` em `packages/types/src/index.ts:335`), não enum, então não há tradução PT a fazer:
   sai como foi digitado.
5. **Nome em branco cai no placeholder** (assumido nesta sessão, revisar se discordar): se o
   `Relative` responsável existir mas estiver com `name` vazio após `trim()`, o resultado é
   `Responsável`, não ` (Mãe)` — imprimir um parentesco órfão seria pior que o caso que a story
   veio consertar.
6. **`{{responsibleName}}` e `{{responsibleRelationship}}` continuam existindo e inalterados.**
   Templates já salvos em produção usam esses tokens; mudá-los reescreveria documentos sem que
   ninguém tenha pedido. A variável nova é aditiva — a migração de cada template é manual, no
   editor, quando o usuário quiser.
7. **Sem migration e sem mudança de endpoint**: a substituição é in-memory no render. Portanto
   **não** há atualização de `fonte-api.postman_collection.json` nesta story.

Encosta em [[128-assinatura-do-usuario-em-documentos]] (o bloco de assinatura que costuma ficar
logo acima desse rótulo), [[144-editor-autocomplete-variaveis]] e
[[145-editor-descricao-variaveis-visivel]] (a lista de variáveis que a nova entrada alimenta).
Não depende de nenhuma story em aberto.

## Desenho

### Backend (`services/api`)

1. Em `DocumentTemplateService`, extrair um helper privado
   `buildResponsibleWithRelationship(responsible: Relative | null): string`:
   - `name = responsible?.name?.trim()`; se vazio → `'Responsável'`;
   - `rel = responsible?.relationship?.trim()`; se vazio → `name`;
   - senão → `` `${name} (${rel})` ``.
2. Registrar no mapa `vars` de `applyVariables` a chave
   `responsibleWithRelationship: this.buildResponsibleWithRelationship(responsible)`, junto das
   demais `responsible*`. O loop de substituição já casa o token inteiro
   (`\{\{responsibleWithRelationship\}\}`), então **não há colisão de prefixo** com
   `{{responsibleName}}` — nenhum token é prefixo de outro dentro das chaves duplas.
3. Nada muda em `renderForResident`, `generatePdf` ou `generateCombinedPdf`: a variável entra pelo
   caminho já existente e vale igual no preview, no PDF individual e no PDF combinado (story 152).

### Frontend (`adm.fonte`)

4. Adicionar a entrada em `src/features/settings/components/templateVariables.ts` (fonte única que
   alimenta a barra de variáveis **e** o autocomplete inline), no bloco `responsible*`:
   `{ key: '{{responsibleWithRelationship}}', label: 'Responsável — nome e parentesco',
   description: 'Nome do responsável com o parentesco entre parênteses; "Responsável" se não houver' }`.
   O `filterVariables` e o `buildVariableInsertion` funcionam sem alteração.
5. Conferir que o rótulo novo não estoura o layout da barra de variáveis — é o `label` mais longo
   da lista. Se estourar, encurtar para `Responsável — com parentesco` em vez de mexer no CSS.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** — `pnpm test:api` e `pnpm test:api:cov` verdes com cobertura ≥90 do código
tocado, e `pnpm --filter adm.fonte test:unit:cov` idem. Sem mudança de contrato, então
`build:types` / `build:api-client` não são exigidos.

- **Unit `document-template.service.spec.ts`** — a matriz completa do condicional, renderizando um
  template cujo conteúdo é `{{responsibleWithRelationship}}`:
  - responsável com nome e parentesco → `Maria Souza (Mãe)`;
  - responsável com nome e `relationship` `null` → `Maria Souza`;
  - responsável com `relationship` só de espaços → `Maria Souza` (decisão 4);
  - nenhum responsável (`findOne` devolve `null`) → `Responsável`;
  - responsável com `name` em branco → `Responsável` (decisão 5);
  - **regressão**: no mesmo render, `{{responsibleName}}` e `{{responsibleRelationship}}`
    continuam produzindo os valores antigos (inclusive o `'não informado'`), provando que a
    variável nova não sequestrou os tokens existentes (decisão 6).
- **Unit `templateVariables.test.ts`** — a nova key está em `VARIABLES`;
  `filterVariables('parentesco')` devolve tanto `{{responsibleRelationship}}` quanto
  `{{responsibleWithRelationship}}`; `buildVariableInsertion('responsibleWithRelationship')`
  devolve exatamente um par de chaves.
- **Unit `templateDrop.test.ts`** — `isVariableToken('{{responsibleWithRelationship}}')` é `true`
  (o drag-and-drop da story 140 reconhece o token novo).

## Fora de escopo

- Alterar o comportamento de `{{responsibleName}}` / `{{responsibleRelationship}}` — decisão 6.
- Migrar automaticamente os templates existentes que usam o par de tokens para a variável nova; a
  troca é manual no editor.
- Variáveis condicionais genéricas no editor (`{{#if}}`/`{{else}}`) — esta story entrega **uma**
  variável com a regra embutida, não um motor de template.
- Traduzir / normalizar o texto do `relationship` (é campo livre — decisão 4).
- Equivalentes condicionais para outros campos (`{{phone}}`, `{{address}}` etc.), que hoje também
  imprimem `'não informado'`.
