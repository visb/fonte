import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { getErrorMessage } from '@/lib/errors';
import { useUploadMySignature } from '@/features/staff/hooks/useStaff';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  // Story 128 (decisão 6) — chamado após salvar; destrava a geração do documento.
  onSaved?: () => void;
}

export function SignatureDialog({ open, onClose, onSaved }: Props) {
  const padRef = useRef<SignatureCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUploadMySignature();

  const handleClose = () => {
    setError(null);
    setIsEmpty(true);
    mutation.reset();
    onClose();
  };

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError('Desenhe sua assinatura antes de salvar.');
      return;
    }
    // PNG mantém o fundo transparente do traço (decisão 1) para imprimir sobre a linha.
    pad.getCanvas().toBlob((blob) => {
      if (!blob) {
        setError('Não foi possível gerar a imagem da assinatura.');
        return;
      }
      mutation.mutate(blob, {
        onSuccess: () => {
          onSaved?.();
          handleClose();
        },
      });
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar assinatura</DialogTitle>
          <DialogDescription>
            Desenhe sua assinatura no quadro abaixo. Ela será inserida nos documentos que você gerar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-white">
          <SignatureCanvas
            ref={padRef}
            penColor="black"
            onEnd={() => setIsEmpty(padRef.current?.isEmpty() ?? true)}
            canvasProps={{
              'aria-label': 'Área de assinatura',
              className: 'w-full',
              style: { height: 180 },
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {mutation.isError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(mutation.error, 'Erro ao salvar assinatura.')}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleClear} disabled={mutation.isPending}>
            Limpar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={isEmpty || mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
