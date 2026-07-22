import { useState } from 'react';
import { PanelRightClose, Variable, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VARIABLES } from './templateVariables';

// ─── Variables ────────────────────────────────────────────────────────────────
// A fonte única das variáveis vive em `templateVariables.ts` (story 144 extraiu a
// lista para um módulo irmão sem JSX, consumido também pelo autocomplete inline).
// Re-exportadas aqui para não quebrar imports existentes (`VariablesPanel` era a
// casa original da lista — stories 139/140).
export { VARIABLES } from './templateVariables';
export type { TemplateVariable } from './templateVariables';

const FEEDBACK_MS = 1500;

interface Props {
  /** Insere a variável no editor (no cursor). O clipboard + feedback são deste painel. */
  onInsert: (key: string) => void;
  /**
   * Estado `open` controlado (story 144): quando definido, o editor comanda a
   * expansão/recolhimento do painel (o `{{` abre o drawer). Ausente = painel
   * autônomo (comportamento original, story 139).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ─── VariablesPanel ─────────────────────────────────────────────────────────
// Barra vertical colapsável fixa à direita (story 139). Default recolhido: só a
// aba "Variáveis" na borda. Ao expandir, lista rolável com uma variável por
// item, empilhada em três linhas (rótulo / chave / descrição). Clicar insere no
// editor + copia pro clipboard + mostra
// feedback "inserido" por ~1,5s. `z-40`: acima do conteúdo/toolbar sticky (z-20)
// e abaixo dos dialogs do Radix (z-50).

export function VariablesPanel({ onInsert, open: openProp, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Modo controlado (editor comanda o `open`) vs. autônomo (estado interno).
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setInternalOpen(value);
    onOpenChange?.(value);
  };

  const handleInsert = (key: string) => {
    onInsert(key);
    // Clipboard é conveniência; ausente no jsdom/testes → guardado por `?.`.
    navigator.clipboard?.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), FEEDBACK_MS);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Mostrar variáveis disponíveis"
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-l-md border border-r-0 bg-primary px-1.5 py-3 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 [writing-mode:vertical-rl]"
      >
        <Variable size={14} className="rotate-90" />
        Variáveis
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-56 max-w-[80vw] flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Variable size={13} />
          Variáveis
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Recolher variáveis"
          aria-label="Recolher variáveis"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelRightClose size={15} />
        </button>
      </div>

      <p className="px-3 pt-2 text-[11px] leading-tight text-muted-foreground">
        Clique ou arraste para o corpo do documento.
      </p>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {VARIABLES.map(({ key, label, description }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleInsert(key)}
            draggable
            onDragStart={(e) => {
              // Fonte de arraste (story 140): o token literal viaja como texto
              // puro; o handleDrop do editor o insere na posição solta.
              e.dataTransfer.setData('text/plain', key);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className={cn(
              'group flex w-full cursor-grab flex-col items-start gap-0.5 rounded border bg-background px-2 py-1.5 text-left transition-colors hover:bg-accent active:cursor-grabbing',
            )}
          >
            <span className="text-xs font-medium leading-tight text-foreground">{label}</span>
            <span className="font-mono text-[11px] leading-tight text-primary group-hover:underline">
              {copied === key ? (
                <span className="not-italic text-green-600">✓ inserido</span>
              ) : (
                key
              )}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        title="Recolher variáveis"
        className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
        Recolher
      </button>
    </aside>
  );
}
