import { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import type { Payable } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/errors';
import { usePayPayable } from '../hooks/usePayables';
import { formatCents } from '../lib/money';

interface Props {
  open: boolean;
  payable: Payable | null;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PayPayableDialog({ open, payable, onClose }: Props) {
  const payMutation = usePayPayable();
  const [paidAt, setPaidAt] = useState(todayISO());
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    if (open) {
      setPaidAt(todayISO());
      clearFile();
      payMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    payMutation.reset();
    clearFile();
    onClose();
  };

  const handleConfirm = () => {
    if (!payable) return;
    payMutation.mutate(
      { id: payable.id, paidAt, file },
      { onSuccess: close },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como paga</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {payable && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{payable.description}</strong> —{' '}
              {formatCents(payable.amount)}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="pay-paid-at">Data do pagamento</Label>
            <Input
              id="pay-paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Comprovante (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-input bg-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
              >
                <Upload size={14} className="shrink-0" />
                <span>Anexar comprovante (imagem ou PDF)</span>
              </button>
            )}
          </div>

          {payMutation.isError && (
            <p className="text-xs text-destructive">
              {getErrorMessage(payMutation.error, 'Erro ao registrar pagamento.')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={payMutation.isPending}>
            {payMutation.isPending ? 'Salvando...' : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
