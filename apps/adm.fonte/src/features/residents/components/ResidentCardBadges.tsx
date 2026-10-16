import { Link } from 'react-router-dom';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';
import { getPaymentBadge } from '../utils';

interface Props {
  resident: Resident;
}

/**
 * Badges do card de filho: status, Social e vencimento da contribuição.
 * No mobile quebram linha abaixo dos metadados; de `sm` para cima viram a
 * coluna à direita do conteúdo, como antes (story 206).
 */
export function ResidentCardBadges({ resident }: Props) {
  const paymentBadge = getPaymentBadge(
    resident.entryDate,
    resident.familyInvestment,
    resident.status,
    resident.lastContributionDate,
    resident.contributionDueDay,
  );

  return (
    <div data-testid="resident-card-badges" className="flex flex-wrap gap-1 sm:shrink-0">
      <Badge variant={RESIDENT_STATUS_VARIANT[resident.status]}>
        {RESIDENT_STATUS_LABELS[resident.status]}
      </Badge>
      {resident.familyInvestment === FamilyInvestment.SOCIAL && (
        <Badge variant="destructive">Social</Badge>
      )}
      {paymentBadge && (
        <Link
          to={`/residents/${resident.id}?tab=contributions`}
          className={cn(
            badgeVariants({ variant: paymentBadge.variant }),
            'relative z-10 cursor-pointer hover:opacity-80',
          )}
          title="Ver carnê de contribuição"
        >
          {paymentBadge.label}
        </Link>
      )}
    </div>
  );
}
