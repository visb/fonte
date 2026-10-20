import { ServantRank, STAFF_DISMISSAL_REASON_LABELS, StaffDismissalReason } from '@fonte/types';
import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const SERVANT_RANK_LABELS: Record<ServantRank, string> = {
  [ServantRank.ASPIRANTE]: 'Aspirante',
  [ServantRank.CONSAGRADO]: 'Consagrado',
  [ServantRank.ALIANCADO]: 'Aliançado',
};

export const SERVANT_RANK_VARIANT: Record<ServantRank, BadgeVariant> = {
  [ServantRank.ASPIRANTE]: 'secondary',
  [ServantRank.CONSAGRADO]: 'info',
  [ServantRank.ALIANCADO]: 'success',
};

// Story 217 — motivos do desligamento (labels únicos em `@fonte/types`).
export const DISMISSAL_REASON_LABELS = STAFF_DISMISSAL_REASON_LABELS;

export const DISMISSAL_REASON_ORDER: StaffDismissalReason[] = [
  StaffDismissalReason.OWN_REQUEST,
  StaffDismissalReason.COORDINATION_DECISION,
  StaffDismissalReason.TRANSFER_OTHER_WORK,
  StaffDismissalReason.DEATH,
  StaffDismissalReason.OTHER,
];

export const SERVANT_RANK_ORDER: ServantRank[] = [
  ServantRank.ASPIRANTE,
  ServantRank.CONSAGRADO,
  ServantRank.ALIANCADO,
];
