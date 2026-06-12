# Plan: Selecionar tabela inteira no editor e menu de ações no canto (recortar/copiar/remover/duplicar)

## Context

No editor de templates de documentos (`apps/adm.fonte/src/features/settings/components/`),
hoje as tabelas só têm edição célula-a-célula (toolbar de tabela: +Col/−Col, mesclar, borda,
etc., story 21/29). Não há como **manipular a tabela inteira** como um bloco: copiar/recortar a
tabela toda, duplicá-la ou removê-la com um clique.

O usuário pediu:
1. **Criar uma forma de selecionar toda a tabela.**
2. **Quando selecionada, mostrar um botão no canto superior direito que abre um menu.**
3. Menu inicial com 4 ações: **recortar, copiar, remover e duplicar**.

**Decisões do usuário (travadas):**
- O gesto de selecionar a tabela é uma **alça (grip)** que aparece no topo da tabela quando o
  cursor está dentro dela (estilo Notion/Word). Clicar na alça seleciona a tabela inteira.
- Recortar/Copiar usam o **clipboard nativo do ProseMirror** (não estado interno): com a tabela
  node-selecionada, dispara o copy/cut nativo. Resultado: cola 1:1 dentro do editor (round-trip
  PM) e também popula o clipboard do SO como HTML. Remover/Duplicar são locais ao editor.
- O botão de menu fica no **canto superior direito** da tabela; ao selecionar, a tabela ganha um
  realce visual (anel).

**Decisão técnica (travada):**
- Reatividade ao cursor/seleção via **`useEditorState`** (mesmo padrão das stories 28/29), **não**
  `shouldRerenderOnTransaction: true` (que loopa com o `BubbleMenu`).
- "Selecionar a tabela" = `NodeSelection` no nó `table` (não `CellSelection`). O `NodeSelection`
  é o que faz o copy/cut nativo do PM serializar a tabela inteira e o que o `deleteSelection`
  remove de uma vez.
- A alça e o botão de menu são um **overlay React** posicionado por `getBoundingClientRect` da
  `<table>` viva (portal em `document.body`, `position: fixed`). Não tocar no NodeView da tabela
  (`DocTableView` estende o `TableView` do prosemirror-tables p/ resize de coluna — converter pra
  NodeView React arriscaria o resize). O overlay re-mede em `selectionUpdate`/`transaction` e em
  scroll/resize. `getBoundingClientRect` já reflete o `transform: scale()` do zoom (story 24),
  então o posicionamento acompanha o zoom sem matemática extra.

## Desenho

Novo componente `TableBlockMenu.tsx` (em `features/settings/components/`), montado pelo
`TemplateEditor` ao lado do `LinkBubbleMenu`. Recebe `editor: Editor`.

### Estado reativo (`useEditorState`)
```ts
// Contexto da tabela sob a seleção: posição do nó, se está dentro, se está node-selecionada.
const ctx = useEditorState({
  editor,
  selector: ({ editor: e }) => {
    const sel = e.state.selection;
    if (sel instanceof NodeSelection && sel.node.type.name === 'table') {
      return { pos: sel.from, inside: true, selected: true };
    }
    const { $from } = sel;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        return { pos: $from.before(d), inside: true, selected: false };
      }
    }
    return { pos: null as number | null, inside: false, selected: false };
  },
});
```

### Medição do retângulo da tabela
- `useEffect` keyed em `[ctx.pos, ctx.inside, ctx.selected]`:
  - `measure()` → `editor.view.nodeDOM(ctx.pos)` (wrapper `.tableWrapper`) → `.querySelector('table')`
    → `getBoundingClientRect()` salvo em estado `rect`.
  - re-mede em `window` `scroll` (capture=true, pega o scroll do `.a4-canvas` aninhado), `resize`
    e em `editor.on('transaction', measure)` (a tabela muda de tamanho ao editar).
  - cleanup remove os listeners.

### Render (portal em `document.body`)
- **Alça de seleção** — visível quando `ctx.inside && !ctx.selected && rect`:
  - botãozinho com ícone `GripHorizontal`, ancorado no topo-esquerdo da tabela
    (`left: rect.left`, `top: rect.top - 14`), `data-testid="table-select-handle"`,
    `title="Selecionar tabela"`.
  - `onClick` → seleciona a tabela:
    ```ts
    const { view } = editor;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, ctx.pos)));
    view.focus();
    ```
- **Realce** — visível quando `ctx.selected && rect`: `<div>` `position: fixed` sobre o `rect`
  com `border: 2px solid hsl(var(--primary))`, `pointerEvents: none`.
- **Botão de menu + dropdown** — visível quando `ctx.selected && rect`:
  - usa `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` de
    `@/components/ui/dropdown-menu` (Radix; já no projeto).
  - trigger = botão `MoreVertical` ancorado no canto superior direito
    (`left: rect.right - 30`, `top: rect.top + 2`), `data-testid="table-block-menu"`,
    `title="Ações da tabela"`.
  - itens (cada um `onSelect`):
    | Item | Ícone | Ação |
    |---|---|---|
    | Recortar | `Scissors` | `view.focus(); document.execCommand('cut')` |
    | Copiar | `Copy` | `view.focus(); document.execCommand('copy')` |
    | Duplicar | `CopyPlus` | insere cópia do nó logo após (abaixo) |
    | Remover | `Trash2` | `editor.chain().focus().deleteSelection().run()` |
  - Recortar/Copiar: a tabela já está node-selecionada quando o menu abre; `view.focus()`
    restaura a seleção no DOM e o `execCommand` dispara o copy/cut nativo que o ProseMirror
    intercepta e serializa a tabela inteira (HTML PM no clipboard do SO; cola 1:1 no editor).
    `cut` = o PM copia e remove a seleção.
  - Duplicar:
    ```ts
    const node = editor.state.doc.nodeAt(ctx.pos);
    if (node) editor.chain().focus()
      .insertContentAt(ctx.pos + node.nodeSize, node.toJSON())
      .run();
    ```
  - Remover: `deleteSelection()` apaga o nó node-selecionado.

### Wiring no `TemplateEditor.tsx`
- `import { TableBlockMenu } from './TableBlockMenu';`
- Render após `<LinkBubbleMenu editor={editor} />`: `<TableBlockMenu editor={editor} />`.

### Estilo / a11y
- Botões pequenos, `bg-background/95 border rounded shadow-md`, `z-30+`, seguindo o visual da
  toolbar de imagem (linhas 266–308 do `TemplateEditor`) e do `LinkBubbleMenu`.
- `onMouseDown={(e) => e.preventDefault()}` na alça/botões para não roubar a seleção do editor
  antes do clique (mesmo truque da toolbar de imagem).

## Validação

- `pnpm build:types && pnpm build:api-client` ok; `pnpm --filter adm.fonte build` e `tsc --noEmit`
  limpos (sem novos imports quebrados; `NodeSelection` de `@tiptap/pm/state`, `DOMSerializer` não
  necessário pois usamos clipboard nativo).
- Backend: inalterado — sem mudança de endpoint nem de schema. `fonte-api.postman_collection.json`
  inalterado. (Sanidade: `pnpm test:api` segue verde, nada tocado no backend.)
- adm E2E (`pnpm test:adm`, spec `document-templates.spec.ts`) — novo `describe`
  "tabela — seleção e menu de ações":
  - inserir tabela 2×2, clicar numa célula → a **alça** (`table-select-handle`) fica visível.
  - clicar na alça → a tabela fica node-selecionada e o **botão de menu** (`table-block-menu`)
    aparece no canto; a alça some.
  - abrir o menu → existem os itens **Recortar / Copiar / Remover / Duplicar**.
  - **Duplicar** → passa a haver 2 `table.doc-table` no editor.
  - **Remover** → volta a 0 tabelas (ou à contagem anterior).
  - (copiar/recortar dependem de clipboard real do browser; cobrir ao menos que o item existe e
    o clique não quebra — o round-trip de clipboard é difícil de asserir de forma estável no
    Playwright; o foco do teste é seleção/duplicar/remover.)

## Fora de escopo

- Colar a tabela copiada via botão dedicado no menu (cola é via Ctrl+V nativo, fora do menu).
- Mover/arrastar a tabela pela alça (drag-and-drop reordering) — a alça só seleciona.
- Selecionar múltiplas tabelas ou intervalos entre tabelas.
- Menu com mais ações (ex.: alinhar tabela, largura) — começa com as 4 pedidas.
- Persistir/serializar qualquer coisa nova no HTML salvo (a feature é só de edição; o HTML de
  saída não muda).
