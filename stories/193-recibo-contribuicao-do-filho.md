# Plan: recibo da contribuição mensal do filho — segundo tipo de recibo + entrega ao familiar

## Context

A story 178 entregou a **estrutura** de recibos (`document_templates.kind = RECEIPT`, `receipt_type`
como **dado** em varchar, `issued_receipts` com numeração sequencial por tipo, motor de variáveis
desacoplado de `Resident` via `DocumentVariableResolver`) e **um** tipo funcionando: a contribuição
mensal do **associado** (`ReceiptType.ASSOCIATE_CONTRIBUTION`, sujeito `ASSOCIATE_CHARGE`).

Agora vem o segundo tipo: a **contribuição mensal do filho** — o carnê (`resident_receivables`,
stories 15/164/186). Quando a parcela é paga (dinheiro, PIX, cesta), a família precisa do recibo.

Esta story é a **primeira prova da aposta estrutural da 178**: um tipo novo de recibo custa um
resolver e nenhuma migration. Se custar mais que isso, a estrutura estava errada — e é isso que a
validação tem que evidenciar.

O que ela **não** é: uma cópia do recibo do associado. Três diferenças de domínio mudam o desenho:
quem paga **não** é quem consta na parcela (a parcela é do filho, quem paga é a família), o valor
pago pode divergir do plano (`paid_amount`/`paid_family_investment`), e a competência tem coluna
própria (`reference_month`) em vez de ser derivada do vencimento.

### Decisões travadas (usuário)

1. **Pagador e acolhido são tokens separados.** `{{payerName}}`/`{{payerCpf}}` = o **familiar
   responsável**; `{{residentName}}` = o filho. O template escreve o texto que quiser com os dois:
   *"Recebi de {{payerName}}, CPF {{payerCpf}}, a importância de {{amount}} ({{amountInWords}}),
   referente à contribuição de {{referenceMonth}} do acolhido {{residentName}}."* Sem responsável
   cadastrado, o pagador cai para o nome do filho.
2. **Contribuição em produtos fica de fora.** O recibo é do **dinheiro** (`paid_amount`). As linhas
   de `receivable_product_contributions` (story 183) não são impressas e não ganham token de bloco.
   Parcela quitada só com produto não tem recibo nesta story.
3. **Entrega em dois lugares: `adm.fonte` e `app.fonte`.** No `adm.fonte`, botão por parcela paga na
   aba Contribuições (ADMIN/COORDINATOR), espelhando a 178. No `app.fonte`, o **familiar baixa o
   próprio recibo** — o que exige rota com escopo `RELATIVE` e uma tela de contribuições que hoje
   não existe no app.

### Decisões de desenho derivadas (do levantamento no código)

4. **Nenhuma migration.** `document_templates.receipt_type`, `issued_receipts.receipt_type` e
   `issued_receipts.subject_type` são `varchar` por decisão explícita da 178 — tipo novo é dado, não
   DDL. O índice único parcial de template por `receipt_type` e as constraints
   `ux_issued_receipts_number` / `ux_issued_receipts_subject` já cobrem o tipo novo como estão. Se
   alguém sentir vontade de escrever uma migration aqui, o desenho da 178 foi mal lido.
5. **O sujeito é a PARCELA**, não o filho nem o par (filho, mês): `subject_type =
   RESIDENT_RECEIVABLE`, `subject_id = resident_receivables.id`. `ux_issued_receipts_subject` já dá
   de graça o "um número por parcela" — baixar dez vezes não queima dez números (decisão 5 da 178).
6. **Valor impresso = `paid_amount ?? amount`.** O que a família pagou de fato, não o que o plano
   dizia — os dois divergem por desenho (`paid_family_investment` existe exatamente para isso).
   `{{amountInWords}}` segue o mesmo valor. Sem `netAmount`/`feeAmount`: não há gateway no carnê do
   filho, e imprimir `R$ 0,00` de taxa seria mentira formatada.
7. **Competência vem de `reference_month`**, não do vencimento — o carnê tem a coluna, o associado
   não tinha. A formatação reusa `referenceMonthOf` (que já lê os componentes da string do Postgres
   em vez de construir um `Date` local; em fuso negativo o dia 1º voltaria um mês e imprimiria a
   competência errada).
8. **Reabrir pagamento não apaga o recibo emitido.** `reopenPayment` continua como está: a linha em
   `issued_receipts` fica. Número emitido não volta ao estoque — buraco na sequência é pior que
   registro obsoleto (mesma razão de `issued_receipts` não ter `deleted_at`). Enquanto a parcela
   estiver `PENDING` a emissão é recusada com 400; se for repaga, o **mesmo** número é reusado,
   porque o sujeito é o mesmo.
9. **Pagador nunca trava a emissão.** Responsável = `Relative` do filho com `is_responsible = true`,
   o mais antigo por `created_at` quando houver mais de um (determinístico, para o mesmo recibo sair
   igual amanhã). Nenhum responsável → `{{payerName}}` = nome do filho e `{{payerCpf}}` vazio.
   Recibo de dinheiro **já recebido** não pode falhar por cadastro incompleto — o operador não tem
   como consertar o passado.
10. **Escopo do familiar é o vínculo direto.** `Relative` tem exatamente um `resident_id`
    (`RelativeMeView`, story dos familiares). Parcela de outro filho → **404**, não 403: 403
    confirmaria que a parcela existe. A checagem de escopo roda **antes** da alocação do número —
    tentativa negada não queima sequência.
11. **A tela nova no `app.fonte` mostra só o que foi pago.** Lista das parcelas `PAID` do filho, com
    competência, valor pago e o botão de recibo. Nada de pendente/vencido: cobrar pelo app do
    familiar é decisão de produto que ninguém tomou, e a tela de recibo não é o lugar de tomá-la
    sozinha.
12. **`PAYMENT_METHOD_LABELS` sobe para `@fonte/types`.** O mapa pt-BR existe hoje só em
    `apps/adm.fonte/src/features/residents/constants.ts`, e o resolver (backend) precisa dele para
    `{{paymentMethod}}`. Duplicar dicionário é como "Cartão de Crédito" e "Cartão de crédito"
    passam a conviver. O `adm.fonte` passa a reexportar do pacote — nenhuma tela muda de texto.

---

## Desenho

### 1. Tipos compartilhados (`packages/types`)

```ts
export enum ReceiptType {
  ASSOCIATE_CONTRIBUTION = 'ASSOCIATE_CONTRIBUTION',
  RESIDENT_CONTRIBUTION  = 'RESIDENT_CONTRIBUTION',   // novo
  PIZZA_SALE             = 'PIZZA_SALE',
  BREAD_SALE             = 'BREAD_SALE',
}

export enum ReceiptSubjectType {
  ASSOCIATE_CHARGE   = 'ASSOCIATE_CHARGE',
  RESIDENT_RECEIVABLE = 'RESIDENT_RECEIVABLE',        // novo
}

export const IMPLEMENTED_RECEIPT_TYPES: ReceiptType[] = [
  ReceiptType.ASSOCIATE_CONTRIBUTION,
  ReceiptType.RESIDENT_CONTRIBUTION,
];

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  ...
  [ReceiptType.RESIDENT_CONTRIBUTION]: 'Contribuição mensal do acolhido',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { /* movido do adm.fonte */ };
```

`IMPLEMENTED_RECEIPT_TYPES` é o que libera o tipo novo no dialog de criação de template — a tela não
precisa saber que ele nasceu.

### 2. Resolver (`services/api/src/modules/receipt/resident-contribution-receipt.resolver.ts`)

Irmão do `AssociateContributionReceiptResolver`: **não consulta banco**, recebe tudo pronto do
service (que valida o sujeito e aloca o número). Reusa `formatReceiptNumber`, `referenceMonthOf`,
`formatBRL`, `formatCpf`, `formatDate`, `formatDateLong`, `amountInWords` e `buildSignatureBlock` —
nenhum helper novo.

| token | origem |
|---|---|
| `{{receiptNumber}}` | `issued_receipts.number`, zero-padded a 6 |
| `{{payerName}}`, `{{payerCpf}}` | `Relative` responsável; fallback nome do filho / CPF vazio (decisão 9) |
| `{{payerRelationship}}` | `relative.relationship` (ex.: *mãe*); vazio no fallback |
| `{{residentName}}`, `{{residentCpf}}` | `Resident` |
| `{{houseName}}` | casa do filho (vazio se `house_id` nulo — filho ARCHIVED) |
| `{{amount}}` | `paid_amount ?? amount` → `R$ 500,00` (decisão 6) |
| `{{amountInWords}}` | o mesmo valor por extenso |
| `{{referenceMonth}}` | `reference_month` → `agosto/2026` (decisão 7) |
| `{{paymentDate}}` | `paid_at` |
| `{{dueDate}}` | `due_date` |
| `{{paymentMethod}}` | `PAYMENT_METHOD_LABELS[payment_method]`; vazio quando nulo |
| `{{contributionPlan}}` | `paid_family_investment ?? family_investment`, rótulo pt-BR |
| `{{date}}`, `{{dateLong}}` | data de emissão |
| `{{signature}}` | bloco compartilhado, do usuário que emitiu |

### 3. `ReceiptService.generateForResidentReceivable(receivableId, issuedByUserId, scope?)`

Irmão de `generateForAssociateCharge`, mesma ordem de passos:

1. Template de `RESIDENT_CONTRIBUTION` via `findByReceiptType` — ausente → 404 com a mensagem
   acionável já existente (*"Nenhum template de recibo cadastrado para …"*).
2. Parcela existe (senão 404), **não** está soft-deleted, e está `PAID` (senão 400, *"Recibo só é
   emitido para parcela paga"*).
3. **Escopo** (decisão 10): quando `scope = { relativeUserId }`, a parcela tem que ser do filho
   daquele familiar; divergiu → 404. Roda **antes** do passo 4.
4. Aloca/recupera o número por `allocateNumber(RESIDENT_CONTRIBUTION, RESIDENT_RECEIVABLE, id)` —
   método **inalterado**, é o mesmo advisory lock por tipo.
5. Renderiza pelo motor compartilhado; filename `recibo-contribuicao-acolhido-000123.pdf` via
   `RECEIPT_FILENAME_PREFIX` (entrada nova no mapa, que é `Record<ReceiptType, string>` e por isso
   **quebra o build** se alguém esquecer o tipo novo — de propósito).

### 4. API

| rota | roles | observação |
|---|---|---|
| `GET /residents/:residentId/receivables/:receivableId/receipt` | `ADMIN`, `COORDINATOR` | no `ResidentController`, ao lado das rotas de carnê já existentes |
| `GET /relatives/me/receivables` | `RELATIVE` | parcelas **PAGAS** do filho do familiar: `id`, `referenceMonth`, `paidAmount`, `paidAt`, `paymentMethod`. Sem plano, sem produtos, sem histórico |
| `GET /relatives/me/receivables/:receivableId/receipt` | `RELATIVE` | escopado pela decisão 10 |

Respostas do download: `200` PDF · `400` parcela não paga · `404` parcela inexistente, de outro
filho, ou template não cadastrado · `403` fora das roles. Ambas as rotas de download com `@Audit`,
como a do associado. `fonte-api.postman_collection.json` atualizado (regra do CLAUDE.md).

### 5. `packages/api-client`

- `residents.receivableReceipt(residentId, receivableId): Promise<Blob>`
- `relatives.myPaidReceivables(): Promise<RelativePaidReceivable[]>`
- `relatives.receivableReceipt(receivableId, { responseType })` — **`arraybuffer` no React Native**,
  `blob` na web. RN não tem `Blob` utilizável para escrever arquivo; o app converte para base64 e
  grava. O parâmetro existe para não haver dois clientes HTTP.

### 6. `adm.fonte`

- `ReceivableRow`: botão de recibo visível **apenas** com `status === PAID` e no acolhimento atual ou
  encerrado (baixar recibo é leitura — o bloqueio de acolhimento encerrado é sobre **escrita**).
- Hook `useReceivableReceipt` espelhando `useChargeReceipt` (erro por `getErrorMessage`, id em
  download, `triggerDownload` compartilhado — extrair o helper para `lib/` em vez de copiar).
- `templateVariables.ts`: `RECEIPT_VARIABLES` (lista única, hoje com tokens de associado) vira
  `RECEIPT_VARIABLES_BY_TYPE: Record<ReceiptType, TemplateVariable[]>`. O painel e o autocomplete do
  `TemplateEditor` passam a receber a lista **do tipo do template** — recibo do filho não pode
  oferecer `{{netAmount}}`, e o do associado não pode oferecer `{{residentName}}`.
- `CreateTemplateDialog`: nada a fazer além do que a 178 já faz — o tipo novo aparece porque entrou
  em `IMPLEMENTED_RECEIPT_TYPES` e ainda não tem template cadastrado.

### 7. `app.fonte`

Feature nova `features/contributions/` + rota `app/(app)/contributions.tsx`, no padrão do app
(Expo Router, hooks em `features/<domínio>/hooks`, query keys em `lib/queryKeys.ts` — nunca literal):

- `useMyPaidReceivables()` — lista.
- `useReceivableReceipt()` — baixa `arraybuffer` → base64 → `FileSystem.cacheDirectory` →
  `Sharing.shareAsync(uri, { mimeType: 'application/pdf' })`, mesmo caminho do `QRCodeModal` do
  `ops.fonte`. Dependências `expo-file-system` e `expo-sharing` nas mesmas versões do `ops.fonte`.
- Componentes: `PaidReceivableRow` (item extraído, nunca inline no `FlatList`) + estados de
  loading/vazio/erro equivalentes aos compartilhados (CLAUDE.md).
- Entrada na home/menu do app. Sem parcela paga → estado vazio (*"Nenhuma contribuição registrada
  ainda."*), não lista em branco.

---

## Validação

### Backend — `pnpm test:api`

- **Resolver do filho** (`resident-contribution-receipt.resolver.spec.ts`): todos os tokens da tabela
  preenchidos; `{{amount}}` usa `paidAmount` quando presente e cai para `amount` quando nulo;
  `{{referenceMonth}}` sai da competência (e **não** do vencimento) — caso com `dueDate` em mês
  diferente de `referenceMonth` prova a diferença; `{{paymentMethod}}` vazio com método nulo;
  `{{contributionPlan}}` prefere `paidFamilyInvestment`; competência de dia 1º não escorrega de mês.
- **Pagador** (decisão 9): responsável presente → nome/CPF/parentesco dele; dois responsáveis → o
  mais antigo, de forma estável; nenhum responsável → nome do filho, CPF vazio, **sem** exceção;
  filho sem casa → `{{houseName}}` vazio, sem quebrar.
- **`generateForResidentReceivable`**: parcela `PENDING`/`CANCELED` → 400; parcela inexistente ou
  soft-deleted → 404; template do tipo não cadastrado → 404 com a mensagem acionável; caminho feliz
  devolve buffer PDF e filename com o número.
- **Escopo do familiar** (decisão 10): parcela do filho do familiar → 200; parcela de **outro** filho
  → 404 (não 403); e o teste prova que **nenhuma linha** foi criada em `issued_receipts` na tentativa
  negada — escopo antes da alocação.
- **Numeração**: primeira emissão do tipo = 1; segunda emissão da **mesma** parcela devolve o mesmo
  número e não insere linha nova; parcela diferente = próximo número; a sequência de
  `RESIDENT_CONTRIBUTION` é **independente** da de `ASSOCIATE_CONTRIBUTION` (as duas convivendo em
  1, 2, 3 cada).
- **Reabrir e repagar** (decisão 8): emitir → `reopenPayment` → a linha em `issued_receipts`
  permanece e a emissão passa a dar 400; repagar → mesma emissão devolve o **mesmo** número.
- **Isolamento de template**: `findAll()` sem `kind` continua **não** trazendo o recibo do filho;
  `renderForResident`/`generatePdf`/`generateCombinedPdf` recusam o template novo (mesma guarda dos
  três caminhos da 178, agora com o segundo tipo).
- **Regressão do recibo do associado**: os specs da 178 passam **sem alteração de expectativa**. Se
  algum deles precisou mudar, a extensão vazou para o tipo existente.

### Backend — `pnpm test:api:e2e`

- `GET /residents/:id/receivables/:receivableId/receipt`: `200` com `content-type: application/pdf`
  para ADMIN e COORDINATOR; `403` para SERVANT e RELATIVE; `400` em parcela não paga; `404` em
  parcela inexistente.
- `GET /relatives/me/receivables`: `200` para RELATIVE trazendo **só** parcelas `PAID` do próprio
  filho, sem campos de plano/produto; `403` para STAFF.
- `GET /relatives/me/receivables/:id/receipt`: `200` para o familiar do filho; `404` para parcela de
  outro filho (fixture com dois familiares e dois filhos — é o teste que prova a decisão 10 de ponta
  a ponta); `403` para SERVANT.
- Fixtures seguem a story 182: criadas pela própria suíte via API, removidas no `afterAll`, limpeza
  por id acumulado. `issued_receipts` também é limpo por id — **nunca** `DELETE FROM issued_receipts`.

### Migration

**Nenhuma** (decisão 4). A validação aqui é negativa e explícita: `pnpm migration:run:test` verde
**sem migration nova** no diff da story. Migration nesta story = desenho errado.

### Contratos

`pnpm build:types` e `pnpm build:api-client` (enums, `PAYMENT_METHOD_LABELS`, métodos novos).
`fonte-api.postman_collection.json` com as três rotas novas.

### `adm.fonte` — unit (Vitest/RTL)

- `ReceivableRow`: botão de recibo presente com `PAID`, ausente em `PENDING`/`PAST_DUE`/`CANCELED`;
  presente também em acolhimento encerrado (leitura não é escrita).
- Erro 404 de template ausente chega como a frase do backend via `getErrorMessage`, não como erro de
  axios.
- `templateVariables`: `RECEIPT_VARIABLES_BY_TYPE[RESIDENT_CONTRIBUTION]` tem `{{residentName}}` e
  **não** tem `{{netAmount}}`/`{{feeAmount}}`; o do associado permanece **idêntico** ao de hoje;
  `filterVariables` filtra a lista do tipo certo.
- `TemplateEditor` com template de recibo do filho lista os tokens do filho; com o do associado, a
  lista da 178 inalterada.
- `DocumentTemplatesTab`: o tipo novo é oferecido na criação enquanto não houver template dele, e
  some da lista depois de cadastrado.

### `adm.fonte` — e2e (Playwright)

Estender `e2e/receipts.spec.ts`: cadastrar template do recibo do filho em Configurações → abrir filho
com parcela paga → baixar o recibo (asserção no download) → confirmar que o template do filho **não**
aparece na aba de Anexos de nenhum filho.

### `app.fonte` — unit + e2e

- Unit (Vitest/RTL): lista renderiza só parcelas pagas; estado vazio sem parcelas; erro de download
  exibe a mensagem do backend; a conversão `arraybuffer` → base64 → `Sharing.shareAsync` é chamada
  com `mimeType: 'application/pdf'` (mocks de `expo-file-system`/`expo-sharing`).
- E2E (Maestro, `pnpm test:app`): fluxo do familiar abrindo a tela de contribuições e disparando o
  recibo — asserção até o compartilhamento nativo, que o Maestro não atravessa.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov`, `pnpm test:adm:unit` e `pnpm test:app:unit` com cobertura; **não reduzir** a
cobertura do módulo `receipt`, de `document-template`, das features `residents`/`settings` do
`adm.fonte` e da feature nova do `app.fonte` (que nasce coberta ≥90). Sem `skip`/`only`/`xfail` sem
justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Contribuição em produtos no recibo** (decisão 2): as linhas de
  `receivable_product_contributions` não são impressas, e parcela quitada só com produto não gera
  recibo.
- **Recibo de pizza e de pão** — continuam declarados no enum, sem resolver (fora de escopo desde a
  178, e sem domínio de venda de rua a que se referir).
- **Cobrança pelo `app.fonte`**: a tela nova lista só o que foi pago; parcela pendente, vencida,
  boleto, PIX ou qualquer forma de pagar pelo app não entram (decisão 11).
- **`ops.fonte`**: o servo continua com o recorte sem valor da story 186 — nada de recibo lá.
- **Envio automático do recibo** (WhatsApp/e-mail ao registrar o pagamento). O download é manual, nos
  dois apps.
- **Persistência do PDF no bucket** e listagem de recibos emitidos em tela — `issued_receipts`
  continua guardando o registro, não o arquivo.
- **Cancelamento/estorno de recibo emitido** (decisão 8): reabrir pagamento não apaga número.
- **Variáveis de organização** (nome/CNPJ/endereço) — seguem digitadas no corpo do template
  (decisão 7 da story 178).
