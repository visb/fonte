import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  generating: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

// Story 152 — barra de ação da seleção de documentos: só aparece com pelo menos
// um card marcado e gera um PDF único, na ordem em que os cards estão na tela.
export function CombinedPdfBar({ count, generating, onGenerate, onClear }: Props) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-sm font-medium">
        {count === 1 ? '1 documento selecionado' : `${count} documentos selecionados`}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={generating} onClick={onGenerate}>
          {generating
            ? <Loader2 size={14} className="animate-spin mr-1.5" />
            : <Printer size={14} className="mr-1.5" />}
          Gerar PDF combinado
        </Button>
        <Button variant="ghost" size="sm" disabled={generating} onClick={onClear}>
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}
