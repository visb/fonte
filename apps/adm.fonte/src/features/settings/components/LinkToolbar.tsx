import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Link as LinkIcon, Link2Off } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Normaliza a URL digitada: aceita esquemas conhecidos como estão; caso contrário
// prefixa https://. Devolve null para entrada vazia (sinal de "não aplicar").
export function normalizeLinkHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return value;
  return `https://${value}`;
}

interface Props {
  editor: Editor;
}

// Grupo de toolbar para link/unlink. Popover leve (sem dependência nova) no mesmo
// estilo dos controles flutuantes já usados no editor. O estilo visual do link
// (azul + sublinhado) vem do CSS compartilhado @fonte/doc-styles, não daqui — para
// o editor casar 1:1 com o PDF.
export function LinkToolbar({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLink = editor.isActive('link');

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
      // Vazio = remover o link em vez de aplicar href vazio.
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        onClick={openPopover}
        title="Inserir/editar link"
        className={cn(
          'p-1.5 rounded transition-colors',
          isLink ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground',
        )}
      >
        <LinkIcon size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        disabled={!isLink}
        title="Remover link"
        className={cn(
          'p-1.5 rounded transition-colors',
          isLink ? 'hover:bg-accent text-muted-foreground' : 'text-muted-foreground/40 cursor-not-allowed',
        )}
      >
        <Link2Off size={14} />
      </button>

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
            className="h-8 w-56 text-sm"
          />
          <Button type="button" size="sm" className="h-8" onClick={apply}>Aplicar</Button>
          {isLink && (
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={removeLink}>
              Remover
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
