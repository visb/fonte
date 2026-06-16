import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (open) {
      setPaidAt(todayISO());
      payMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = () => {
    if (!payable) return;
    payMutation.mutate(
      { id: payable.id, data: { paidAt } },
      { onSuccess: () => { payMutation.reset(); onClose(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { payMutation.reset(); onClose(); } }}>
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
          {payMutation.isError && (
            <p className="text-xs text-destructive">
              {getErrorMessage(payMutation.error, 'Erro ao registrar pagamento.')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { payMutation.reset(); onClose(); }}>
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
