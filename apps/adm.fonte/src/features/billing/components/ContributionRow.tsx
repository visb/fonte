import { FamilyInvestment } from '@fonte/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ContributionReportItem } from '@fonte/api-client';
import { FAMILY_INVESTMENT_LABELS } from '@/features/residents/constants';

interface ContributionRowProps {
  item: ContributionReportItem;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

export function ContributionRow({ item }: ContributionRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-2">
          {item.residentName}
          {item.familyInvestment === FamilyInvestment.SOCIAL && (
            <Badge variant="destructive">Social</Badge>
          )}
        </span>
      </TableCell>
      <TableCell>{item.houseName}</TableCell>
      <TableCell>{FAMILY_INVESTMENT_LABELS[item.familyInvestment]}</TableCell>
      <TableCell>{formatBRL(item.expectedAmount ?? 0)}</TableCell>
      <TableCell>
        {item.paid ? (
          <Badge variant="success">Pago</Badge>
        ) : (
          <Badge variant="destructive">Pendente</Badge>
        )}
      </TableCell>
      <TableCell>{formatDate(item.paidAt)}</TableCell>
    </TableRow>
  );
}
