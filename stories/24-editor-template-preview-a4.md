# Plan: Editor com moldura A4 e quebra de página automática (estilo Word/Docs)

## Context

Ao editar um template (`TemplateEditor.tsx`), o usuário **não vê** como o texto fica posicionado na folha impressa. Hoje o editor só aproxima a área com `max-width: 720px` (comentário "simula área A4") — sem proporção real da A4, sem margens reais, **sem quebras de página**.

**Decisão do usuário**: o **próprio editor** deve ter uma **moldura de A4**, com **quebras de página automáticas** quando o conteúdo excede uma folha — exatamente como Word/Google Docs. Não é um preview separado: a edição acontece dentro das páginas A4 paginadas.

O PDF real é gerado por puppeteer em `document-template.service.ts`: `page.pdf({ format: 'A4', margin: 40px })` sobre o HTML de `renderForResident`, cujo `<style>` tem `body{font-family:Arial;font-size:10px;line-height:1.2;max-width:800px;padding:48px 40px}`. A moldura do editor tem que **bater 1:1** com essa geometria para a paginação na tela corresponder à do PDF.

> Pré-requisito: a unidade de fonte editor↔PDF precisa estar unificada (px→pt) — fazer **depois** da `[[23-editor-template-fonte-padrao-sincronizada]]`, senão a quebra na tela não corresponde à impressão.

---

## Implementação

### 1. CSS de impressão como fonte única de verdade

Hoje o CSS de impressão vive embutido em `document-template.service.ts` e o editor reaproxima por conta própria. Extrair corpo/tipografia/tabela/imagem para uma **constante compartilhada** `DOCUMENT_PRINT_CSS` em `packages/types` (ou novo `packages/doc-styles`), consumida pelos dois lados:
- Backend injeta no `<style>` do `renderForResident`.
- Frontend injeta na moldura do editor.
Garante que a tela e o PDF usem **exatamente** as mesmas regras (margens, fonte, tabela, listas, imagem). Decisão: extrair para pacote (não duplicar).

### 2. Geometria da página A4 (calibrar com o puppeteer)

A4 a 96 dpi = **794 × 1123 px**. O puppeteer aplica `margin: 40px` em cada lado **e** o `body` tem `padding: 48px 40px`. Reconciliar para a moldura do editor:
- Largura da página: 794px (`210mm`).
- Altura da página: 1123px (`297mm`).
- Área de conteúdo (onde o texto flui antes de quebrar) = altura − margens efetivas (margin puppeteer + padding body). **Medir o valor real** gerando um PDF de referência e ajustando a constante até a quebra na tela coincidir com a do PDF (calibração empírica — registrar o número final em comentário).

> ⚠️ Risco principal da story: margin do puppeteer e padding do body hoje **se somam**. Ao paginar na tela, definir UMA convenção (ex.: zerar `margin` do puppeteer e deixar só o padding do body, ou vice-versa) para a altura útil ser inequívoca. Ajustar `document-template.service.ts` em conjunto.

### 3. Paginação dentro do editor TipTap

TipTap/ProseMirror **não** pagina nativamente. Abordagem:
- **Preferida**: adotar uma extensão de paginação TipTap já testada (ex.: `tiptap-pagination-plus` / `tiptap-extension-pagination`), que mede a altura dos nós e desenha quebras de página + molduras a cada altura útil. **Conferir compatibilidade** com o major do `@tiptap/core`/`@tiptap/react` já instalado antes de adotar; se incompatível, fixar versão ou migrar.
- **Fallback (MVP visual)**: se nenhuma extensão for compatível, envolver o `EditorContent` numa moldura A4 (largura/margens reais) e desenhar **guias de quebra** (linhas tracejadas + "gaps" entre páginas) via camada de fundo `repeating-linear-gradient` na altura de página. Não move o conteúdo entre folhas discretas, mas mostra onde cada página termina — calibrado para coincidir com o PDF. Evoluir para folhas discretas depois.

Decisão: tentar a extensão de paginação real (comportamento Word/Docs); cair no MVP visual só se a compat travar — registrar em `PROGRESS.md` se cair no fallback.

### 4. Moldura visual — `TemplateEditor.tsx`

Envolver o `EditorContent` na página A4:

```tsx
<div className="a4-canvas">              {/* fundo cinza, centraliza, faz zoom-fit */}
  <div className="a4-page">              {/* 794px, sombra, padding == geometria §2 */}
    <EditorContent editor={editor} />    {/* paginação da §3 desenha as quebras */}
  </div>
</div>
```

- `.a4-canvas`: fundo neutro (cinza claro), centraliza a página, aplica `transform: scale(...)` para caber em telas estreitas (régua de zoom 50/75/100%).
- `.a4-page`: 794px de largura, sombra, padding = geometria calibrada na §2; recebe `DOCUMENT_PRINT_CSS`.
- Remover o `max-width:720px` atual (substituído pela página A4 real).

### 5. Variáveis na moldura

Placeholders `{{name}}` etc. (mapa `VARIABLES`) aparecem **literais** durante a edição (é o template). A moldura A4 é a superfície de edição — não substituir por dados aqui (a substituição acontece no `renderForResident` ao gerar o PDF do filho). Manter literais; a fidelidade de **layout** (margem/fonte/quebra) é o que importa.

---

## Testes automatizados (Definition of Done)

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/document-templates.spec.ts` | Editor renderiza dentro de `.a4-page` com largura A4; digitar conteúdo curto fica em 1 página |
| idem | Inserir conteúdo longo (> 1 folha) → segunda página/quebra aparece (elemento de page-break visível) |
| Visual/manual | Posição da quebra na tela coincide com a quebra do PDF gerado (mesma fonte/margem) |

Rodar: `pnpm test:adm`.

## Verificação manual

1. `pnpm dev:adm` → editar template → área de edição é uma folha A4 com margens reais.
2. Digitar até passar de uma folha → nova página A4 surge automaticamente (estilo Word/Docs).
3. Gerar o PDF real de um filho → o número de páginas e a posição das quebras batem com o que se viu no editor.

---

## Refinamentos pendentes (decisões)

1. ✅ **Formato**: moldura A4 **dentro do editor** com quebra automática (não preview separado). Decidido.
2. ✅ **CSS de impressão**: extrair para **pacote compartilhado** (`DOCUMENT_PRINT_CSS`), backend+front 1:1. Decidido.
3. **Extensão de paginação**: validar compatibilidade de uma extensão TipTap de paginação com a versão instalada; se travar, usar o MVP visual (guias de quebra) e registrar. Investigar no início.
4. **Geometria margin×padding**: hoje `margin` do puppeteer e `padding` do body se somam — escolher convenção única e ajustar `document-template.service.ts` junto, calibrando a altura útil contra um PDF de referência.
5. **Zoom**: régua 50/75/100% (decisão de UX menor) — confirmar na implementação.
