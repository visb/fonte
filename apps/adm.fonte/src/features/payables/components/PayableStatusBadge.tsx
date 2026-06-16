import { PayableStatus } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import { PAYABLE_STATUS_LABELS, PAYABLE_STATUS_VARIANTS } from '../constants';

interface Props {
  status: PayableStatus;
  overdue?: boolean;
}

export function PayableStatusBadge({ status, overdue }: Props) {
  // Conta em aberto e vencida ganha destaque "Vencida" (derivado, não persistido).
  if (overdue && status === PayableStatus.OPEN) {
    return <Badge variant="destructive">Vencida</Badge>;
  }
  return (
    <Badge variant={PAYABLE_STATUS_VARIANTS[status]}>
      {PAYABLE_STATUS_LABELS[status]}
    </Badge>
  );
}
