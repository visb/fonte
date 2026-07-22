import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TemplateVariable } from './templateVariables';

// ─── VariableSuggestionList (story 144) ───────────────────────────────────────
// Popup do autocomplete inline de variáveis. Montado via `ReactRenderer` do
// @tiptap/react pela extensão `VariableSuggestion` e posicionado no cursor. Lista
// rótulo + chave, com o item ativo destacado; navegável por teclado (↑/↓/Enter/
// Tab) — o handler de teclas é exposto por ref para a extensão encaminhar os
// eventos do ProseMirror. Clique também confirma.

export interface VariableSuggestionListProps {
  items: TemplateVariable[];
  command: (item: TemplateVariable) => void;
}

export interface VariableSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const VariableSuggestionList = forwardRef<
  VariableSuggestionListRef,
  VariableSuggestionListProps
>(function VariableSuggestionList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sempre que a lista muda (usuário digitou mais), volta o destaque ao topo.
  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div
      data-testid="variable-suggestion-list"
      className="max-h-64 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          data-active={index === selectedIndex}
          // Mantém o foco/seleção no editor: sem isto o mousedown tira o foco do
          // contenteditable antes do clique confirmar a inserção.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => selectItem(index)}
          className={cn(
            'flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <span className="text-xs font-medium leading-tight">{item.label}</span>
          <span className="font-mono text-[11px] leading-tight text-primary">{item.key}</span>
        </button>
      ))}
    </div>
  );
});
