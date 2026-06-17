import { CheckCircle2, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { PayableStatus } from '@fonte/types';
import type { Payable } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate } from '@/features/associates/lib/format';
import { PayableStatusBadge } from './PayableStatusBadge';
import { PAYABLE_CATEGORY_LABELS } from '../constants';
import { formatCents } from '../lib/money';

interface Props {
  open: boolean;
  payable: Payable | null;
  onClose: () => void;
  onEdit: (payable: Payable) => void;
  onPay: (payable: Payable) => void;
  onDelete: (payable: Payable) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function AttachmentLink({ url, name, fallback }: { url: string; name: string | null; fallback: string }) {
  return (
    <a
      href={api.photoUrl(url) ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <Paperclip size={13} className="shrink-0" />
      <span className="truncate">{name ?? fallback}</span>
    </a>
  );
}

export function PayableDetailDialog({ open, payable, onClose, onEdit, onPay, onDelete }: Props) {
  if (!payable) return null;
  const isOpen = payable.status === PayableStatus.OPEN;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{payable.description}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold tabular-nums">{formatCents(payable.amount)}</span>
            <PayableStatusBadge status={payable.status} overdue={payable.overdue} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">{PAYABLE_CATEGORY_LABELS[payable.category]}</Field>
            <Field label="Fornecedor">{payable.supplier ?? '—'}</Field>
            <Field label="Vencimento">{formatDate(payable.dueDate)}</Field>
            <Field label="Pago em">{payable.paidAt ? formatDate(payable.paidAt) : '—'}</Field>
          </div>

          {payable.notes && <Field label="Observação">{payable.notes}</Field>}

          <Field label="Conta anexada">
            {payable.attachmentUrl ? (
              <AttachmentLink url={payable.attachmentUrl} name={payable.attachmentName} fallback="Ver conta" />
            ) : (
              <span className="text-muted-foreground">Nenhum arquivo</span>
            )}
          </Field>

          <Field label="Comprovante de pagamento">
            {payable.paymentReceiptUrl ? (
              <AttachmentLink
                url={payable.paymentReceiptUrl}
                name={payable.paymentReceiptName}
                fallback="Ver comprovante"
              />
            ) : (
              <span className="text-muted-foreground">Nenhum comprovante</span>
            )}
          </Field>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(payable)}
          >
            <Trash2 size={15} className="mr-1.5" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(payable)}>
              <Pencil size={15} className="mr-1.5" />
              Editar
            </Button>
            {isOpen && (
              <Button size="sm" onClick={() => onPay(payable)}>
                <CheckCircle2 size={15} className="mr-1.5" />
                Marcar como paga
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
