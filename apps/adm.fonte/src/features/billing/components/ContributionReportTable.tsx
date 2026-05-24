import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContributionReportItem } from '@fonte/api-client';
import { ContributionRow } from './ContributionRow';

interface ContributionReportTableProps {
  items: ContributionReportItem[];
}

export function ContributionReportTable({ items }: ContributionReportTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Casa</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ContributionRow key={item.residentId} item={item} />
        ))}
      </TableBody>
    </Table>
  );
}
