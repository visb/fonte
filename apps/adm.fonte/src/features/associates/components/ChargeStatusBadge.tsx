import type { ChargeStatus } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { CHARGE_STATUS_LABELS, CHARGE_STATUS_VARIANTS } from '../constants';

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return <Badge variant={CHARGE_STATUS_VARIANTS[status]}>{CHARGE_STATUS_LABELS[status]}</Badge>;
}
