import { ImageUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  dragging: boolean;
  disabled?: boolean;
  onClick: () => void;
}

// Story 163 (decisão 12) — estado vazio do envio de imagem: aceita clique e drop
// (o handler de drop fica no pad, que é quem conhece o arquivo).
export function SignatureDropzone({ dragging, disabled, onClick }: Props) {
  return (
    <div
      role="button"
      aria-label="Selecionar imagem da assinatura"
      aria-disabled={disabled}
      className={cn(
        'flex h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center',
        dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      onClick={() => !disabled && onClick()}
    >
      <ImageUp size={28} className="text-primary" />
      <p className="text-sm font-medium">Arraste a foto ou o scan da assinatura</p>
      <p className="text-xs text-muted-foreground">ou clique para selecionar (PNG ou JPG)</p>
    </div>
  );
}
