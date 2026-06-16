import type { AssociateStatus } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { ASSOCIATE_STATUS_LABELS, ASSOCIATE_STATUS_VARIANTS } from '../constants';

export function AssociateStatusBadge({ status }: { status: AssociateStatus }) {
  return <Badge variant={ASSOCIATE_STATUS_VARIANTS[status]}>{ASSOCIATE_STATUS_LABELS[status]}</Badge>;
}
