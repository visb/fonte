# Plan: margem de página válida em TODAS as páginas do PDF

## Context

Exportando um documento que passa de uma página, a quebra sai "seca": o texto da página 1 corre
até a borda inferior do papel e a página 2 começa colada no topo, sem nenhuma margem.

**Causa raiz.** A margem do documento é hoje o **`padding` do `body`**
(`packages/doc-styles/src/index.ts:71` — `body{…padding:48px 40px…}`), enquanto a margem do
puppeteer é **zerada** (`document-template.service.ts:68` —
`page.pdf({ margin: { top:'0', bottom:'0', left:'0', right:'0' } })`). Isso é a "convenção de
margem única" da story 24. Só que, em paged media, `padding` do body é uma caixa **do fluxo**, não
da página: ele se materializa no topo da **primeira** página e no fim da **última**. Toda página
intermediária — e o pé de qualquer página que não seja a última — sai sangrando até a borda.
`@page`/margem do puppeteer, ao contrário, é margem **da página** e se repete em todas.

**Efeito colateral da mesma causa.** A altura útil real da página 1 é hoje `1123 − 48 = 1075px`
(só o padding-top reserva espaço; o padding-bottom não), e das seguintes é 1123px — mas
`A4_CONTENT_HEIGHT_PX` declara **1027px**, que é o valor que o `.a4-page` do editor usa. Ou seja,
apesar do comentário da story 24 afirmar que a quebra na tela casa com a do PDF, ela **não** casa
em documento multipágina. Mover a margem para a página torna os 1027px verdadeiros e conserta os
dois problemas com a mesma mudança.

### Decisões travadas (refinadas nesta sessão)

1. **Escopo é só a margem.** Quebra caindo no meio do bloco de assinatura, no meio de uma linha de
   tabela, ou deixando título órfão no pé da página **fica de fora** — `break-inside: avoid`,
   `orphans`/`widows` etc. são outra story.
2. **Valores mantidos: 48px vertical, 40px horizontal.** Nada de aumentar para margem de ofício.
   Assim a altura útil continua sendo os 1027px já declarados e o editor não precisa mudar.
3. **A margem vai para `@page`, no CSS compartilhado — não só na opção do puppeteer.** Existe um
   segundo caminho de impressão: o `wrapPage` serve HTML com um botão `.print-btn`
   (`onclick="window.print()"`, `document-template.service.ts:379`). Margem só na chamada
   `page.pdf` deixaria esse caminho quebrado. `@page` no `DOCUMENT_PRINT_CSS` conserta os dois.
4. **A opção `margin` do `page.pdf` deixa de ser zero e passa a repetir os mesmos valores.** No
   Chrome, a margem passada ao `printToPDF` tem precedência sobre o `@page`; deixá-la zerada
   anularia a decisão 3 justamente no caminho principal. As duas fontes declaram o **mesmo**
   número, importado de `@fonte/doc-styles` — não hardcodar no service.
5. **A convenção da story 24 não morre, muda de lugar**: continua existindo UMA fonte da margem
   (as constantes do `@fonte/doc-styles`), só que agora ela vive na caixa da página em vez da caixa
   do fluxo. O `.a4-page` do editor **não muda** — mesmos 794px de largura e mesmo padding 48/40.
6. **Regressão esperada e aceita: documentos de 1 página podem virar 2.** Um documento cujo
   conteúdo hoje ocupa entre 1027px e 1075px cabia na página 1 só porque a margem inferior estava
   sendo comida. Com a margem real ele passa para a página 2. Isso é a correção funcionando, não um
   bug — mas é preciso avisar, porque documentos já conferidos visualmente podem mudar de paginação.

Encosta em [[24-editor-template-preview-a4]] (que criou a convenção de margem única aqui revista),
[[152-documentos-pdf-combinado-impressao]] (cujo racional de merge cita esta limitação) e
[[23-editor-template-fonte-padrao-sincronizada]]. Não depende de nenhuma story em aberto.

## Desenho

### `packages/doc-styles`

1. Exportar a largura útil, que passa a ser necessária agora que o body não tem mais o padding
   horizontal: `A4_CONTENT_WIDTH_PX = A4_PAGE_WIDTH_PX - 2 * A4_MARGIN_X_PX` (= 714).
2. Em `DOCUMENT_PRINT_CSS`:
   - adicionar `@page{size:A4;margin:${A4_MARGIN_TOP_PX}px ${A4_MARGIN_X_PX}px}`;
   - tirar o `padding:${A4_PADDING}` do `body` e trocar `width:${A4_PAGE_WIDTH_PX}px` por
     `width:100%` — com a margem na página, a caixa disponível já é 714px; manter 794px faria o
     conteúdo transbordar a área imprimível.
   - **atenção ao `overflow:hidden` do body**: com a geometria mudando, confirmar no PDF real que
     ele não está suprimindo a quebra. Se atrapalhar, removê-lo (nunca existiu para paginar — veio
     junto do bloco de geometria).
3. Reescrever o comentário do cabeçalho (linhas 14-35): a margem única agora é a da **página**, e
   `A4_CONTENT_HEIGHT_PX` passa a valer para **todas** as páginas, não só como aproximação.
4. `EDITOR_PAGE_CSS` **não muda**.

### `services/api`

5. `generatePdf`: trocar o objeto zerado por
   `margin: { top: \`${A4_MARGIN_TOP_PX}px\`, bottom: \`${A4_MARGIN_TOP_PX}px\`, left: \`${A4_MARGIN_X_PX}px\`, right: \`${A4_MARGIN_X_PX}px\` }`,
   importando as constantes de `@fonte/doc-styles`. Atualizar o comentário das linhas 64-67, que
   descreve a convenção antiga.
6. Atualizar o comentário do `generateCombinedPdf` (linhas 75-84): o racional citado lá — "o
   `padding` do body só vale na primeira e na última página" — deixa de ser verdade. **A decisão de
   mesclar PDFs continua certa** (é o que garante documento novo sempre em página nova), mas por
   esse motivo, não pelo da margem. Comentário desatualizado aqui vira armadilha na próxima story.
7. Sem mudança de rota, DTO ou response ⇒ **sem alteração no
   `fonte-api.postman_collection.json`** e sem migration.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** — `pnpm test:api` e `pnpm test:api:cov` verdes com cobertura ≥90 do código
tocado, `pnpm --filter adm.fonte test:unit:cov` idem (o `doc-styles` é consumido pelo editor), e
`pnpm build:api` verde. Rebuildar `@fonte/doc-styles` antes de rodar, ou reiniciar o dev server.

- **Unit de `@fonte/doc-styles`**: `DOCUMENT_PRINT_CSS` contém a regra `@page` com `48px 40px`;
  o bloco `body` **não** contém mais `padding:`; `A4_CONTENT_HEIGHT_PX === 1027` e
  `A4_CONTENT_WIDTH_PX === 714`; `EDITOR_PAGE_CSS` continua com `padding:48px 40px` e
  `width:794px` (prova de que o editor não regrediu).
- **Unit `document-template.service.spec.ts`**: `page.pdf` é chamado com as **quatro** margens em
  `48px`/`40px` — e explicitamente **não** com `'0'` (regressão direta desta story); o spec
  existente da linha 500 (`html` contém `DOCUMENT_PRINT_CSS`) continua verde, garantindo que o
  `@page` chega ao HTML servido para o botão Imprimir.
- **Unit de geometria compartilhada**: um teste que afirma que a altura útil declarada é
  `A4_PAGE_HEIGHT_PX − 2 × A4_MARGIN_TOP_PX` **e** que é o mesmo número usado pelo frame A4 do
  editor — trava o casamento editor↔PDF que esta story finalmente torna verdadeiro.
- **E2E (`pnpm test:api:e2e`)**: gerar PDF de um template com conteúdo longo o bastante para
  quebrar e afirmar, via `pdf-lib` (já é dep do projeto pela story 152), que o resultado tem **≥2
  páginas** e que toda página mede A4 (595×842pt) — a margem deixou de sair do tamanho do papel.
- **Conferência visual obrigatória (não automatizável)**: nenhum teste prova que a margem *renderiza*
  na página 2. Antes de fechar, gerar o PDF de um documento de 2+ páginas e conferir a olho que há
  respiro no pé da página 1 e no topo da página 2 — e que um documento de 1 página conhecido não
  mudou de aparência (só de paginação, se cair no caso da decisão 6).

## Fora de escopo

- `break-inside: avoid` / `orphans` / `widows` — não quebrar no meio do bloco de assinatura, de
  linha de tabela, nem deixar título órfão no pé da página (decisão 1).
- Mudar os valores da margem (decisão 2).
- Cabeçalho/rodapé repetidos por página (numeração "página X de Y", logo, `headerTemplate`/
  `footerTemplate` do puppeteer).
- Margem configurável por template no editor.
- Mudar a estratégia de merge do PDF combinado da story 152 — só o comentário é corrigido.
- Repaginação retroativa dos documentos já emitidos e salvos no bucket.
