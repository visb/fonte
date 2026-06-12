import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import {
  Copy, CopyPlus, GripHorizontal, MoreVertical, Scissors, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Props { editor: Editor; }

// Story 30 — selecionar a tabela inteira e agir sobre ela como um bloco.
//
// Duas affordances renderizadas como overlay (portal em document.body, position:
// fixed) ancorado pelo getBoundingClientRect da <table> viva:
//   1. ALÇA (grip) no topo da tabela quando o cursor está dentro dela → clica e
//      seleciona a tabela inteira (NodeSelection no nó `table`).
//   2. Com a tabela node-selecionada: realce (anel) + botão de menu no canto
//      superior direito com Recortar / Copiar / Duplicar / Remover.
//
// Por que overlay e não NodeView: o DocTableView estende o TableView do
// prosemirror-tables (resize de coluna). Converter pra NodeView React arriscaria
// o resize, então posicionamos por cima sem tocar no render da tabela.
// getBoundingClientRect já reflete o transform: scale() do zoom (story 24), então
// o overlay acompanha o zoom sem matemática extra.
//
// Reatividade via useEditorState (padrão stories 28/29) — não
// shouldRerenderOnTransaction (loopa com o BubbleMenu).
export function TableBlockMenu({ editor }: Props) {
  // Contexto da tabela sob a seleção: posição do nó, se o cursor está dentro,
  // e se a tabela INTEIRA está selecionada. "Selecionada" = CellSelection que
  // cobre todas as células (linha+coluna inteiras) — o prosemirror-tables
  // normaliza um NodeSelection de tabela para CellSelection, então é esse o
  // estado real após a alça selecionar. NodeSelection fica como fallback.
  const ctx = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const sel = e.state.selection;
      // posição do nó table a partir de qualquer seleção dentro dele
      let pos: number | null = null;
      const { $from } = sel;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') { pos = $from.before(d); break; }
      }
      if (pos == null && sel instanceof NodeSelection && sel.node.type.name === 'table') {
        pos = sel.from;
      }
      const selected =
        (sel instanceof CellSelection && sel.isRowSelection() && sel.isColSelection()) ||
        (sel instanceof NodeSelection && sel.node.type.name === 'table');
      return { pos, inside: pos != null, selected };
    },
  });

  const [rect, setRect] = useState<DOMRect | null>(null);

  // Mede o retângulo da <table> viva e re-mede ao rolar/redimensionar/editar.
  useEffect(() => {
    if (ctx.pos == null) { setRect(null); return; }
    const measure = () => {
      const dom = editor.view.nodeDOM(ctx.pos as number) as HTMLElement | null;
      const tableEl = (dom?.querySelector?.('table') as HTMLElement | null) ?? dom;
      setRect(tableEl ? tableEl.getBoundingClientRect() : null);
    };
    measure();
    // capture=true pega o scroll do .a4-canvas aninhado (scroll não borbulha).
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    editor.on('transaction', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      editor.off('transaction', measure);
    };
  }, [editor, ctx.pos, ctx.inside, ctx.selected]);

  if (ctx.pos == null || !rect) return null;

  const { view } = editor;
  const pos = ctx.pos as number;

  // Seleciona a tabela inteira como CellSelection cobrindo todas as células
  // (sobrevive à normalização do prosemirror-tables). Âncora = 1ª célula,
  // cabeça = última célula, via TableMap.
  const selectTable = () => {
    const tableNode = editor.state.doc.nodeAt(pos);
    if (!tableNode) return;
    const map = TableMap.get(tableNode);
    const start = pos + 1; // início do conteúdo do nó table
    const first = start + map.map[0];
    const last = start + map.map[map.map.length - 1];
    editor.chain().focus().setCellSelection({ anchorCell: first, headCell: last }).run();
  };

  // Copiar: a tabela inteira já está em CellSelection quando o menu abre.
  // view.focus() restaura a seleção no DOM e o execCommand dispara o copy nativo
  // que o prosemirror-tables intercepta — serializa a tabela no clipboard do SO
  // (HTML) e cola como tabela dentro do editor.
  const copyTable = () => { view.focus(); document.execCommand('copy'); };

  // Recortar: copia e remove a tabela inteira. (O cut nativo sobre CellSelection
  // só esvaziaria as células; aqui queremos remover a tabela toda.)
  const cutTable = () => {
    view.focus();
    document.execCommand('copy');
    editor.chain().focus().deleteTable().run();
  };

  // Duplicar: insere uma cópia do nó logo após (abaixo) a tabela atual.
  const duplicateTable = () => {
    const node = editor.state.doc.nodeAt(pos);
    if (node) {
      editor.chain().focus()
        .insertContentAt(pos + node.nodeSize, node.toJSON())
        .run();
    }
  };

  // Remover: apaga a tabela inteira.
  const removeTable = () => { editor.chain().focus().deleteTable().run(); };

  return createPortal(
    <>
      {/* Alça de seleção — cursor dentro da tabela, ainda não selecionada. */}
      {ctx.inside && !ctx.selected && (
        <button
          type="button"
          data-testid="table-select-handle"
          title="Selecionar tabela"
          onMouseDown={(e) => e.preventDefault()}
          onClick={selectTable}
          style={{ position: 'fixed', left: rect.left, top: rect.top - 14, zIndex: 40 }}
          className="flex items-center justify-center rounded border bg-background/95 px-1 py-0.5 text-muted-foreground shadow-md hover:bg-accent"
        >
          <GripHorizontal size={13} />
        </button>
      )}

      {/* Realce + botão de menu — tabela node-selecionada. */}
      {ctx.selected && (
        <>
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: rect.left - 2, top: rect.top - 2,
              width: rect.width + 4, height: rect.height + 4,
              border: '2px solid hsl(var(--primary))',
              borderRadius: 4, pointerEvents: 'none', zIndex: 35,
            }}
          />
          <div
            style={{ position: 'fixed', left: rect.right - 30, top: rect.top + 2, zIndex: 40 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="table-block-menu"
                  title="Ações da tabela"
                  className="flex items-center justify-center rounded border bg-background/95 p-1 text-muted-foreground shadow-md hover:bg-accent"
                >
                  <MoreVertical size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={cutTable}>
                  <Scissors size={14} /> Recortar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={copyTable}>
                  <Copy size={14} /> Copiar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={duplicateTable}>
                  <CopyPlus size={14} /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={removeTable} className="text-destructive focus:text-destructive">
                  <Trash2 size={14} /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
