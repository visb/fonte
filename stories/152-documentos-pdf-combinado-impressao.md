# Plan: PDF combinado dos documentos do filho para impressão em lote

## Context

No acolhimento, o operador precisa imprimir **vários documentos** para o filho e o responsável
assinarem. Hoje a aba **Anexos** (`features/residents/components/tabs/AttachmentsTab.tsx`) só
permite baixar **um documento por vez** (`Baixar PDF` em cada card), o que significa abrir N
downloads, N diálogos de impressão e N chances de errar. O pedido é: **selecionar vários e gerar
um único PDF**, com a garantia de que **um documento nunca começa na mesma página onde outro
terminou** — cada documento sempre abre em página nova.

### Decisões travadas (refinadas nesta sessão)

1. **Escopo da seleção: apenas documentos de template.** Os cards de "Documentos de acolhimento"
   (obrigatórios) e "Documentos para assinatura no acolhimento" (`signAtAdmission`) ganham
   checkbox. Os **anexos enviados** ("Outros anexos") **ficam de fora** — são arquivos crus de
   mimetype arbitrário (o `attachmentOptions` do controller não filtra tipo), e tratá-los exigiria
   normalizar imagem→A4 e bloquear tipos não suportados. Registrado como possível story futura.
2. **Montagem no backend, endpoint novo.** O `adm.fonte` manda a lista de `templateIds`; a API
   renderiza, junta e devolve **um stream**. Motivo: reusa auth/`@Audit`, não expõe URLs do bucket
   ao browser, e evita duplicar no frontend a lógica de render que já existe no
   `DocumentTemplateService`.
3. **Quebra de página por construção: N PDFs A4 mesclados, não um HTML concatenado.** Concatenar
   os HTMLs num único `wrapPage` com `page-break-after: always` quebraria a **convenção de margem
   única da story 24** (`page.pdf` com margin zerada; a margem real é o `padding` do `body` do
   `DOCUMENT_PRINT_CSS`) — o `padding` do body só vale na primeira e na última página do fluxo, então
   o 2º documento em diante encostaria na borda do papel. Mesclando PDFs já renderizados, cada
   documento sai **byte a byte idêntico** ao download individual já validado e, por ser um PDF
   inteiro, **começa obrigatoriamente em página nova**. Requer uma dep nova de merge (`pdf-lib`).
4. **Ordem = ordem da tela**: obrigatórios → assinatura no acolhimento, na mesma ordem em que os
   cards são renderizados. Sem reordenação manual.
5. **Templates opcionais ficam de fora**: eles não têm card (só aparecem no dropdown "Gerar
   documento"), então não há onde colocar checkbox sem redesenhar a seção.
6. **Pré-voo idêntico ao download individual.** O botão de gerar combinado passa pelos mesmos
   gates já existentes: `SignatureDialog` (story 128) se algum template usa `{{signature}}` e o
   staff logado não tem assinatura; e `MissingFieldsDialog` com a **união** dos campos faltantes de
   todos os templates selecionados. Gerar um combinado com `{{signature}}` cru ou com campos vazios
   seria pior que o fluxo atual, não melhor.

Depende de nada em aberto; encosta em [[128-assinatura-do-usuario-em-documentos]] (gate de
assinatura), [[24-editor-template-preview-a4]] (convenção de margem única) e
[[135-assinatura-pdf-url-quebrada-local]] (URLs assinadas no render).

## Desenho

### Backend

1. **Dep**: adicionar `pdf-lib` em `services/api` (merge puro em JS, sem binário nativo).
2. `DocumentTemplateService.generateCombinedPdf(templateIds: string[], resident, signerUserId?)`:
   - valida que `templateIds` não é vazio e que **todo id existe** (`findOne` já lança
     `NotFoundException`);
   - para cada id **na ordem recebida**, reusa o `generatePdf` atual (mesma `getBrowser()`,
     páginas abertas e fechadas em sequência para não estourar memória);
   - mescla com `pdf-lib` (`PDFDocument.create()` + `copyPages` de cada buffer, na ordem);
   - devolve `{ buffer, filename }` com `filename = slugify(`${resident.name} documentos`) + '.pdf'`.
3. **Rota** em `resident.controller.ts`, ao lado do `GET :id/documents/:templateId/pdf`:
   `POST :id/documents/combined-pdf`, body DTO `GenerateCombinedPdfDto { templateIds: string[] }`
   validado com `class-validator` (`@IsArray`, `@ArrayNotEmpty`, `@IsUUID('4', { each: true })`).
   `POST` porque a lista de ids pode ficar longa demais para query string. Mesmos guards/roles do
   endpoint individual, `@Audit('resident.document.combined-pdf', 'resident')`, resposta
   `application/pdf` + `Content-Disposition: attachment`.
4. **Atualizar `fonte-api.postman_collection.json`** com o endpoint novo (regra do CLAUDE.md).

### Contrato

5. `packages/api-client`: `api.residents.downloadCombinedDocumentsPdf(residentId, templateIds)`
   devolvendo `Blob`, no mesmo padrão do `downloadDocumentPdf` já existente.

### Frontend (`adm.fonte`)

6. `AttachmentsTab` passa a manter `selectedTemplateIds: Set<string>`. `DocumentCard` recebe
   `selected` + `onToggleSelect` e renderiza um checkbox à esquerda do ícone. A seleção vale para
   os dois grupos de cards (obrigatórios e assinatura no acolhimento).
7. **Barra de ação** (componente próprio, ex. `CombinedPdfBar`) aparece só com ≥1 selecionado:
   contagem ("3 documentos selecionados"), botão **"Gerar PDF combinado"** (com `Loader2` durante a
   geração) e "Limpar seleção". Erro reusa o bloco `role="alert"` + `getErrorMessage` já existente.
8. O handler de gerar combinado reusa `extractTemplateVars`/`findMissingFields` para **todos** os
   templates selecionados (união dos campos, deduplicada por `residentField`) e dispara
   `SignatureDialog` / `MissingFieldsDialog` antes do download, exatamente como o `handleGenerateRequest`
   individual. Após salvar no diálogo, retoma a geração combinada.
9. `AttachmentsTab` já passa de 150 linhas — extrair `DocumentCard`, `AttachmentRow`,
   `AttachmentUploadButton` e a nova barra para arquivos próprios em
   `features/residents/components/tabs/`, deixando a tab como orquestradora (regra de decomposição
   do CLAUDE.md).

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** — `pnpm test:api` e `pnpm test:api:cov` verdes com cobertura ≥90 do código
tocado, `pnpm --filter adm.fonte test:unit:cov` idem, e `pnpm build:api-client` verde (contrato mudou).

- **Unit `document-template.service.spec.ts`**: `generateCombinedPdf` com 2+ templates chama o
  render de cada um **na ordem recebida**; o PDF resultante tem a **soma** das páginas dos
  individuais (garante que nada foi concatenado dentro da mesma página); `templateIds` vazio →
  `BadRequestException`; id inexistente → `NotFoundException`; falha no meio não deixa página do
  puppeteer aberta (`page.close()` no `finally`).
- **Unit `resident.controller.spec.ts`**: `POST :id/documents/combined-pdf` seta
  `Content-Type: application/pdf` e o `Content-Disposition` com o filename combinado; DTO rejeita
  array vazio e uuid inválido; roles não autorizadas são barradas.
- **E2E (`pnpm test:api:e2e`)**: acolhido com 2 templates obrigatórios → `POST` devolve 200 com
  corpo `%PDF` e tamanho > 0; `templateIds` vazio → 400.
- **Unit `AttachmentsTab.test.tsx`** (+ specs dos componentes extraídos): sem seleção a barra não
  aparece; ao marcar 2 cards a barra mostra a contagem e o clique chama o client com os ids **na
  ordem da tela**; template com `{{signature}}` e staff sem assinatura → abre `SignatureDialog` e
  **não** chama o endpoint; campos faltantes em qualquer selecionado → abre `MissingFieldsDialog`
  com a união deduplicada; erro do endpoint renderiza o alerta com a mensagem de
  `getErrorMessage`; "Limpar seleção" esvazia a barra.
- **`@fonte/api-client`**: unit de `downloadCombinedDocumentsPdf` (monta o POST no path certo com
  o body `{ templateIds }` e devolve `Blob`).

## Fora de escopo

- Incluir **anexos enviados** ("Outros anexos") no PDF combinado — decisão 1; exige normalizar
  imagem→A4 e bloquear mimetypes não suportados.
- Incluir **templates opcionais** (os do dropdown "Gerar documento") — decisão 5.
- Reordenar manualmente os documentos (drag-and-drop) — decisão 4 fixa a ordem da tela.
- Enviar direto para a impressora / abrir diálogo de impressão: a story entrega o download do PDF.
- Persistir o PDF combinado no bucket ou registrá-lo como `ResidentDocument` — é artefato
  descartável de impressão.
- Mudar a convenção de margem/paginação do `DOCUMENT_PRINT_CSS` (story 24).
