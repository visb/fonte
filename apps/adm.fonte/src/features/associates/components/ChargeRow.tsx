import { Loader2, Receipt } from 'lucide-react';
import { ChargeStatus } from '@fonte/types';
import type { AssociateCharge } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChargeStatusBadge } from './ChargeStatusBadge';
import { formatBRL, formatDate } from '../lib/format';

interface Props {
  charge: AssociateCharge;
  /** Story 178 — download do recibo; ausente ⇒ coluna sem ação (leitura). */
  onDownloadReceipt?: (chargeId: string) => void;
  isDownloadingReceipt?: boolean;
}

export function ChargeRow({ charge, onDownloadReceipt, isDownloadingReceipt }: Props) {
  // Story 178 — recibo só existe para cobrança PAGA: não há o que declarar
  // recebido numa cobrança pendente, vencida ou falha.
  const canDownloadReceipt = charge.status === ChargeStatus.PAID;

  return (
    <TableRow>
      <TableCell>{formatDate(charge.dueDate)}</TableCell>
      <TableCell>{formatBRL(charge.grossAmount)}</TableCell>
      <TableCell>
        <ChargeStatusBadge status={charge.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(charge.paidAt)}</TableCell>
      <TableCell className="text-right">
        {canDownloadReceipt && (
          <Button
            variant="ghost"
            size="sm"
            title="Baixar recibo"
            disabled={isDownloadingReceipt}
            onClick={() => onDownloadReceipt?.(charge.id)}
          >
            {isDownloadingReceipt ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Receipt size={14} className="mr-1.5" />
            )}
            Recibo
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
