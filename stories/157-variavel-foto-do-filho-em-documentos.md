# Plan: variável `{{residentPhoto}}` — foto do filho nos documentos

## Context

Os templates de documento substituem hoje 24 variáveis, todas **texto**
(`document-template.service.ts:308-332`), mais o caso especial `{{signature}}`, que vira um **bloco
HTML com imagem**. A foto do acolhido existe no sistema desde sempre
(`resident.entity.ts:146-151` — `photo_url` original e `photo_thumb_url` 70×70, subidas em
`resident.service.ts:641-667`), mas **só aparece em tela**: não há nenhuma forma de imprimi-la numa
ficha gerada. Quem monta a ficha de acolhimento hoje imprime o documento e cola a foto à mão, sem
sequer um espaço reservado — o texto ocupa a folha inteira.

Esta story cria `{{residentPhoto}}`, a **segunda variável de bloco** do sistema, seguindo o caminho
já aberto pela `{{signature}}` nas stories [[128-assinatura-do-usuario-em-documentos]],
[[135]], [[136]] e [[141]]: bloco HTML no backend + caixa rotulada no editor.

### Decisões travadas (refinadas nesta sessão)

1. **Sem foto → moldura vazia com o rótulo `Foto` dentro.** É o análogo direto da linha de 25 `_`
   que a `{{signature}}` imprime quando o staff não tem assinatura: o papel sai com o espaço
   reservado, pronto para colar a foto à mão. **Nunca bloqueia a geração** — não existe
   `MissingFieldsDialog` para foto.
2. **Quadrado ~4×4 cm** (151px a 96 dpi), com `object-fit: cover`. Mesma proporção do avatar já
   usado nas telas, então a foto cadastrada não sofre recorte de proporção alheia. Tamanho **fixo**,
   não configurável no template — a altura fixa é o que preserva a paginação A4 (convenção da
   [[24]], mesma razão do `height:64px` da assinatura).
3. **Token `{{residentPhoto}}`**, não `{{photo}}`. Diverge de propósito da convenção "campo do filho
   sem prefixo" (`{{name}}`, `{{cpf}}`): a variável é explícita sobre de quem é a foto e deixa o
   espaço aberto para um `{{responsiblePhoto}}` futuro sem renomear nada.
4. **Usa `resident.photoUrl` (original), não `photoThumbUrl`.** O thumb é 70×70
   (`resident.service.ts:624`); esticado para 4 cm imprimiria a ~44 dpi, borrado.
5. **A URL passa por `canonicalizeS3Url` antes de `signUrl`/`toDataUri`**, exatamente como
   `resolveSigner` (`document-template.service.ts:246-258`). Dois motivos: (a) em modo local a URL é
   `/uploads/residents/…`, que o puppeteer não resolve — tem que virar data URI (regra da [[135]]);
   (b) canonicalizar primeiro evita assinar de novo uma URL que já venha assinada.
6. **O editor ganha caixa rotulada, como a assinatura.** O token cru ocupa uma linha; o bloco no PDF
   ocupa 151px. Sem a caixa, a régua A4 do editor mente sobre onde a página quebra — foi exatamente
   o bug que a [[141]] consertou para a assinatura.
7. **Sem migration, sem endpoint novo, sem mudança de contrato** — a substituição é in-memory no
   render, e os três endpoints que geram documento
   (`resident.controller.ts:523`, `:537`, `:556`) já recebem o `resident` inteiro. Portanto **não há
   atualização de `fonte-api.postman_collection.json`** nesta story.

Não depende de nenhuma story em aberto.

## Desenho

### Backend (`services/api`, módulo `document-template`)

1. **`resolveResidentPhotoUrl(resident): Promise<string | null>`** — espelha `resolveSigner`
   (`:246`): sem `resident.photoUrl` → `null`; senão `canonicalizeS3Url` →
   `isS3Url ? signUrl : toDataUri` (decisão 5). Chamado em `renderForResident` (`:233`) ao lado do
   `resolveSigner`, porque `applyVariables` é síncrono e não pode aguardar.

2. **`buildResidentPhotoBlock(photoUrl: string | null, align?: string): string`**:
   - com foto → `<div class="doc-photo"><img class="doc-photo-img" src="…" alt="Foto"/></div>`
   - sem foto → `<div class="doc-photo"><div class="doc-photo-placeholder">Foto</div></div>`
   - `align` vira `style="text-align:…"` no `<div class="doc-photo">`, igual ao bloco de assinatura.

3. **Extrair o mecanismo de token-de-bloco**, hoje escrito uma vez só para a assinatura
   (`:339-358`), para um helper privado
   `replaceBlockToken(html: string, token: string, build: (align?: string) => string): string` que faz,
   nesta ordem:
   - troca do **`<p …>` inteiro** quando o token é o único conteúdo visível do parágrafo, carregando
     o `text-align` via `extractTextAlign` — evita `<div>` dentro de `<p>` e preserva o alinhamento;
   - **fallback inline** para ocorrências remanescentes, sempre com `replace` **por função** (o `$`
     de uma URL presignada não pode ser lido como padrão de replace).

   A constante `SIG_WRAP` (`:351`) passa a se chamar `TOKEN_WRAP` e é compartilhada. `{{signature}}`
   e `{{residentPhoto}}` passam a ser duas chamadas do mesmo helper; o comportamento da assinatura
   fica **idêntico** (as regressões das stories 136/137 provam isso).

4. `applyVariables(content, resident, responsible, signer?, residentPhotoUrl?)` ganha o parâmetro
   novo e chama `replaceBlockToken` para os dois tokens.

5. **CSS no `wrapPage`** (`:397-412`), junto do bloco `.doc-signature*`, com a mesma justificativa de
   altura fixa da [[24]]:
   ```css
   .doc-photo-img{width:151px;height:151px;object-fit:cover;display:inline-block;vertical-align:top}
   .doc-photo-placeholder{width:151px;height:151px;box-sizing:border-box;border:1px solid #333;
     display:inline-flex;align-items:center;justify-content:center;color:#666;vertical-align:top}
   ```
   151px ≈ 4 cm a 96 dpi (decisão 2). Comentar o número, senão vira mágica.

6. Nada muda em `generatePdf`, `generateCombinedPdf` ou nos controllers: a variável entra pelo
   `renderForResident`, que os três caminhos já usam — vale igual no preview HTML, no PDF individual
   e no PDF combinado da [[152]].

### Frontend (`adm.fonte`)

7. **Catálogo** (`features/settings/components/templateVariables.ts:17`) — entrada nova, junto dos
   campos do acolhido:
   `{ key: '{{residentPhoto}}', label: 'Foto do acolhido', description: 'Foto do acolhido em 4×4 cm; moldura vazia com o rótulo "Foto" se não houver' }`.
   `filterVariables` e `buildVariableInsertion` funcionam sem alteração; barra lateral,
   drag-and-drop ([[140]]) e autocomplete inline ([[144]]) herdam de graça.

8. **Caixa no editor** (decisão 6). `SignaturePlaceholder.ts` é hoje uma extensão TipTap
   monolítica amarrada ao token da assinatura. Generalizar em `tokenPlaceholder.ts`:
   uma fábrica `createTokenPlaceholder({ token, label, dataKey, widthPx, heightPx, marginTopPx })`
   que devolve `{ Extension, findRanges, buildDecorations }`, com a mesma mecânica atual —
   `Decoration.inline(display:none)` sobre o token cru + `Decoration.widget` com a caixa tracejada,
   clique seleciona o range, `×` remove, recálculo só em `tr.docChanged`, **documento intocado**
   (`editor.getHTML()` continua emitindo o token literal, contrato que o backend exige).
   - `SignaturePlaceholder` vira uma chamada da fábrica com
     `{ token: '{{signature}}', label: 'Assinatura', dataKey: 'signature', width: 260, height: 100, marginTop: 24 }`
     e **mantém os mesmos exports e atributos DOM** (`SIGNATURE_TOKEN`, `findSignatureRanges`,
     `buildSignatureDecorations`, `data-signature-placeholder`, `data-signature-remove`) — os testes
     existentes não mudam.
   - `ResidentPhotoPlaceholder` é a segunda chamada:
     `{ token: '{{residentPhoto}}', label: 'Foto do acolhido', dataKey: 'resident-photo', width: 151, height: 151, marginTop: 0 }`.
     As dimensões espelham o CSS do item 5 e ficam comentadas apontando para lá, como já se faz em
     `SignaturePlaceholder.ts:23-33`.
   - Registrar a extensão nova no `useEditor` de `TemplateEditor.tsx:462`, ao lado da assinatura.

9. **Gate de campos faltantes** (`features/residents/lib/documentFields.ts:21`) — incluir
   `residentPhoto` em `ALWAYS_AVAILABLE`, com comentário: a ausência de foto vira placeholder
   impresso (decisão 1), então nunca abre o `MissingFieldsDialog`. Hoje `findMissingFields` já a
   ignoraria por acaso (não existe em `VAR_TO_FIELD`); a entrada torna isso **intencional e
   testado**. `useDocumentGeneration.ts:88-92` (o gate da assinatura) **não muda** — foto nunca
   interrompe a geração.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. **Gate: código novo sem teste não
fecha a story** — `pnpm test:api` + `pnpm test:api:cov` e `pnpm --filter adm.fonte test:unit:cov`
verdes, com cobertura ≥90 do código tocado e sem reduzir a de `document-template` nem a de
`features/settings` / `features/residents`. Sem mudança de contrato ⇒ `build:types` /
`build:api-client` não são exigidos; sem migration ⇒ sem `migration:run:test`.

- **Unit `document-template.service.spec.ts`** (ao lado do bloco de assinatura, `:645-975`):
  - filho **com** foto → HTML tem `<img class="doc-photo-img">` com a URL **assinada** e **não** tem
    o placeholder;
  - filho **sem** foto → HTML tem `.doc-photo-placeholder` com o texto `Foto` e **nenhum `<img>`**
    de foto;
  - modo não-S3 (`/uploads/residents/…`) → a `src` sai como **data URI** (regressão da [[135]]);
  - URL já assinada na entrada → assinada **uma vez só** (decisão 5);
  - token sozinho num `<p style="text-align:center">` → o bloco herda o alinhamento e o `<p>` some
    (sem `<div>` dentro de `<p>`); token embrulhado em `<span>`/`&nbsp;` idem;
  - ocorrência inline no meio de um parágrafo → fallback aplicado, `{{residentPhoto}}` **nunca** sai
    cru no papel;
  - template sem o token → nenhum `.doc-photo` no HTML;
  - **regressão**: toda a bateria de `{{signature}}` das stories 128/135/136/137 continua verde após
    a extração do `replaceBlockToken` (nada a reescrever — os testes atuais são o critério).
- **E2E `test/document-templates.e2e-spec.ts`** (ao lado do bloco da story 128, `:296-365`):
  `GET /residents/:id/documents/:templateId/render` com template usando `{{residentPhoto}}` —
  um filho **com** foto devolve a imagem, um **sem** foto devolve a moldura, e nenhum dos dois
  devolve o token cru.
- **Unit `adm.fonte`**:
  - `templateVariables.test.ts` — a key nova está em `VARIABLES`; `filterVariables('foto')` a
    encontra; `buildVariableInsertion('residentPhoto')` devolve exatamente um par de chaves;
  - `templateDrop.test.ts` — `isVariableToken('{{residentPhoto}}')` é `true` (drag-and-drop da
    [[140]] reconhece o token novo);
  - `ResidentPhotoPlaceholder` (spec novo, espelhando `SignaturePlaceholder.test.ts`) — 0/1/N
    ocorrências viram caixa; a caixa tem 151×151; o `×` remove o token; clicar seleciona o range;
    **`editor.getHTML()` ainda contém `{{residentPhoto}}` literal** (o contrato com o backend);
  - `SignaturePlaceholder.test.ts` — **roda inalterado** e continua verde após a generalização
    (é a prova de que a fábrica não mudou a assinatura);
  - `documentFields.test.ts` — `residentPhoto` não entra em `findMissingFields` mesmo com o filho
    sem foto (regressão do `ALWAYS_AVAILABLE`).
- **E2E `apps/adm.fonte/e2e/document-templates.spec.ts`** — inserir `{{residentPhoto}}` pelo
  autocomplete mostra a caixa rotulada no editor e o template salva com o token literal. É o wiring
  ProseMirror que o jsdom não alcança (mesmo motivo do caso `:435-515`).

## Fora de escopo

- **Foto do responsável / de familiares** no documento (`{{responsiblePhoto}}`) — a decisão 3 só
  abre espaço para isso.
- **Tamanho ou moldura configuráveis no template** (decisão 2: fixo, pela paginação A4).
- **Recorte/crop interativo** da foto antes de imprimir — o `object-fit: cover` resolve o
  enquadramento sem UI nova.
- **Upload de foto** — já existe (`POST /residents/:id/photo`), nada muda ali.
- Usar ou gerar um **thumbnail de impressão** dedicado (decisão 4).
- **Bloquear a geração** quando falta foto (decisão 1) — nem `MissingFieldsDialog`, nem diálogo de
  upload no meio do fluxo, como a assinatura faz.
- `ops.fonte` / `app.fonte` — quem edita template e gera documento é o `adm.fonte`.
- Motor de template condicional genérico (`{{#if}}`) — a regra do placeholder fica embutida na
  variável.
