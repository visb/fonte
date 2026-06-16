import type { AssociateStatus } from '@fonte/api-client';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info';

export const ASSOCIATE_STATUS_LABELS: Record<AssociateStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Em atraso',
  CANCELED: 'Cancelado',
};

export const ASSOCIATE_STATUS_VARIANTS: Record<AssociateStatus, BadgeVariant> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  PAST_DUE: 'destructive',
  CANCELED: 'secondary',
};
