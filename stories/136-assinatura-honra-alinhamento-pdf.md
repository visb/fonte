# Plan: Assinatura no PDF deve honrar o alinhamento definido no editor

## Context

Bloco do BACKLOG **"Assinatura nos documentos"** — 2º item (o 1º virou a story 135; restam ainda:
remover role/bold abaixo da assinatura, botão "redefinir" no perfil).

No editor de template o usuário posiciona `{{signature}}` e aplica alinhamento **centralizado**,
mas ao gerar o PDF a assinatura sai **alinhada à esquerda**.

### Causa raiz (investigada)

- No editor, `{{signature}}` é texto literal dentro de um parágrafo. Com o TextAlign do TipTap, o
  HTML salvo fica `<p style="text-align: center">{{signature}}</p>`.
- Em `DocumentTemplateService.applyVariables`, o token é trocado por
  `buildSignatureBlock`, que devolve um **`<div class="doc-signature">…</div>`** (img sobre a
  linha, nome/role abaixo).
- **`<div>` dentro de `<p>` é HTML inválido:** o parser do puppeteer **fecha o `<p>` antes do
  `<div>`**, então o bloco da assinatura escapa para o nível do body e **perde o `text-align`** do
  parágrafo. Além disso `.doc-signature-img{display:block}` não é centralizável por `text-align`.
- Resultado: independente do alinhamento escolhido, a assinatura cai à esquerda.

### Decisão de produto (confirmada com o usuário)

**Honrar o alinhamento do editor.** O bloco deve respeitar o `text-align` aplicado à linha do
`{{signature}}`: centro→centro, esquerda→esquerda, direita→direita. Sem alinhamento explícito
(default do TipTap) segue à esquerda, como hoje.

### Decisões travadas

1. **Fix no render (backend), não no editor.** O editor já deixa o usuário alinhar; o defeito é a
   perda do alinhamento na substituição do token. Corrigir em `applyVariables`/`buildSignatureBlock`
   + CSS do documento. (O placeholder visual do `{{signature}}` no editor é outro bloco do BACKLOG,
   story separada — não depende desta.)
2. **Substituir o parágrafo inteiro, não só o token.** Quando `{{signature}}` for o único conteúdo
   de um `<p …>`, trocar **todo o `<p …>{{signature}}</p>`** pelo `<div class="doc-signature">`,
   **carregando o `text-align`** do parágrafo para o `style` do div. Isso elimina o `<div>`-em-`<p>`
   inválido (some o breakout) e preserva o alinhamento.
3. **Fallback preservado.** Se `{{signature}}` aparecer inline no meio de outro texto (não sozinho
   num parágrafo), manter a substituição atual do token (comportamento de hoje — à esquerda). Caso
   raro; a assinatura normalmente fica sozinha na sua linha.
4. **CSS centralizável.** Ajustar `.doc-signature-img` de `display:block` para **`display:inline-block`**
   para que o `text-align` do container centralize a imagem; linha (`_`×25) e nome já são
   centralizáveis por `text-align` (herdado). Manter `height:64px` fixo (convenção story 24 de
   paginação) e `margin-top:24px`.

## Desenho

- **`services/api/src/modules/document-template/document-template.service.ts`**
  - `applyVariables`: antes (ou no lugar) da troca `\{\{signature\}\}` → detectar o padrão
    `<p[^>]*>\s*\{\{signature\}\}\s*</p>`, extrair o `text-align` dos atributos do `<p>` (se houver)
    e substituir **o parágrafo inteiro** por `buildSignatureBlock(signer, align)`. Só então rodar o
    replace de fallback do token nu (para ocorrências inline remanescentes).
  - `buildSignatureBlock(signer, align?)`: aceitar um alinhamento opcional e, quando presente,
    emitir `<div class="doc-signature" style="text-align:<align>">…`. Sem align → `<div
    class="doc-signature">` como hoje.
- **`wrapPage` (CSS do documento, no mesmo service):** `.doc-signature-img` → `display:inline-block`
  (era `block`). Demais regras inalteradas.
- **Sem migration, sem mudança de contrato (`packages/types`/`api-client`), sem frontend, sem
  Postman.**

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. `pnpm test:api:cov` cobrindo o código tocado (≥90% do escopo novo).

- **Unit — `document-template.service.spec.ts`:**
  - conteúdo `<p style="text-align: center">{{signature}}</p>` → HTML renderizado contém
    `<div class="doc-signature" style="text-align:center">` e **não** contém mais o `<p>` com o
    token nem `{{signature}}` cru.
  - idem para `right` e `left` (o align do parágrafo aparece no `style` do bloco).
  - `<p>{{signature}}</p>` sem align → `<div class="doc-signature">` sem `style` de alinhamento
    (comportamento atual preservado).
  - `{{signature}}` inline no meio de texto → cai no fallback (bloco inserido, sem quebrar o
    restante) — não regride.
  - staff sem assinatura → bloco sai só com linha + nome, alinhamento ainda honrado.
- **Verificação visual do CSS:** afirmar no teste que o CSS emitido por `wrapPage` traz
  `.doc-signature-img` com `display:inline-block` (guarda contra regressão do centro).

## Fora de escopo

- URL quebrada da assinatura no PDF local (story 135).
- Remover role e bold do nome abaixo da assinatura — story própria (próximo item do bloco).
- Botão "redefinir" assinatura no perfil — story própria.
- Placeholder visual do `{{signature}}` no editor — bloco "Editor de templates de documentos".
- Alinhamento de `{{signature}}` quando inline no meio de um parágrafo com outro texto (fallback
  mantém o comportamento atual).
