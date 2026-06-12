import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Check, ExternalLink, Link2Off, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeLinkHref } from './LinkToolbar';

interface Props {
  editor: Editor;
}

// Tooltip flutuante ancorado no link ativo (story 28). Aparece ao clicar/posicionar
// o cursor sobre um link (Link está com openOnClick: false, então não navega). Oferece
// Abrir, Editar e Remover. `shouldShow` customizado substitui o default do BubbleMenu —
// que esconde em seleção vazia — para que o tooltip apareça com o cursor dentro do link
// sem precisar selecionar o texto. Como o shouldShow não checa foco, o tooltip permanece
// aberto enquanto o input de edição está focado (o editor perde foco, mas o link segue ativo).
export function LinkBubbleMenu({ editor }: Props) {
  const [editing, setEditing] = useState(false);
  const [href, setHref] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Mudar de link (ou sair dele) volta o tooltip para o modo de ações.
  useEffect(() => {
    const reset = () => setEditing(false);
    editor.on('selectionUpdate', reset);
    return () => { editor.off('selectionUpdate', reset); };
  }, [editor]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const currentHref = (editor.getAttributes('link').href as string | undefined) ?? '';

  const startEditing = () => {
    setHref(currentHref);
    setEditing(true);
  };

  const apply = () => {
    const normalized = normalizeLinkHref(href);
    if (!normalized) {
      // Vazio = remover o link em vez de aplicar href vazio (mesma regra do popover).
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    setEditing(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setEditing(false);
  };

  const openLink = () => {
    if (currentHref) window.open(currentHref, '_blank', 'noopener,noreferrer');
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      shouldShow={({ editor: e }) => e.isActive('link')}
      options={{ placement: 'bottom' }}
      data-testid="link-bubble"
      className="flex items-center gap-1 rounded-md border bg-background p-1 shadow-md"
    >
      {editing ? (
        <>
          <Input
            ref={inputRef}
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); apply(); }
              if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
            }}
            placeholder="https://exemplo.com"
            className="h-7 w-56 text-sm"
          />
          <Button type="button" size="sm" className="h-7 px-2" onClick={apply} title="Aplicar">
            <Check size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)} title="Cancelar">
            <X size={14} />
          </Button>
        </>
      ) : (
        <>
          <span className="max-w-56 truncate px-1.5 text-xs text-muted-foreground" title={currentHref}>
            {currentHref}
          </span>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={openLink} title="Abrir em nova aba">
            <ExternalLink size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={startEditing} title="Editar link">
            <Pencil size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={removeLink} title="Remover link">
            <Link2Off size={14} />
          </Button>
        </>
      )}
    </BubbleMenu>
  );
}
