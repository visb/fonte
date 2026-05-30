import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StreetSalesReportByHouse } from '@fonte/api-client';

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  byHouse: StreetSalesReportByHouse[];
}

export function SalesByHouseTable({ byHouse }: Props) {
  if (byHouse.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Casa</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">PIX</TableHead>
            <TableHead className="text-right">Dinheiro</TableHead>
            <TableHead className="text-right">Cartão</TableHead>
            <TableHead className="text-right font-semibold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {byHouse.map((h) => (
            <TableRow key={h.houseId}>
              <TableCell className="font-medium">{h.houseName}</TableCell>
              <TableCell className="text-right">{h.totalQuantity}</TableCell>
              <TableCell className="text-right">{formatBRL(h.totalPix)}</TableCell>
              <TableCell className="text-right">{formatBRL(h.totalCash)}</TableCell>
              <TableCell className="text-right">{formatBRL(h.totalCard)}</TableCell>
              <TableCell className="text-right font-semibold">{formatBRL(h.totalAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
