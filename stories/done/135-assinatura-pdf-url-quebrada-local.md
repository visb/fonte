# Plan: Corrigir assinatura com URL quebrada no PDF gerado (modo local)

## Context

Bloco do BACKLOG **"Assinatura nos documentos"** — este é o 1º dos 4 itens desse bloco
(demais viram stories próprias: alinhamento do `{{signature}}`, remover role/bold abaixo da
assinatura, botão "redefinir" no perfil).

A assinatura desenhada pelo staff (story 128) é impressa nos documentos gerados via
`{{signature}}`. **Ao gerar o PDF em ambiente local (não-S3), a imagem da assinatura sai como
imagem quebrada.**

### Causa raiz (investigada)

- `StorageService.upload` em modo local retorna caminho **relativo** `/uploads/signatures/<file>`
  (`storage.service.ts` — branch sem S3).
- `DocumentTemplateService.resolveSigner` só pré-assina a URL quando `isS3Url(...)` é verdadeiro
  (URL começa com `publicBaseUrl`). Em local isso é falso, então `signatureUrl` chega **cru e
  relativo** ao `buildSignatureBlock`, que injeta `<img src="/uploads/signatures/...">`.
- `generatePdf` renderiza via `page.setContent(html)` **sem base URL**. Puppeteer não tem origin
  para resolver o caminho relativo → **imagem quebrada**.

### Por que só a assinatura quebra (e imagem de conteúdo não)

Confirmado com o usuário: **imagem inserida direto no editor aparece certa no PDF.** Motivo: o
upload de imagem de conteúdo grava no HTML a URL já **absoluta** — o frontend monta o `src` com
`api.photoUrl(url)` (`packages/api-client/src/client.ts`), que prefixa o origin da API a caminhos
relativos. A assinatura, ao contrário, é injetada **no backend** direto de `staff.signatureUrl`
(relativo), sem esse prefixo. Portanto o bug é **exclusivo da assinatura**; imagens de conteúdo
já saem absolutas e resolvem no puppeteer.

Em **produção (S3)** a assinatura já funciona: `resolveSigner` presigna e devolve URL absoluta.
O defeito é **apenas modo local / não-S3**.

### Decisões travadas

1. **Escopo: signature-only.** Confirmado com o usuário — imagem de conteúdo já funciona; não
   mexer nesse fluxo. Corrige só o bloco de assinatura.
2. **Fix por data URI (não por origin).** Em modo **não-S3**, quando `signatureUrl` for caminho
   local `/uploads/...`, ler o arquivo do disco e inline como **data URI**
   (`data:<mime>;base64,...`) no `<img src>` da assinatura. Preferido a prefixar um API origin
   porque **não depende de env/porta/host reachable** pelo puppeteer e funciona em qualquer
   ambiente local. Reusar `StorageService.download(url)` (já lê `/uploads` do disco) para obter o
   buffer; mime inferido pela extensão do arquivo (png/jpg/jpeg/webp).
3. **S3 intacto.** Em modo S3 (`isS3Mode()` true) manter o caminho atual (`signUrl` presign). O
   data URI é só o ramo local.
4. **Ponto do fix: backend, em `resolveSigner`.** É lá que a URL da assinatura é resolvida hoje
   (decisão 7 da 128: `applyVariables` é síncrono, a URL tem que chegar pronta). Manter esse
   contrato: `resolveSigner` continua devolvendo `signatureUrl` já pronto para `<img>`, agora com
   o ramo data-URI para local.

## Desenho

- **`services/api/src/modules/storage/storage.service.ts`**
  - Adicionar helper para transformar uma URL de mídia local numa data URI. Sugestão:
    `async toDataUri(url: string): Promise<string>` — em modo não-S3 e URL `/uploads/...`, lê via
    `download(url)`, infere mime pela extensão e devolve `data:<mime>;base64,<...>`. Fora desse
    caso (S3 ou URL já absoluta/externa), devolve a URL inalterada. Mime helper interno
    (`extname` → `image/png|jpeg|webp`), fallback `application/octet-stream` improvável para
    assinatura (sempre PNG desenhado).
- **`services/api/src/modules/document-template/document-template.service.ts`**
  - Em `resolveSigner`, no ramo em que hoje devolve `staff.signatureUrl` cru (não-S3), passar por
    `storageService.toDataUri(...)` para inline. Ramo S3 (`isS3Url` → `signUrl`) fica igual.
  - `buildSignatureBlock` não muda: continua recebendo um `src` pronto.
- **Sem migration, sem mudança de contrato (`packages/types` / `api-client`), sem mudança de
  frontend.** Postman não muda (endpoints iguais).

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. Rodar `pnpm test:api:cov` cobrindo o código tocado (≥90% do escopo novo).

- **Unit — `storage.service.spec.ts`** (novo helper `toDataUri`):
  - modo não-S3 + URL `/uploads/signatures/x.png` → devolve `data:image/png;base64,...` com o
    conteúdo lido do disco (mock de `download`/`readFile`).
  - mime por extensão: `.png` → `image/png`, `.jpg`/`.jpeg` → `image/jpeg`, `.webp` → `image/webp`.
  - modo S3 → devolve a URL inalterada (não inline).
  - URL absoluta/externa (`http...`) → inalterada.
- **Unit — `document-template.service.spec.ts`** (`resolveSigner` / render):
  - modo não-S3 com `staff.signatureUrl` relativo → o HTML de `renderForResident` contém
    `<img ... src="data:image/png;base64,...">` no bloco de assinatura (não mais `/uploads/...`).
  - modo S3 → segue chamando `signUrl` (comportamento atual preservado; sem regressão).
  - staff sem `signatureUrl` → bloco de assinatura sai só com a linha + nome (sem `<img>`),
    inalterado.
- **E2E — `document-templates.e2e-spec.ts`**: se já houver caso de geração de documento com
  assinatura, garantir que continua verde; caso o ambiente de teste rode em modo local, afirmar
  que o `<img>` da assinatura não é um caminho relativo quebrado (é data URI ou ausente).

## Fora de escopo

- Alinhamento do `{{signature}}` (centralizado no editor mas à esquerda no PDF) — story própria.
- Remover role e bold do nome abaixo da assinatura — story própria.
- Botão "redefinir" assinatura no perfil — story própria.
- Placeholder visual do `{{signature}}` no editor — bloco "Editor de templates".
- Qualquer mudança no fluxo de imagem de conteúdo (já funciona).
- Introduzir env de API base URL no backend (evitado de propósito pela decisão 2).
