import { PayableCategory, PayableStatus } from '@fonte/types';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info';

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  [PayableCategory.UTILITIES]: 'Utilidades',
  [PayableCategory.SUPPLIES]: 'Suprimentos',
  [PayableCategory.MAINTENANCE]: 'Manutenção',
  [PayableCategory.PAYROLL]: 'Folha de pagamento',
  [PayableCategory.TAXES]: 'Impostos',
  [PayableCategory.OTHER]: 'Outros',
};

/** Lista ordenada de categorias para selects. */
export const PAYABLE_CATEGORIES: PayableCategory[] = [
  PayableCategory.UTILITIES,
  PayableCategory.SUPPLIES,
  PayableCategory.MAINTENANCE,
  PayableCategory.PAYROLL,
  PayableCategory.TAXES,
  PayableCategory.OTHER,
];

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  [PayableStatus.OPEN]: 'Em aberto',
  [PayableStatus.PAID]: 'Paga',
};

export const PAYABLE_STATUS_VARIANTS: Record<PayableStatus, BadgeVariant> = {
  [PayableStatus.OPEN]: 'warning',
  [PayableStatus.PAID]: 'success',
};
