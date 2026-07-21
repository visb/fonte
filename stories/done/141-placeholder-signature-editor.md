# Plan: Placeholder visual do {{signature}} no editor (ocupa o espaço da assinatura no PDF)

## Context

Bloco do BACKLOG **"Editor de templates de documentos"** — 3º e **último** item. Com esta story o
bloco e o BACKLOG atual fecham.

No editor de template (`TemplateEditor.tsx`, adm.fonte) a variável de assinatura aparece como o
texto cru **`{{signature}}`**. Ao gerar o PDF, esse token vira o **bloco de assinatura** (imagem
~64px + linha + nome — ver `document-template.service.ts`). Como o token cru ocupa só uma linha de
texto, a **paginação da folha A4 no editor não bate** com a do PDF (o editor foi feito para casar
1:1 com o print — convenção da story 24). Pedido: substituir, **no editor**, o `{{signature}}` por
um **placeholder que ocupe o mesmo espaço** que a assinatura ocupará no PDF.

### Restrição de arquitetura (investigada) — não quebrar o backend

As stories 135/136/137 dependem do **texto `{{signature}}` literal** permanecer no HTML salvo:

- story 136 detecta o parágrafo `<p …>{{signature}}</p>` para carregar o alinhamento;
- o backend substitui o token `{{signature}}` cru pelo bloco.

Portanto **não** transformar o token num nó TipTap com wrapper/markup próprio (ex:
`<span data-signature>…`), pois isso quebra o regex do parágrafo (136) e a substituição do token.

### Solução (decisão travada)

**Decoration do ProseMirror** (via extensão TipTap com um `Plugin`): renderiza um **widget
placeholder por cima** de cada ocorrência do texto `{{signature}}`, **sem alterar o documento**. O
texto subjacente continua `{{signature}}`, então:

- `editor.getHTML()` → segue emitindo `{{signature}}` (dentro do `<p>` com seu `text-align`) →
  backend 135/136/137 funcionam **sem mudança**;
- só a **apresentação** no editor muda.

### Decisão de produto (confirmada com o usuário)

**Caixa rotulada do tamanho certo.** O placeholder é um **retângulo tracejado com rótulo
"Assinatura"** cuja **altura iguala** o espaço que o bloco ocupa no PDF (margem-topo 24px + imagem
64px + linha + nome). Objetivo primário: **ocupar o espaço correto** para a paginação A4 do editor
casar com o PDF. Visual limpo, sem replicar o desenho real do bloco.

### Decisões travadas

1. **Documento inalterado — decoration, não nó.** O texto `{{signature}}` permanece no doc; o
   placeholder é um widget/inline-decoration renderizado sobre ele. `getHTML` não muda.
2. **Altura fiel ao bloco do PDF.** A caixa deve ter a **mesma altura** do bloco de assinatura
   renderizado (referência: CSS `.doc-signature` em `document-template.service.ts` — `margin-top:24px`,
   `.doc-signature-img{height:64px}`, linha + nome). Centralizar/definir a altura para preservar a
   paginação (story 24). Se a assinatura mudar de altura no futuro, manter a constante de altura
   próxima e comentada para sincronizar.
3. **Alinhamento respeitado.** Como o widget vive dentro do `<p>`, o `text-align` do parágrafo
   (story 136) continua posicionando o placeholder — consistente com o PDF.
4. **Sem regressão de edição.** O usuário ainda consegue selecionar/apagar o `{{signature}}` (o
   texto está lá); inserir via clique (139) ou drag-and-drop (140) continua colocando o token, que
   passa a ser exibido como placeholder.
5. **Sem backend/contrato/Postman/migration.** Puramente editor do adm.

## Desenho

- **`apps/adm.fonte/src/features/settings/components/`** — nova extensão TipTap
  (ex: `SignaturePlaceholder.ts`):
  - `Extension.create` com `addProseMirrorPlugins()` retornando um `Plugin` que, via
    `DecorationSet`, varre o doc por `{{signature}}` e adiciona uma decoration (widget substituindo
    a extensão do texto, ou inline decoration estilizando-o como a caixa). Recalcula no `apply`/
    docChanged.
  - A caixa: `border` tracejada, rótulo "Assinatura", `height` = altura do bloco do PDF (constante
    comentada, referenciando o CSS do service). Não editável internamente; o texto por trás
    permanece o token.
- **`TemplateEditor.tsx`**
  - Registrar a extensão no array de `extensions` do `useEditor`.
- **Sem mudança no backend nem em `document-template.service.ts`** (as stories 135/136/137 já cobrem
  o render; esta só adiciona o visual no editor).

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. Runner de unit do adm (Vitest) cobrindo o código novo (≥90% do escopo).

- **Unit — helper puro:** extrair a busca de ocorrências (`findSignatureRanges(doc/text)`) e
  testá-la: 0, 1 e N ocorrências de `{{signature}}` retornam os ranges corretos; texto sem token →
  vazio.
- **Unit/integração — editor:** montar o editor com conteúdo `<p>{{signature}}</p>` e afirmar:
  - a decoration/placeholder é aplicada (widget/atributo presente no range do token);
  - **`editor.getHTML()` continua contendo `{{signature}}`** (o documento não foi alterado) — guarda
    contra quebrar o backend.
  - conteúdo sem o token → nenhum placeholder.
- **Regressão:** clique (139) e drag-and-drop (140) inserem `{{signature}}` e o placeholder aparece;
  apagar o token remove o placeholder.
- **Paginação (se coberto por e2e/visual no `test:adm`):** verificar que a folha A4 do editor com o
  placeholder não diverge da paginação esperada; caso não haja harness visual, documentar e cobrir a
  altura por unit (constante = altura do bloco).

## Fora de escopo

- Qualquer mudança na renderização/substituição do `{{signature}}` no backend (stories 135/136/137).
- Preview fiel do desenho da assinatura (imagem real + linha + nome) — decidido pela caixa rotulada.
- Placeholder para outras variáveis (só `{{signature}}`, que é a única com bloco multi-linha).
- Barra de variáveis (139) e drag-and-drop (140) — pré-requisitos já planejados.
