import { ServantRank } from '@fonte/types';
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

export const SERVANT_RANK_ORDER: ServantRank[] = [
  ServantRank.ASPIRANTE,
  ServantRank.CONSAGRADO,
  ServantRank.ALIANCADO,
];
