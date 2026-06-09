# Plan: Imagem inserida no editor sem tratamento (fidelidade ao arquivo)

## Context

No editor de templates (`TemplateEditor.tsx`), inserir imagem (botão ou colar do clipboard) chama `uploadFile` → `api.documentTemplates.uploadImage(formData)` → backend `DocumentTemplateService.uploadImage` (`document-template.service.ts:101`), que faz **upload dos bytes originais** sem processamento:

```ts
async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
  const filename = this.storageService.uniqueFilename(file.originalname, 'doc-');
  const url = await this.storageService.upload('documents', filename, file.buffer, file.mimetype);
  return { url };
}
```

`StorageService.upload` também **não** processa (sem `sharp`/resize/recompress — confirmado por busca). Ou seja, **o byte do arquivo já é preservado**. O que o usuário percebe como "tratamento" é, então, **no display/escala**, não na fidelidade do arquivo:

Requisito: "ao adicionar imagens no editor, não deve passar por nenhum tratamento, deve exibir exatamente o arquivo inserido."

A causa provável é a renderização: a `ResizableImage` exibe a imagem **sem `width`/`height` definidos** (`setImage({ src })` em `uploadFile`), e o estilo aplica `max-width: 100%` — então uma imagem maior que a área de conteúdo (editor ~720px / PDF body 800px) é **reduzida visualmente**, dando a impressão de "tratamento". Imagens com DPI alto também aparecem em escala diferente do esperado.

---

## Implementação

### 1. Confirmar (e travar) o caminho sem reprocessamento — backend

Adicionar teste de regressão garantindo que `uploadImage` repassa `file.buffer` e `file.mimetype` **intactos** ao storage (nenhum resize/recompress jamais introduzido). Sem mudança de comportamento — é uma trava.

### 2. Inserir a imagem com as dimensões naturais do arquivo — `TemplateEditor.tsx`

Hoje `setImage({ src })` não define dimensão; o nó nasce sem `width/height` e a renderização cai no fallback `max-width: 100%`. Mudar `uploadFile` para **ler as dimensões naturais** do arquivo antes de inserir e gravá-las no nó (a `ResizableImage` já suporta `width`/`height`):

```ts
const url = api.photoUrl(uploadedUrl) ?? uploadedUrl;
const dims = await readImageSize(file); // cria Image(), lê naturalWidth/Height
editor.chain().focus().setImage({ src: url }).updateAttributes('image', {
  width: dims.width, height: dims.height,
}).run();
```

`readImageSize` = helper que cria um `HTMLImageElement`, espera `onload`, devolve `{ width: naturalWidth, height: naturalHeight }`. Assim a imagem entra no tamanho real do arquivo (em px), exatamente como o arquivo é — o usuário ainda pode redimensionar pelos handles existentes.

### 3. Não forçar downscale silencioso

**Decisão**: manter `max-width: 100%` como **guarda de página** (a imagem grande é reduzida para não vazar a margem da A4). Como o nó agora nasce com `width/height` naturais, a imagem só é reduzida quando de fato excede a largura útil — e aí o usuário vê e ajusta pelos handles. Documentar no código que `max-width:100%` é guarda de página, **não** "tratamento" (não há recompressão/resize de bytes).

### 4. Formatos

`uploadImage` aceita o `mimetype` original; garantir que `accept="image/*"` no input cobre PNG/JP, e que o storage não normaliza extensão. Sem conversão de formato (ex.: não transformar PNG→JPG) — já é o caso.

---

## Testes automatizados (Definition of Done)

| Arquivo | Caso |
| --- | --- |
| `services/api/src/modules/document-template/document-template.service.spec.ts` | `uploadImage` chama `storage.upload` com o **mesmo** `file.buffer` e `file.mimetype` recebidos (sem transformação) |
| `apps/adm.fonte/e2e/document-templates.spec.ts` | Inserir imagem → nó `<img>` salvo com `data-img-width`/`data-img-height` correspondentes às dimensões naturais do arquivo de teste |

Rodar: `pnpm test:api`, `pnpm test:adm`.

## Verificação manual

1. `pnpm dev:adm` → inserir imagem de dimensão conhecida (ex.: 300×120) → entra em 300×120 px no editor.
2. Gerar o PDF → imagem aparece na mesma proporção/qualidade do arquivo (sem recompressão).
3. Inserir imagem maior que a área útil → comportamento conforme decisão do §Refinamentos (cabe na página vs pixels exatos).

---

## Refinamentos pendentes (decisões)

1. ✅ **Estouro da A4**: imagem limitada a 100% da largura útil (`max-width:100%` mantido como guarda). Decidido.
2. **DPI**: usar **px natural** (`naturalWidth`/`naturalHeight`) — é o que navegador/puppeteer entendem. Sem conversão DPI/cm. Proposta mantida.
3. Confirmar que não há outro ponto reprocessando (CDN/Railway object storage com transform on-the-fly) — investigar no início da implementação; o caminho de código está limpo.
