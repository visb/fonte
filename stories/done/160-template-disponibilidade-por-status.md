# Plan: template de documento disponível por status do filho

## Context

A aba de anexos do filho lista **todos** os templates cadastrados, sem olhar para o status do
acolhido (`AttachmentsTab.tsx:36-46` só separa por `isRequired` / `signAtAdmission`). Na prática há
dois conjuntos de documentos que nunca se misturam: os do acolhimento (ficha, termo LGPD, contrato)
e os do desligamento (declaração de alta, atestado de permanência). Hoje um filho em alta continua
mostrando os cards de acolhimento e um filho ativo mostra os de desligamento — poluição visual e
convite a gerar o papel errado.

O `document_templates` só tem hoje dois flags booleanos (`is_required`, `sign_at_admission` —
`document-template.entity.ts:14-20`); não existe nenhuma noção de visibilidade por status.

Esta story cria o campo de **disponibilidade** do template, filtra os cards na aba de anexos e
**bloqueia a geração no backend** quando o template não vale para o status do filho.

### Decisões travadas (refinadas nesta sessão)

1. **Campo ternário, não lista de status.** `availableFor: 'ALL' | 'ACTIVE_ONLY' | 'INACTIVE_ONLY'`
   (coluna `available_for`, default `'ALL'`). Um multi-select com os 9 status do enum obrigaria o
   ADM a entender `CENSUS_ADDED`, `REJECTED_CENSUS` e `ARCHIVED` para configurar um template — é
   granularidade que ninguém pediu. Se um dia precisar, o ternário migra para lista sem quebrar os
   dados (`ALL` vira a lista completa).
2. **"Ativo" = filho presente/em tratamento: `PRE_ADMISSION`, `ACTIVE`, `DISCIPLINE`, `TEMP_LEAVE`.**
   É exatamente o `ACTIVE_STATUSES` que o repo já usa em dois lugares
   (`resident-receivable.service.ts:31-36` e `resident.service.ts:169-174`) — a story **não** inventa
   uma terceira definição de "ativo", **extrai a existente** para um único lugar compartilhado.
   `PRE_ADMISSION` conta como ativo de propósito (ver decisão 3). Filho de castigo ou em saída
   temporária continua sendo acolhido: a ficha de acolhimento vale para ele.
3. **`INACTIVE_ONLY` significa "já saiu / registro morto"**: `DISCHARGED`, `EVADED`, `CENSUS_ADDED`,
   `REJECTED_CENSUS`, `ARCHIVED`. O ponto decisivo para `PRE_ADMISSION` ficar do lado ativo é o
   **wizard de acolhimento**: ele imprime as fichas enquanto o filho ainda está `PRE_ADMISSION`
   (`AdmissionWizardPage.tsx:65-69`), e o gate "todos os documentos obrigatórios assinados" trava se
   um documento obrigatório não puder ser gerado. Com `PRE_ADMISSION` = ativo, marcar a ficha de
   acolhimento como `ACTIVE_ONLY` continua funcionando no wizard — não existe configuração que
   deadlocke o acolhimento.
4. **Esconde na tela E recusa no backend (400).** O filtro visual sozinho não seria regra: o PDF
   combinado ([[152-documentos-pdf-combinado-impressao]]) e a URL direta do render/PDF continuariam
   gerando o documento oculto. A validação vai no `DocumentTemplateService`, que é o choke point dos
   **três** caminhos de geração (`renderForResident`, `generatePdf`, `generateCombinedPdf`) e já
   recebe o `resident` inteiro nos três.
5. **A tela de configuração (`DocumentTemplatesTab`) não filtra nada** — o ADM precisa ver e editar
   todos os templates, inclusive os que não valem para ninguém no momento.
6. **Default `ALL` na migration**: todo template existente continua aparecendo exatamente onde
   aparece hoje. A story não muda comportamento de nenhum dado atual — só abre a opção.
7. **Muda contrato** (`packages/types` + `@fonte/api-client` + body do POST/PUT de template) ⇒
   `pnpm build:types` e `pnpm build:api-client` são obrigatórios, e
   `fonte-api.postman_collection.json` **tem que ser atualizado** (POST e PUT `/document-templates`
   ganham `availableFor`; o GET passa a devolvê-lo).

Não depende de nenhuma story em aberto. Independente da [[159-variavel-exit-date-em-documentos]],
embora as duas sirvam ao mesmo caso de uso (documentos de desligamento).

## Desenho

### Contrato (`packages/types`)

1. Enum novo em `packages/types/src/index.ts`, junto de `ResidentStatus`:
   ```ts
   export enum TemplateAvailability {
     ALL = 'ALL',
     ACTIVE_ONLY = 'ACTIVE_ONLY',
     INACTIVE_ONLY = 'INACTIVE_ONLY',
   }
   ```
2. **`ACTIVE_RESIDENT_STATUSES`** exportado do mesmo pacote (decisão 2), com o comentário explicando
   que é "presente/em tratamento". `resident-receivable.service.ts:31` e `resident.service.ts:169`
   passam a importá-lo em vez de redeclarar a lista — refactor pequeno, dentro do escopo, porque a
   story depende de a definição ser única.
3. Helper puro `isResidentStatusActive(status): boolean` e
   `isTemplateAvailableForStatus(availableFor, status): boolean` no mesmo módulo — backend e
   frontend usam **o mesmo** predicado, sem reimplementar a regra dos dois lados.

### Backend (`services/api`)

4. **Migration** `AddDocumentTemplateAvailability`: coluna `available_for` (`varchar`, `NOT NULL`,
   `DEFAULT 'ALL'`) em `document_templates`. Nunca editar migration existente. Sem backfill — o
   default cobre (decisão 6).
5. **Entity** (`document-template.entity.ts`) — campo `availableFor: TemplateAvailability` com
   `default: TemplateAvailability.ALL`.
6. **Controller** (`document-template.controller.ts`) — `create` e `update` aceitam `availableFor`,
   validado contra o enum (`BadRequestException` em valor fora do enum). O controller hoje usa
   `@Body('campo')` avulso; manter o estilo do arquivo, sem introduzir DTO só para este campo, **mas**
   validar o valor no service (regra de negócio, não roteamento).
7. **Guarda de geração** (`document-template.service.ts`) — helper privado
   `assertAvailableForResident(template, resident)` que lança
   `BadRequestException('Este documento não está disponível para o status atual do acolhido')`
   quando `isTemplateAvailableForStatus` reprova. Chamado nos três pontos:
   `renderForResident`, `generatePdf` e, no `generateCombinedPdf`, **por template da lista** — um
   template incompatível reprova a requisição inteira (não gera um PDF parcial silenciosamente).
8. **`findAdmissionDocuments`** (`resident.service.ts:705`) e `findDocuments` (`:690`) passam a
   descartar templates indisponíveis para o status do filho, senão a aba de anexos continuaria
   listando o documento pela outra fonte de dados.

### Frontend (`adm.fonte`)

9. **Editor de template** (`TemplateEditor.tsx`) — ao lado dos dois checkboxes existentes
   (`:642-648`), um grupo de rádio "Disponível para": *Todos* / *Só filhos ativos* /
   *Só filhos não-ativos*, com o subtítulo explicando o agrupamento da decisão 2/3 (ativo inclui
   pré-admissão, castigo e saída temporária). Entra no `schema` zod (`:423`), nos `defaultValues`
   (`:443`), no `reset` (`:447`) e no payload do save (`:568-570`). `react-hook-form`, nada de
   `useState` (regra do CLAUDE.md).
10. **Badge no card** (`TemplateCard.tsx:21`) — badge discreta "Só ativos" / "Só não-ativos" quando
    `availableFor !== 'ALL'`, ao lado da badge "Acolhimento" existente. Sem badge para `ALL`.
11. **Aba de anexos** (`AttachmentsTab.tsx:36-46`) — filtrar `templates` por
    `isTemplateAvailableForStatus(t.availableFor, resident.status)` **antes** de separar em
    `requiredTemplates` / `optionalTemplates` / `admissionSignTemplates`. Consequências que caem de
    graça: o `GenerateDocumentMenu` (opcionais) e a seleção do PDF combinado passam a operar só
    sobre o que é permitido, então a UI nunca monta uma requisição que o backend vai recusar.
    O `resident` já está em mãos (`useResidentById`, `:23`); com `resident` ainda carregando
    (`undefined`), não renderizar os cards (o `LoadingState` já é o padrão da tela).
12. **Wizard de acolhimento** (`AdmissionWizardPage.tsx:67`) — aplicar o mesmo filtro ao
    `requiredTemplates` do gate. Pela decisão 3 nenhuma configuração razoável some ali, mas um
    template `INACTIVE_ONLY` marcado como obrigatório travaria o gate para sempre; o filtro é a
    proteção.
13. **`DocumentTemplatesTab`** não muda (decisão 5).

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. **Gate: código novo sem teste não
fecha a story** — `pnpm test:api` + `pnpm test:api:cov`, `pnpm test:api:e2e` e
`pnpm --filter adm.fonte test:unit:cov` verdes, com cobertura ≥90 do código tocado e sem reduzir a
de `document-template`, `resident` nem a de `features/settings` / `features/residents`.
**Contrato mudou** ⇒ `pnpm build:types` e `pnpm build:api-client` obrigatórios.
**Migration nova** ⇒ `pnpm migration:run:test` verde.
**Postman atualizado** (decisão 7) — POST/PUT `/document-templates` com `availableFor`.

- **Unit `packages/types`** (ou o spec do helper, onde ele morar) — tabela-verdade de
  `isTemplateAvailableForStatus`: os 9 status × os 3 valores de `availableFor`. É o teste que trava
  as decisões 2 e 3 (incluindo `PRE_ADMISSION` do lado ativo e `ARCHIVED` do lado inativo).
- **Unit `document-template.service.spec.ts`**:
  - `renderForResident` e `generatePdf` com template `ACTIVE_ONLY` + filho `DISCHARGED` → lança
    `BadRequestException` com a mensagem definida; com filho `ACTIVE` → gera normal;
  - template `INACTIVE_ONLY` + filho `PRE_ADMISSION` → recusa (regressão da decisão 3);
  - template `ALL` → nunca recusa, em nenhum dos 9 status;
  - `generateCombinedPdf` com **um** template incompatível no meio da lista → recusa a requisição
    inteira, não gera PDF parcial (decisão 7 do desenho).
- **Unit `resident.service.spec.ts`** — `findDocuments` / `findAdmissionDocuments` omitem o template
  indisponível para o status do filho e mantêm os demais.
- **Unit dos serviços refatorados** — `resident-receivable.service.spec.ts` e
  `resident.service.spec.ts` rodam **inalterados** após a extração do `ACTIVE_RESIDENT_STATUSES`
  (é a prova de que o refactor da decisão 2 não mudou comportamento).
- **E2E `services/api/test/document-templates.e2e-spec.ts`**:
  - `POST` / `PUT /document-templates` gravam e devolvem `availableFor`; valor fora do enum → 400;
  - template criado **sem** o campo nasce `ALL` (decisão 6);
  - `GET /residents/:id/documents/:templateId/pdf` de template `ACTIVE_ONLY` para filho em alta → 400.
- **Unit `adm.fonte`**:
  - `TemplateEditor.test.tsx` — o rádio aparece com o valor do template, e salvar envia
    `availableFor` no payload;
  - `TemplateCard.test.tsx` — badge só com `availableFor !== 'ALL'`, com o rótulo certo em cada valor;
  - `AttachmentsTab.test.tsx` — filho `ACTIVE` não vê o card `INACTIVE_ONLY`; filho `DISCHARGED` vê
    o `INACTIVE_ONLY` e não vê o `ACTIVE_ONLY`; template `ALL` aparece nos dois; o template oculto
    **não** entra na seleção do PDF combinado;
  - `AdmissionWizardPage` — template obrigatório `INACTIVE_ONLY` não entra no gate "todos assinados"
    (item 12 do desenho).

## Fora de escopo

- **Condicional dentro do conteúdo do template** (`{{#if status}}` / motor de blocos condicionais) —
  esta story escolhe *quais documentos aparecem*, não *o que cada documento imprime*. Se for
  necessário, é outra story.
- **Lista de status configurável por template** (decisão 1) e disponibilidade por **casa**, por
  **role** ou por **sexo**.
- **Esconder documentos já gerados/assinados** do filho quando o status muda — o histórico assinado
  (`resident_documents`) continua visível sempre; a regra vale para **gerar novos**.
- **Migrar templates existentes** para `ACTIVE_ONLY`/`INACTIVE_ONLY` (decisão 6) — quem classifica é
  o ADM, na tela.
- **Filtro na tela de configuração de templates** (decisão 5).
- `ops.fonte` / `app.fonte` — quem edita template e gera documento é o `adm.fonte`.
