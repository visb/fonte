import type { MouseEvent } from 'react';
import { CheckCircle2, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { PayableStatus } from '@fonte/types';
import type { Payable } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/features/associates/lib/format';
import { PayableStatusBadge } from './PayableStatusBadge';
import { PAYABLE_CATEGORY_LABELS } from '../constants';
import { formatCents } from '../lib/money';

interface Props {
  payable: Payable;
  onView: (payable: Payable) => void;
  onEdit: (payable: Payable) => void;
  onPay: (payable: Payable) => void;
  onDelete: (payable: Payable) => void;
}

export function PayableRow({ payable, onView, onEdit, onPay, onDelete }: Props) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const isOpen = payable.status === PayableStatus.OPEN;

  return (
    <TableRow
      className={`cursor-pointer ${payable.overdue && isOpen ? 'bg-destructive/5' : ''}`}
      onClick={() => onView(payable)}
    >
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {payable.description}
          {payable.attachmentUrl && (
            <a
              href={api.photoUrl(payable.attachmentUrl) ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={payable.attachmentName ?? 'Ver conta anexada'}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip size={13} />
            </a>
          )}
        </span>
      </TableCell>
      <TableCell>{PAYABLE_CATEGORY_LABELS[payable.category]}</TableCell>
      <TableCell className="text-muted-foreground">{payable.supplier ?? '—'}</TableCell>
      <TableCell>{formatCents(payable.amount)}</TableCell>
      <TableCell>{formatDate(payable.dueDate)}</TableCell>
      <TableCell>
        <PayableStatusBadge status={payable.status} overdue={payable.overdue} />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {isOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="text-green-600 hover:text-green-600"
            title="Marcar como paga"
            onClick={stop(() => onPay(payable))}
          >
            <CheckCircle2 size={15} />
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Editar" onClick={stop(() => onEdit(payable))}>
          <Pencil size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          title="Excluir"
          onClick={stop(() => onDelete(payable))}
        >
          <Trash2 size={15} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
