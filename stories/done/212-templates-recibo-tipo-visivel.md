# Plan: tipo do template de recibo visível, escolhido e editável (+ atalho no erro e nome do arquivo)

## Context

Bug relatado: o recibo da contribuição mensal do filho dava 404 ("Nenhum template de recibo
cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates."), embora
houvesse um template de recibo cadastrado.

**Diagnóstico (não é bug do gerador):**

- O gerador acha o template **pelo tipo** (`DocumentTemplateService.findByReceiptType`, story 178).
  O recibo do filho exige `RESIDENT_CONTRIBUTION` ("Contribuição mensal do acolhido", story 193).
- O template cadastrado ("teste") é do tipo `ASSOCIATE_CONTRIBUTION` ("Contribuição mensal do
  associado"). Portanto, o 404 está correto.
- O engano vem da UX:
  - o `CreateTemplateDialog` **pré-seleciona** o primeiro tipo disponível (`available[0]`, que é o
    do associado), então quem não olha o select cria o tipo errado sem perceber;
  - a **lista** (`TemplateCard`) e o **editor** (`TemplateEditor`) **não mostram** o tipo do
    recibo, então não há como notar o erro depois;
  - o tipo **não pode ser trocado** pelo `adm`, embora o `PATCH /document-templates/:id` já aceite
    `receiptType` e valide as invariantes (um template por tipo).
- Observação do usuário: *"no editor de templates só tem um 'Tipo de recibo', precisa criar outro
  tipo para o recibo dos residents"*. O tipo **já existe** (`RESIDENT_CONTRIBUTION`, em
  `IMPLEMENTED_RECEIPT_TYPES`). O dialog mostra um só porque esconde os tipos que já têm template.
  Com o do associado ocupado, sobra apenas o do acolhido. Esta story deixa isso explícito na tela.
  (Se em produção o dialog mostrar só "associado", o `adm` publicado está defasado em relação à API.
  Isso é deploy, fora desta story.)
- **Contorno imediato, sem código:** criar um novo template de recibo, que já sai como "Contribuição
  mensal do acolhido".

### Decisões travadas (usuário)

1. **Mostrar o tipo** do recibo como badge em cada `TemplateCard` do grupo Recibos e no cabeçalho
   do editor (`DocumentTemplatesTab`, ao lado do badge "Recibo").
2. **Escolha explícita no dialog**: o select "Tipo de recibo" começa vazio ("Selecione o tipo"), é
   obrigatório e não tem pré-seleção. A mensagem "Todos os tipos já têm template" continua.
3. **Trocar o tipo no editor**: campo "Tipo de recibo" editável no `TemplateEditor` para templates
   de recibo. Usa o `PATCH` existente e oferece o tipo atual mais os tipos implementados ainda
   livres. Conflito (tipo já usado) mostra o erro do backend via `getErrorMessage`.
4. **Atalho no erro do gerador**: quando a geração do recibo falha por template ausente, o erro na
   linha (`ReceivableRow` do filho e `ChargeRow` do associado) ganha o botão **"Cadastrar
   template"**. O botão abre Configurações → Templates com o dialog de novo recibo já aberto e o
   tipo certo pré-escolhido. Aqui a pré-seleção é intencional, porque vem do contexto do erro.

5. **Nome do arquivo do recibo do filho**: `recibo-{nome-do-filho}-{mes}-{ano}.pdf`. Hoje o
   `adm` salva `recibo-<uuid-da-parcela>.pdf` (ignora o nome do servidor), o `app.fonte` também, e
   o servidor manda `recibo-contribuicao-acolhido-000001.pdf` no `Content-Disposition`.

### Decisões de desenho (defaults assumidos no refino)

6. **Formato exato do nome (decisão 5)**:
   - **nome**: slug do nome do filho (minúsculas, sem acento, espaços e pontuação viram `-`);
   - **mês/ano**: a **competência** da parcela (`reference_month`), não a data de pagamento, com
     mês de 2 dígitos;
   - exemplo: `recibo-joao-da-silva-10-2026.pdf`.

   Um helper único `residentReceiptFilename(residentName, referenceMonth)` em `@fonte/types` é
   usado pelo servidor (`Content-Disposition`), pelo `adm` (`useReceivableReceipt`) e pelo
   `app.fonte` (`receiptFileUri`). Os clientes montam o nome com os dados que já têm na linha
   (nome do filho e competência), sem ler header (dispensa `exposedHeaders` de CORS). O número do
   recibo sai do nome do arquivo, mas continua impresso no PDF.
   - **app.fonte**: o arquivo no cache passa a ter o nome novo. Se o familiar tiver dois filhos
     com o mesmo nome e a mesma competência, o arquivo é sobrescrito, o que é aceitável porque o
     cache é só para compartilhar na hora.

7. **Código de erro legível por máquina.** O 404 de template ausente passa a levar
   `{ code: 'RECEIPT_TEMPLATE_MISSING', receiptType }` no corpo, além da `message` atual. Assim o
   `adm` distingue esse caso do 404 de "parcela inexistente". A mensagem humana não muda.
   - O download vem como `responseType: 'blob'`, então o corpo de erro chega como `Blob`. O helper
     que lê o erro (`getErrorMessage` / o hook) precisa extrair `code` e `receiptType` do JSON
     dentro do Blob, do mesmo jeito que já extrai a `message`. Conferir na implementação.
8. **Rota do atalho**: `/settings/templates?newReceipt=<ReceiptType>`. O `DocumentTemplatesTab` lê
   o param, abre o `CreateTemplateDialog` no grupo Recibos com aquele tipo e limpa o param. Tipo
   inválido ou já tomado → abre sem pré-seleção.
9. **Rótulos**: `RECEIPT_TYPE_LABELS` de `@fonte/types`, já existente. Nada de cópia local.
10. **Componentes ≤ ~150 linhas.** O `TemplateEditor` já é grande, então o campo de tipo entra como
   componente próprio (`ReceiptTypeField`).

---

## Desenho

### 1. Backend (`services/api`)

- `DocumentTemplateService.findByReceiptType`: a `NotFoundException` passa a receber o objeto
  `{ message, code: 'RECEIPT_TEMPLATE_MISSING', receiptType }`. O status (404) e a mensagem atuais
  não mudam.
- `ReceiptService.generateForResidentReceivable`: `filename` via
  `residentReceiptFilename(resident.name, receivable.referenceMonth)` (decisão 6). O recibo do
  associado continua com o nome atual.
- Sem migration e sem endpoint novo.

### 1b. Contratos

- `packages/types`: `residentReceiptFilename` (+ slug sem acento). `pnpm build:types`.
- **Postman**: exemplo de resposta 404 com `code` nos endpoints de recibo (parcela do filho e
  cobrança do associado).

### 2. `adm.fonte`

```
features/settings/
  components/TemplateCard.tsx            ← badge do tipo (só kind RECEIPT)
  components/CreateTemplateDialog.tsx    ← sem default; prop opcional initialReceiptType
  components/ReceiptTypeField.tsx        ← select do tipo no editor (PATCH)
  components/TemplateEditor.tsx          ← usa ReceiptTypeField em recibo
  pages/DocumentTemplatesTab.tsx         ← badge no cabeçalho; lê ?newReceipt=
features/residents/
  hooks/useReceivableReceipt.ts          ← expõe missingTemplateType
  components/ReceivableRow.tsx           ← botão "Cadastrar template"
features/associates/
  hooks/useChargeReceipt.ts / components/ChargeRow.tsx  ← idem
lib/errors.ts                            ← ler code/receiptType (inclusive de Blob)
```

- `useReceivableReceipt.download` passa a receber o nome do filho e a competência (o
  `ContributionsTab`/`ReceivableRow` já os têm) para montar o nome do arquivo.

### 3. `app.fonte`

- `features/contributions/lib/receiptFile.ts`: `receiptFileUri` usa `residentReceiptFilename`. O
  hook (`useContributions`) passa o nome do filho e a competência da parcela.

- A mutation de atualização do template usa o hook existente (`useUpdateDocumentTemplate` ou
  equivalente) e invalida pelas query keys de `lib/queryKeys.ts`.

---

## Validação

### Backend: `pnpm test:api`

- `findByReceiptType` sem template → `NotFoundException` com `code: 'RECEIPT_TEMPLATE_MISSING'`, o
  `receiptType` pedido e a mensagem atual (`document-template.service.spec.ts`).
- `receipt.service.spec.ts`: os casos de template ausente continuam 404 com a mensagem, e a parcela
  inexistente continua 404 **sem** esse `code`.
- `generateForResidentReceivable` devolve `filename` `recibo-joao-da-silva-10-2026.pdf` para
  "João da Silva" com competência 2026-10. Atualizar os asserts atuais
  (`recibo-contribuicao-acolhido-000001.pdf`, e o "mesmo filename" em downloads repetidos
  continua valendo). O recibo do associado mantém o nome atual.
- `residentReceiptFilename` (teste em `packages/types` ou no spec do service):
  - acentos e cedilha (`Conceição` → `conceicao`);
  - espaços múltiplos e pontuação;
  - mês de 1 dígito com zero à esquerda;
  - nome vazio → `recibo-10-2026.pdf`, sem hífen duplo.
- `PATCH` trocando `receiptType` para um tipo livre → ok; para um tipo já usado → 400/409 (o que o
  service já devolve). Cobrir se ainda não houver teste.

### Backend: `pnpm test:api:e2e`

- Gerar o recibo de uma parcela paga do filho sem template `RESIDENT_CONTRIBUTION` → 404 com o
  `code`. Com o template → 200 PDF.
- Fixtures próprias via API, removidas por id (story 182). Não apagar templates do seed.

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- **`TemplateCard`**: recibo mostra o badge com o rótulo do tipo; template de documento não mostra.
- **`CreateTemplateDialog`**:
  - abre sem tipo selecionado;
  - submit sem tipo → erro de validação;
  - com `initialReceiptType` → abre com ele selecionado;
  - tipos tomados não aparecem.
- **`ReceiptTypeField`**:
  - lista o tipo atual e os livres;
  - trocar chama o update com o `receiptType`;
  - erro de conflito aparece.
- **`DocumentTemplatesTab`**:
  - o cabeçalho do editor mostra o tipo;
  - `?newReceipt=RESIDENT_CONTRIBUTION` abre o dialog com o tipo;
  - param inválido abre sem seleção.
- **`lib/errors`**: extrai `code`/`receiptType` de erro JSON e de erro `Blob`.
- **`useReceivableReceipt` / `ReceivableRow`**:
  - 404 com o `code` mostra a mensagem e o botão "Cadastrar template", que navega para
    `/settings/templates?newReceipt=RESIDENT_CONTRIBUTION`;
  - 404 sem `code` mostra só a mensagem.
- **`useChargeReceipt` / `ChargeRow`**: idem com `ASSOCIATE_CONTRIBUTION`.
- **`useReceivableReceipt`**: o download dispara `triggerDownload` com
  `recibo-<slug>-<MM>-<AAAA>.pdf` (atualizar `useReceivableReceipt.test.tsx`, que hoje espera o
  uuid).

### `app.fonte`: unit (`pnpm test:app:unit`)

- `receiptFile.test.ts` e `useContributions.test.tsx`: o arquivo gravado e compartilhado tem o nome
  novo, e cache nulo/indefinido continua tratado.

### `adm.fonte`: e2e (`pnpm test:adm`)

- Templates: criar um template de recibo escolhendo explicitamente "Contribuição mensal do
  acolhido", ver o badge na lista, trocar o tipo no editor e ver o badge mudar.
- A fixture é criada e removida por id no `afterAll` (story 182).

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir `document-template` e
`receipt`, e `pnpm test:adm:unit` com cobertura: componentes novos/alterados de `features/settings`
e os hooks de recibo ≥90%, e `pnpm test:app:unit` sem reduzir `features/contributions`. Sem `skip`/`only`/`xfail` sem justificativa explícita no código
(CLAUDE.md).

---

## Fora de escopo

- Tipos de recibo novos (pizza, pão etc.) ou resolver para eles.
- Mais de um template por tipo (a regra da story 178 continua).
- Corrigir o template "teste" em produção. É operação manual: trocar o tipo pelo editor novo ou
  criar o do acolhido.
- Deploy do `adm` em produção.
- **Nome do arquivo do recibo do associado** (`recibo-<uuid>.pdf` no `adm`): a decisão 5 é só para
  o recibo do filho.
