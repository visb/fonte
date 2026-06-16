import type { AssociateStatus, ChargeStatus } from '@fonte/api-client';

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

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  FAILED: 'Falhou',
};

export const CHARGE_STATUS_VARIANTS: Record<ChargeStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'destructive',
};
