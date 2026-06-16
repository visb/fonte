import type { MouseEvent } from 'react';
import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { PayableStatus } from '@fonte/types';
import type { Payable } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatDate } from '@/features/associates/lib/format';
import { PayableStatusBadge } from './PayableStatusBadge';
import { PAYABLE_CATEGORY_LABELS } from '../constants';
import { formatCents } from '../lib/money';

interface Props {
  payable: Payable;
  onEdit: (payable: Payable) => void;
  onPay: (payable: Payable) => void;
  onDelete: (payable: Payable) => void;
}

export function PayableRow({ payable, onEdit, onPay, onDelete }: Props) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const isOpen = payable.status === PayableStatus.OPEN;

  return (
    <TableRow className={payable.overdue && isOpen ? 'bg-destructive/5' : undefined}>
      <TableCell className="font-medium">{payable.description}</TableCell>
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
