import { formatIsoDateBr } from '@fonte/types';
import { Badge } from '@/components/ui/badge';

/** Story 217 — selo "Desligado em dd/mm/aaaa" do servo desligado. */
export function StaffDismissedBadge({ dismissedAt }: { dismissedAt: string }) {
  return <Badge variant="warning">Desligado em {formatIsoDateBr(dismissedAt.slice(0, 10))}</Badge>;
}
