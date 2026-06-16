import type { Payable } from '@fonte/api-client';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PayableRow } from './PayableRow';

interface Props {
  payables: Payable[];
  onEdit: (payable: Payable) => void;
  onPay: (payable: Payable) => void;
  onDelete: (payable: Payable) => void;
}

export function PayableTable({ payables, onEdit, onPay, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payables.map((p) => (
            <PayableRow
              key={p.id}
              payable={p}
              onEdit={onEdit}
              onPay={onPay}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
