import { useEffect, useRef } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Documentos marcados. */
  count: number;
  /** Documentos selecionáveis na tela (denominador do "marcar todos"). */
  total: number;
  allSelected: boolean;
  someSelected: boolean;
  generating: boolean;
  onGenerate: () => void;
  onToggleAll: () => void;
}

function selectionLabel(count: number): string {
  if (count === 0) return 'Nenhum documento selecionado';
  return count === 1 ? '1 documento selecionado' : `${count} documentos selecionados`;
}

// Story 152 — barra de ação da seleção de documentos: gera um PDF único, na
// ordem em que os cards estão na tela.
// Story 161 — a barra é SEMPRE renderizada, inclusive quando não há nenhum
// documento selecionável: a aba mantém o mesmo esqueleto e não dá salto de
// layout a cada clique. O botão nasce desabilitado até haver seleção e o
// checkbox de cabeçalho marca/desmarca tudo — ele substitui o antigo botão
// "Limpar seleção".
export function CombinedPdfBar({
  count, total, allSelected, someSelected, generating, onGenerate, onToggleAll,
}: Props) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // `indeterminate` não existe como atributo JSX — só como propriedade do
  // elemento; daí o ref + efeito. Seleção parcial mostra o traço; clicar nele
  // marca todos.
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          ref={checkboxRef}
          type="checkbox"
          className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
          checked={allSelected}
          disabled={generating || total === 0}
          onChange={onToggleAll}
          aria-label="Selecionar todos os documentos"
        />
        <span className="text-sm font-medium">{selectionLabel(count)}</span>
      </label>
      <Button size="sm" disabled={generating || count === 0} onClick={onGenerate}>
        {generating
          ? <Loader2 size={14} className="animate-spin mr-1.5" />
          : <Printer size={14} className="mr-1.5" />}
        Gerar PDF combinado
      </Button>
    </div>
  );
}
