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

Manter `max-width: 100%` **apenas** como proteção contra estouro da página A4 (senão a imagem vaza a margem no PDF), mas como agora o nó nasce com `width/height` naturais, a imagem só será reduzida se de fato exceder a largura útil — e nesse caso o usuário vê e ajusta. Documentar no código que o `max-width:100%` é guarda de página, não "tratamento".

> Se o requisito for **literal** ("exibir os pixels exatos, mesmo que estourem a A4"), trocar `max-width:100%` por `max-width:none` na `ResizableImage` e no wrapper do PDF — ver §Refinamentos. Isso permite imagem maior que a página (cortada na impressão). Decisão do usuário.

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

1. **Estouro da A4**: imagem maior que a largura útil deve (a) ser limitada a 100% da página [proposta] ou (b) manter pixels exatos e ser cortada na impressão? Define `max-width:100%` vs `none`.
2. **DPI**: o usuário pensa em "tamanho do arquivo" em px (naturalWidth) ou em cm/polegadas? px é o que o navegador/puppeteer entende; se precisar respeitar DPI físico, é outra conta (px = cm × DPI). Proposta: usar px natural.
3. Confirmar se há **algum** outro ponto do fluxo que reprocessa (CDN/Railway object storage com transform?) — investigar antes de fechar.
