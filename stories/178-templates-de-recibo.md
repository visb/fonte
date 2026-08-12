# Plan: templates de recibo — estrutura genérica + recibo da contribuição mensal

## Context

O esquema de templates hoje só sabe falar de **filho**. `document_templates` (`name`, `content`,
`isRequired`, `signAtAdmission`, `availableFor`) e todo o `DocumentTemplateService` assumem que o
sujeito do documento é um `Resident`: `renderForResident`, `applyVariables(content, resident,
responsible, signer, photo)`, `assertAvailableForResident`. `GET /document-templates` devolve
**todos** os templates, e a `AttachmentsTab` do filho monta as seções a partir dessa lista inteira.

Precisamos de **recibos**. O primeiro é o da **contribuição mensal do associado**: quando a cobrança
é confirmada, o recibo tem que ficar disponível para download. Depois virão recibos de **venda de
pizza** e de **pão** — que não têm associado nem cobrança, e portanto não podem ser um caso especial
do modelo de contribuição.

Duas consequências imediatas do modelo atual:

1. Um template de recibo cadastrado hoje **apareceria na aba de Anexos de todo filho**, porque a aba
   consome a lista inteira. Isso é exatamente o que não pode acontecer.
2. As variáveis de recibo (`{{amount}}`, `{{payerName}}`, `{{receiptNumber}}`) não têm onde nascer:
   `applyVariables` só recebe `Resident`.

Esta story faz a **evolução estrutural** e entrega **um** tipo de recibo funcionando ponta a ponta.
Pizza e pão entram depois, sem tocar em estrutura.

### Decisões travadas (usuário)

1. **Entrega: só `adm.fonte`, no detalhe do associado.** Botão de download por cobrança paga no
   `AssociateDetailDialog`. Sem portal público, sem disparo de WhatsApp — nada muda no webhook do
   Pagar.me nesta story.
2. **Um template ativo por tipo de recibo.** `receiptType` é único no banco. O gerador **acha** o
   template pelo tipo; não existe escolha na hora de emitir, nem risco de operador emitir com o
   template errado.
3. **Numeração sequencial por tipo de recibo.** Contribuição, pizza e pão têm sequências
   independentes (`contribuição 000123` convive com `pizza 000045`). Sequência por tipo — não global
   — porque são livros distintos para quem confere.
4. **PDF gerado sob demanda, nunca persistido.** Nada vai para o bucket, nada entra em
   `resident_documents` nem em `resident_attachments`. É a garantia estrutural (não cosmética) de
   que recibo não vaza para a aba de anexos.

### Tensão a resolver (decisões 3 × 4)

Numeração sequencial **exige memória**; "não persistir" era sobre o arquivo. Travado:

5. **Persiste-se o registro de emissão, não o PDF.** Tabela nova `issued_receipts` guarda
   `receipt_type + number + sujeito`; não guarda `file_url`. A primeira geração **aloca** o número; a
   segunda, terceira e enésima geração da mesma cobrança **reusam o mesmo número** (idempotência por
   sujeito). Baixar duas vezes não queima dois números.
6. **Trade-off aceito:** como o PDF é re-renderizado a cada download pelo template **atual**, editar
   o template muda o layout de um recibo já emitido. Aceitável porque o que precisa ser estável já é
   estável: o **número** está gravado e os **valores** vêm da `associate_charges`, imutável depois de
   `PAID`. Se um dia o recibo precisar ser prova imutável de layout, aí sim se persiste o PDF — e a
   tabela `issued_receipts` já é o lugar onde a coluna entraria, sem migração de conceito.

### Decisões de desenho derivadas (do levantamento no código)

7. **Nada de variável de organização.** Nome, CNPJ e endereço da entidade vão **digitados no corpo do
   template** pelo coordenador. Não existe hoje uma entidade "organização" no schema, e inventar uma
   por causa do rodapé do recibo é superfície que a story não precisa.
8. **O isolamento é no repositório, não na tela.** `GET /document-templates` passa a filtrar por
   `kind`, com **default `RESIDENT`** — o consumidor atual (`AttachmentsTab`, `TemplateEditor`,
   `AdmissionWizardPage`) continua vendo exatamente o que via, e um recibo novo é invisível para eles
   sem que nenhuma tela precise saber que recibos existem.
9. **Guarda nos três caminhos de geração de documento de filho**, espelhando a lição da story 160
   (`assertAvailableForResident`): `renderForResident`, `generatePdf` e `generateCombinedPdf`
   recusam template com `kind !== RESIDENT`. Sumir da tela não é regra — a URL direta continuaria
   gerando.

---

## Desenho

### 1. Tipos compartilhados (`packages/types`)

```ts
export enum TemplateKind {
  RESIDENT = 'RESIDENT',   // documento do filho — comportamento de hoje
  RECEIPT  = 'RECEIPT',
}

export enum ReceiptType {
  ASSOCIATE_CONTRIBUTION = 'ASSOCIATE_CONTRIBUTION',
  PIZZA_SALE             = 'PIZZA_SALE',   // declarado, não implementado
  BREAD_SALE             = 'BREAD_SALE',   // declarado, não implementado
}

/** Sujeito de um recibo emitido. Polimórfico para comportar pizza/pão. */
export enum ReceiptSubjectType {
  ASSOCIATE_CHARGE = 'ASSOCIATE_CHARGE',
}

/** Tipos de recibo com resolver implementado — o que a UI oferece hoje. */
export const IMPLEMENTED_RECEIPT_TYPES = [ReceiptType.ASSOCIATE_CONTRIBUTION];
```

`PIZZA_SALE`/`BREAD_SALE` já entram no enum de propósito: prova que o `receiptType` é dado e não
código, e a etapa seguinte vira "escrever um resolver", sem migration nem mudança de contrato.
`IMPLEMENTED_RECEIPT_TYPES` é o que impede a tela de oferecer um tipo cujo resolver ainda não existe.

### 2. Schema (`document_templates` + tabela nova)

Migration nova (**nunca** editar as existentes):

```sql
ALTER TABLE document_templates
  ADD COLUMN kind         varchar NOT NULL DEFAULT 'RESIDENT',
  ADD COLUMN receipt_type varchar NULL;

-- Decisão 2: um template ativo por tipo de recibo.
CREATE UNIQUE INDEX ux_document_templates_receipt_type
  ON document_templates (receipt_type)
  WHERE receipt_type IS NOT NULL;

CREATE TABLE issued_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_type    varchar NOT NULL,
  number          integer NOT NULL,
  subject_type    varchar NOT NULL,
  subject_id      uuid    NOT NULL,
  issued_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_issued_receipts_number  UNIQUE (receipt_type, number),
  CONSTRAINT ux_issued_receipts_subject UNIQUE (receipt_type, subject_type, subject_id)
);
```

- `ux_..._number` protege a sequência; `ux_..._subject` é a **idempotência** da decisão 5.
- `varchar` (não enum do Postgres) seguindo a convenção de `available_for` (story 160): tipo novo de
  recibo não exige `ALTER TYPE`. Validação no service.
- Sem `deleted_at`: recibo emitido não se apaga — buraco na sequência é pior que registro obsoleto.

**Invariantes validadas no service** (`DocumentTemplateService.create/update`):

| `kind` | `receiptType` | `isRequired` / `signAtAdmission` / `availableFor` |
|---|---|---|
| `RESIDENT` | tem que ser `null` | livres, como hoje |
| `RECEIPT` | obrigatório e ∈ `ReceiptType` | forçados a `false` / `false` / `ALL` |

Violação → `BadRequestException`. Conflito de `receiptType` já existente → `ConflictException`, com a
mesma forma do conflito de `name` que já existe.

### 3. Motor de variáveis: desacoplar de `Resident`

`applyVariables` hoje é uma função com assinatura `(content, resident, responsible, signer,
residentPhotoUrl)`. Vira um contrato:

```ts
interface DocumentVariables {
  text:   Record<string, string>;                       // {{token}} → texto
  blocks: Record<string, (align?: string) => string>;   // {{token}} → HTML de bloco
}

interface DocumentVariableResolver {
  resolve(): Promise<DocumentVariables>;
}
```

- `ResidentVariableResolver` — **exatamente** o comportamento atual, movido sem alteração: todos os
  tokens de `applyVariables`, mais os blocos `{{signature}}` (story 128/136) e `{{residentPhoto}}`
  (story 157). Nenhuma variável de filho muda de saída — é refatoração pura, coberta pelos specs que
  já existem.
- `AssociateContributionReceiptResolver` — o primeiro resolver de recibo.
- `replaceBlockToken`, `TOKEN_WRAP`, `wrapPage`, `getBrowser`, `slugify` e a mecânica de margem A4
  (stories 24/154) **permanecem compartilhados** — a renderização é a mesma, só o dicionário muda.
  `{{signature}}` vale nos dois mundos: recibo também é assinado por quem emitiu.

Os resolvers de recibo são registrados num mapa `receiptType → resolver`. É isso que faz pizza/pão
custarem um arquivo cada.

#### Variáveis do recibo da contribuição

| token | origem |
|---|---|
| `{{receiptNumber}}` | `issued_receipts.number`, zero-padded a 6 (`000123`) |
| `{{payerName}}`, `{{payerCpf}}` | `Associate` (CPF formatado pelo `formatCpf` já existente) |
| `{{amount}}` | `charge.grossAmount` → `R$ 50,00` (o que o associado pagou) |
| `{{netAmount}}`, `{{feeAmount}}` | idem, para template que queira discriminar a taxa |
| `{{amountInWords}}` | `grossAmount` por extenso — `cinquenta reais` |
| `{{referenceMonth}}` | competência, de `charge.dueDate` → `agosto/2026` |
| `{{paymentDate}}` | `charge.paidAt` (`formatDate`) |
| `{{date}}`, `{{dateLong}}` | data de emissão — mesmos helpers de hoje |
| `{{signature}}` | bloco compartilhado, do staff que baixou |

`{{amountInWords}}` é util próprio (`amount-in-words.ts`) com spec dedicada, **sem dependência
nova** — é uma função, não vale um pacote; e é justo o tipo de código que erra em centavos, em
`1.000.000` e no singular (`um real`).

### 4. Emissão e alocação do número

`ReceiptService.generate(receiptType, subjectId, issuedByUserId)`:

1. Resolve o template por `receiptType`. Ausente → `NotFoundException` com mensagem acionável:
   *"Nenhum template de recibo cadastrado para contribuição mensal. Cadastre em Configurações →
   Templates."* (Nada de 404 mudo — quem vê é o operador.)
2. Valida o sujeito. Para `ASSOCIATE_CONTRIBUTION`: a cobrança existe e está `PAID`; senão
   `BadRequestException` (*"Recibo só é emitido para cobrança paga"*).
3. **Aloca ou recupera o número**, em transação:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext($receiptType));
   -- SELECT existente por (receipt_type, subject_type, subject_id) → reusa
   -- senão: INSERT com number = COALESCE(MAX(number), 0) + 1 WHERE receipt_type = $1
   ```
   O advisory lock por tipo serializa só a alocação daquele tipo (dois downloads simultâneos da mesma
   cobrança não geram dois números; pizza não bloqueia contribuição). Sequence nativa do Postgres não
   serve: o tipo é **dado**, e uma sequence por tipo exigiria DDL a cada tipo novo.
4. Renderiza com o resolver e devolve `{ buffer, filename }` — `recibo-contribuicao-000123.pdf` via
   `slugify`.

### 5. API

| rota | mudança |
|---|---|
| `GET /document-templates?kind=` | novo query param; **default `RESIDENT`** (decisão 8) |
| `POST` / `PUT /document-templates` | aceitam `kind` e `receiptType`, validados pelas invariantes |
| `GET /associates/charges/:chargeId/receipt` | **nova** — PDF do recibo. `ADMIN`, `COORDINATOR` |

Respostas da rota nova: `200` PDF · `400` cobrança não paga · `404` cobrança inexistente ou template
não cadastrado · `403` fora das roles. `fonte-api.postman_collection.json` atualizado (regra do
CLAUDE.md).

`packages/api-client`: `documentTemplates.list({ kind })` e módulo/chamada
`associates.chargeReceipt(chargeId)` devolvendo `Blob`.

### 6. `adm.fonte`

**Configurações → Templates** (`DocumentTemplatesTab`): duas seções na **mesma aba** — *Documentos do
acolhido* e *Recibos* — porque o editor é o mesmo componente e uma aba nova só duplicaria chrome.
Duas queries com query keys distintas (`queryKeys.documentTemplates.byKind(kind)`; nunca literal —
regra do CLAUDE.md). O dialog "Novo template" pede o **tipo de recibo** quando o grupo é Recibos, e
oferece apenas `IMPLEMENTED_RECEIPT_TYPES` menos os já cadastrados (decisão 2).

**`TemplateEditor`**: o painel de tokens passa a depender do `kind` — recibo lista os tokens da
tabela acima, e não `{{name}}`/`{{residentPhoto}}`. Os controles `isRequired`, `signAtAdmission` e
`availableFor` **não são renderizados** para `kind = RECEIPT`.

**`AssociateDetailDialog` / `ChargeRow`**: botão de download do recibo, visível **apenas** com
`status === PAID`. Erro tratado com `getErrorMessage` (regra do CLAUDE.md) — o 404 de template
ausente chega ao operador como a frase acionável do item 4.1, não como erro de axios.

**`AttachmentsTab`**: nenhuma mudança de código. O isolamento vem do default do backend — e é isso
que o teste tem que provar.

---

## Validação

### Backend — `pnpm test:api`

Casos a cobrir (unit, `document-template.service.spec.ts` + specs novos do recibo):

- **Invariantes de kind**: `RECEIPT` sem `receiptType` → 400; `RECEIPT` com `receiptType` inválido →
  400; `RESIDENT` com `receiptType` → 400; `RECEIPT` nasce com `isRequired`/`signAtAdmission` false e
  `availableFor = ALL` mesmo se o body mandar outra coisa; segundo template do mesmo `receiptType` →
  409.
- **Filtro por kind**: `findAll()` sem argumento devolve **só** `RESIDENT` (inclusive os legados, que
  nascem `RESIDENT` pelo default da coluna); `findAll('RECEIPT')` devolve só recibos;
  `findAdmissionTemplates()` nunca devolve recibo.
- **Guarda dos três caminhos** (decisão 9): `renderForResident`, `generatePdf` e
  `generateCombinedPdf` com template `RECEIPT` → 400, inclusive quando o recibo é **um item no meio**
  da lista do combinado (reprova a requisição inteira, como na story 160).
- **Regressão do resolver de filho**: os specs atuais de `applyVariables` passam sem alteração de
  expectativa após a refatoração — se um token de filho mudar de saída, a refatoração está errada.
- **`amountInWords`**: 0; centavos (`0,01` → *um centavo*); singular (`1,00` → *um real*); 50;
  1.234,56; 1.000.000; valor com centavos e reais juntos.
- **Alocação de número**: primeira emissão = 1; segunda emissão da **mesma** cobrança devolve o
  **mesmo** número e **não** insere linha nova; cobrança diferente do mesmo tipo = próximo número;
  tipos diferentes têm sequências independentes.
- **`ReceiptService.generate`**: cobrança `PENDING`/`PAST_DUE` → 400; cobrança inexistente → 404;
  template do tipo não cadastrado → 404 com a mensagem acionável; caminho feliz devolve buffer PDF e
  filename com o número.
- **Resolver da contribuição**: todos os tokens da tabela preenchidos a partir de charge+associate;
  `paidAt` nulo não chega aqui (barrado no passo 2), e o teste prova essa ordem.

### Backend — `pnpm test:api:e2e`

`GET /associates/charges/:chargeId/receipt`: `200` com `content-type: application/pdf` para ADMIN e
COORDINATOR; `403` para SERVANT e RELATIVE; `400` em cobrança não paga; `404` em cobrança inexistente
e em template ausente. `GET /document-templates` sem `kind` **não** traz o recibo cadastrado no
setup — o e2e é o que prova o isolamento de ponta a ponta.

### Migration

`pnpm migration:run:test` verde. Verificar no banco de teste que templates **pré-existentes** ficaram
`kind = 'RESIDENT'`, `receipt_type = NULL`, e que o índice único parcial rejeita o segundo
`ASSOCIATE_CONTRIBUTION`.

### Contratos

`pnpm build:types` e `pnpm build:api-client` (enums e assinaturas novas).
`fonte-api.postman_collection.json` atualizado: rota nova + query param `kind` + campos novos no
body de create/update.

### `adm.fonte` — unit (Vitest/RTL)

- `ChargeRow`: botão de recibo presente com `PAID`, ausente em `PENDING`/`PAST_DUE`/`CANCELED`.
- Download com erro 404 de template exibe a mensagem do backend (via `getErrorMessage`), não erro
  genérico.
- `DocumentTemplatesTab`: dois grupos renderizados; criação de recibo pede o tipo; tipo já cadastrado
  não é oferecido; tipo sem resolver (`PIZZA_SALE`) não é oferecido.
- `TemplateEditor`: com `kind = RECEIPT` não renderiza `isRequired`/`signAtAdmission`/`availableFor`
  e lista os tokens de recibo; com `RESIDENT`, o painel de hoje, inalterado.
- `AttachmentsTab`: com um `RECEIPT` presente no mock da lista, ele **não** aparece em nenhuma das
  três seções — cinto e suspensório sobre o filtro do backend.

### `adm.fonte` — e2e (Playwright)

Fluxo: criar template de recibo de contribuição em Configurações → abrir associado com cobrança paga
→ baixar o recibo (asserção no download) → abrir a aba de Anexos de um filho e confirmar que o
template de recibo não está lá.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov` e `pnpm test:adm:unit` com cobertura; **não reduzir** a cobertura de
`document-template`, do módulo de recibo e das features `associates`/`settings` do `adm.fonte`. Sem
`skip`/`only`/`xfail` sem justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Recibo de pizza e de pão.** Os valores entram no enum e o mapa de resolvers os comporta, mas
  nenhum resolver, tela ou rota é escrito — inclusive porque não existe ainda o domínio de venda de
  rua a que eles se referem.
- **Entrega ao associado**: portal público, link tokenizado, WhatsApp e e-mail. O webhook do Pagar.me
  não é tocado.
- **Persistência do PDF no bucket** e histórico de recibos emitidos em tela (a tabela guarda o dado;
  a listagem não é feita aqui).
- **Cancelamento/estorno de recibo emitido.** Não há `deleted_at` em `issued_receipts` por desenho.
- **Recibo de inscrição em evento pago** (`event_registrations`), que é outro sujeito e outra story.
- **Variáveis de organização** (nome/CNPJ/endereço) — decisão 7: vão digitadas no template.
- Mudança em qualquer variável ou comportamento dos documentos de filho já existentes.
