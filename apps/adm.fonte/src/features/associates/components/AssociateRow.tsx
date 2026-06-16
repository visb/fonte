import { Ban, Pencil, Trash2 } from 'lucide-react';
import { AssociateStatus } from '@fonte/types';
import type { AssociateListItem } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { AssociateStatusBadge } from './AssociateStatusBadge';

interface Props {
  associate: AssociateListItem;
  onEdit: (associate: AssociateListItem) => void;
  onDelete: (associate: AssociateListItem) => void;
  onCancelSubscription: (associate: AssociateListItem) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function AssociateRow({ associate, onEdit, onDelete, onCancelSubscription }: Props) {
  const canCancel =
    associate.status === AssociateStatus.ACTIVE ||
    associate.status === AssociateStatus.PAST_DUE;
  return (
    <TableRow>
      <TableCell className="font-medium">{associate.name}</TableCell>
      <TableCell>{associate.whatsapp}</TableCell>
      <TableCell className="text-muted-foreground">{associate.email ?? '—'}</TableCell>
      <TableCell>{currency.format(associate.contributionAmount)}</TableCell>
      <TableCell>Dia {associate.dueDay}</TableCell>
      <TableCell>
        <AssociateStatusBadge status={associate.status} />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button variant="ghost" size="icon" title="Editar" onClick={() => onEdit(associate)}>
          <Pencil size={15} />
        </Button>
        {canCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="text-amber-600 hover:text-amber-600"
            title="Cancelar recorrência"
            onClick={() => onCancelSubscription(associate)}
          >
            <Ban size={15} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          title="Excluir"
          onClick={() => onDelete(associate)}
        >
          <Trash2 size={15} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
