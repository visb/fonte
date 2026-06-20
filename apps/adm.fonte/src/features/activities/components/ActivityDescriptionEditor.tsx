import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { Bold, Italic, Link as LinkIcon, Link2Off, List, ListOrdered } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizeLinkHref } from '../lib/links';

interface Props {
  /** Markdown atual (valor controlado pelo react-hook-form). */
  value: string;
  /** Emite o markdown serializado a cada edição. */
  onChange: (markdown: string) => void;
  placeholder?: string;
}

/** Lê o markdown serializado do editor (storage da extensão tiptap-markdown). */
function getMarkdown(editor: Editor): string {
  const storage = (editor.storage as unknown as Record<string, unknown>)
    .markdown as MarkdownStorage | undefined;
  return storage?.getMarkdown() ?? '';
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLink = useEditorState({ editor, selector: ({ editor: e }) => e.isActive('link') });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openPopover = () => {
    setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setOpen(true);
  };

  const apply = () => {
    const normalized = normalizeLinkHref(href);
    if (!normalized) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} data-testid="activity-link-toolbar" className="relative flex items-center">
      <ToolbarButton active={isLink} onClick={openPopover} title="Inserir/editar link">
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton
        disabled={!isLink}
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        title="Remover link"
      >
        <Link2Off size={14} />
      </ToolbarButton>

      {open && (
        <div
          className="absolute top-full left-0 z-30 mt-1 flex items-center gap-1.5 rounded-md border bg-background p-1.5 shadow-md"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Input
            ref={inputRef}
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); apply(); }
              if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
            }}
            placeholder="https://exemplo.com"
            aria-label="URL do link"
            className="h-8 w-56 text-sm"
          />
          <Button type="button" size="sm" className="h-8" onClick={apply}>Aplicar</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Editor WYSIWYG da descrição da atividade (story 72). TipTap + ponte markdown
 * (`tiptap-markdown`): parseia markdown → doc ao abrir e serializa doc → markdown
 * a cada edição (via onChange). Toolbar mínima: negrito, itálico, listas e link.
 * Reusa a stack TipTap já em produção no TemplateEditor.
 *
 * Segurança: Link com `autolink/openOnClick` desligados e classes seguras. O
 * conteúdo é markdown — o backend sanitiza ao salvar e o render usa DOMPurify.
 */
export function ActivityDescriptionEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? 'Descreva a atividade' }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      // Ponte markdown: serializa doc → markdown em getMarkdown().
      Markdown.configure({ html: false, linkify: false, breaks: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'data-testid': 'activity-description-editor',
        class:
          'min-h-[6rem] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline',
      },
      // Clicar num link dentro do editor não navega.
      handleClick: (_view, _pos, event) => {
        const el = event.target as HTMLElement | null;
        if (el?.closest('a')) event.preventDefault();
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      // storage.markdown.getMarkdown() serializa o doc atual para markdown.
      onChange(getMarkdown(e));
    },
  });

  // Sincroniza conteúdo externo (ex.: reset do form) sem laço: só re-seta quando o
  // markdown do editor difere do valor recebido.
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <Italic size={14} />
        </ToolbarButton>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista com marcadores"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered size={14} />
        </ToolbarButton>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <LinkControl editor={editor} />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
