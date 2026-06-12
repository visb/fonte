import { useEditorState, type Editor } from '@tiptap/react';
import {
  Columns2, Grid2x2X, Heading, Merge, SquareSplitHorizontal,
  Table as TableIcon, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Classe base da tabela. Story 21: toda tabela nasce SEM borda (layout/
// multicoluna); a borda é um toggle manual via classe `no-border`.
const TABLE_BASE_CLASS = 'doc-table';
const NO_BORDER_CLASS = 'no-border';

function withBorderToggled(current: string | null | undefined, withBorder: boolean): string {
  const classes = new Set((current ?? TABLE_BASE_CLASS).split(/\s+/).filter(Boolean));
  classes.add(TABLE_BASE_CLASS);
  if (withBorder) classes.delete(NO_BORDER_CLASS);
  else classes.add(NO_BORDER_CLASS);
  return Array.from(classes).join(' ');
}

function TableButton({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors hover:bg-accent text-muted-foreground"
    >
      {children}
    </button>
  );
}

interface Props { editor: Editor; }

// Toolbar contextual de tabela. Os botões de inserção ficam sempre visíveis;
// os controles de edição (linha/coluna/mesclar/etc.) só quando o cursor está
// dentro de uma tabela. Extraído do TemplateEditor pra respeitar o limite de
// ~150 linhas por componente (CLAUDE.md).
export function TableToolbar({ editor }: Props) {
  // Reativo ao cursor/seleção (useEditorState re-renderiza só quando o resultado muda):
  // os controles de edição aparecem/somem ao entrar/sair de uma tabela em tempo real.
  // Não usar shouldRerenderOnTransaction global — loopa com o BubbleMenu (lição story 28).
  const { insideTable, tableClass } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      insideTable: e.isActive('table'),
      tableClass: (e.getAttributes('table').class as string | undefined) ?? '',
    }),
  });

  // Insere tabela 2×2 SEM borda (decisão story 21) e aplica a classe.
  const insertTable = () => {
    editor.chain().focus()
      .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
      .updateAttributes('table', { class: `${TABLE_BASE_CLASS} ${NO_BORDER_CLASS}` })
      .run();
  };

  // Bloco "2 colunas": 1 linha × 2 células sem borda = duas colunas de texto.
  const insertTwoColumns = () => {
    editor.chain().focus()
      .insertTable({ rows: 1, cols: 2, withHeaderRow: false })
      .updateAttributes('table', { class: `${TABLE_BASE_CLASS} ${NO_BORDER_CLASS}` })
      .run();
  };

  const hasBorder = !tableClass.includes(NO_BORDER_CLASS);
  const toggleBorder = () => {
    editor.chain().focus()
      .updateAttributes('table', {
        class: withBorderToggled(editor.getAttributes('table').class, hasBorder),
      })
      .run();
  };

  return (
    <div className="flex items-center gap-1">
      <TableButton onClick={insertTable} title="Inserir tabela 2×2">
        <TableIcon size={14} />
      </TableButton>
      <TableButton onClick={insertTwoColumns} title="Inserir 2 colunas de texto">
        <Columns2 size={14} />
      </TableButton>

      {insideTable && (
        <>
          <div className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={toggleBorder}
            title={hasBorder ? 'Remover bordas da tabela' : 'Mostrar bordas da tabela'}
            className={cn(
              'p-1.5 rounded transition-colors',
              hasBorder ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground',
            )}
          >
            <Grid2x2X size={14} />
          </button>
          <TableButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Adicionar coluna">
            <span className="text-[11px] font-bold leading-none select-none">+Col</span>
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Remover coluna">
            <span className="text-[11px] font-bold leading-none select-none">−Col</span>
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Adicionar linha">
            <span className="text-[11px] font-bold leading-none select-none">+Lin</span>
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().deleteRow().run()} title="Remover linha">
            <span className="text-[11px] font-bold leading-none select-none">−Lin</span>
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().mergeOrSplit().run()} title="Mesclar ou dividir células">
            <Merge size={14} />
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Alternar linha de cabeçalho">
            <Heading size={14} />
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().splitCell().run()} title="Dividir célula">
            <SquareSplitHorizontal size={14} />
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().deleteTable().run()} title="Excluir tabela">
            <Trash2 size={14} />
          </TableButton>
        </>
      )}
    </div>
  );
}
