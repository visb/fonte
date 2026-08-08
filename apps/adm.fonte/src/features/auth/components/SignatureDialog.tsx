import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignatureDrawPad } from './SignatureDrawPad';
import { SignatureUploadPad } from './SignatureUploadPad';

interface Props {
  open: boolean;
  onClose: () => void;
  // Story 128 (decisão 6) — chamado após salvar; destrava a geração do documento.
  onSaved?: () => void;
}

type SignatureTab = 'draw' | 'upload';

// Story 163 — duas formas de assinar na mesma porta de entrada: desenhar (padrão)
// ou enviar foto/scan. Trocar de aba não perde o trabalho da outra; o que é salvo
// é sempre o conteúdo da aba ativa (decisões 7-9).
export function SignatureDialog({ open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<SignatureTab>('draw');
  const [drawBlob, setDrawBlob] = useState<Blob | null>(null);
  const [uploadBlob, setUploadBlob] = useState<Blob | null>(null);
  const [clearDraw, setClearDraw] = useState(0);
  const [clearUpload, setClearUpload] = useState(0);
  const mutation = useUploadMySignature();

  const activeBlob = tab === 'draw' ? drawBlob : uploadBlob;

  const handleClose = () => {
    setTab('draw');
    setDrawBlob(null);
    setUploadBlob(null);
    setClearDraw((n) => n + 1);
    setClearUpload((n) => n + 1);
    mutation.reset();
    onClose();
  };

  const handleClear = () => {
    if (tab === 'draw') setClearDraw((n) => n + 1);
    else setClearUpload((n) => n + 1);
  };

  const handleSave = () => {
    if (!activeBlob) return;
    mutation.mutate(activeBlob, {
      onSuccess: () => {
        onSaved?.();
        handleClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar assinatura</DialogTitle>
          <DialogDescription>
            Desenhe sua assinatura ou envie uma imagem dela. Será inserida nos documentos que você
            gerar.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as SignatureTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw">Desenhar</TabsTrigger>
            <TabsTrigger value="upload">Enviar imagem</TabsTrigger>
          </TabsList>
          {/* forceMount: trocar de aba não pode apagar o traço nem a imagem (decisão 8).
              Com forceMount o Radix deixa de esconder o painel inativo — daí o `hidden`. */}
          <TabsContent value="draw" forceMount hidden={tab !== 'draw'}>
            <SignatureDrawPad
              onChange={setDrawBlob}
              clearSignal={clearDraw}
              disabled={mutation.isPending}
            />
          </TabsContent>
          <TabsContent value="upload" forceMount hidden={tab !== 'upload'}>
            <SignatureUploadPad
              onChange={setUploadBlob}
              clearSignal={clearUpload}
              disabled={mutation.isPending}
            />
          </TabsContent>
        </Tabs>

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
            <Button type="button" onClick={handleSave} disabled={!activeBlob || mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
