import type { AuditChange } from '@fonte/types';
import { ShieldCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fieldLabel, formatChangeValue } from '../constants';

interface Props {
  changes: AuditChange[];
}

/** Tabela Campo / Antes / Depois — rótulos legíveis, nunca JSON bruto. */
export function AuditChangesTable({ changes }: Props) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo</TableHead>
            <TableHead>Antes</TableHead>
            <TableHead>Depois</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => (
            <TableRow key={change.field} data-testid={`audit-change-${change.field}`}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-1">
                  {fieldLabel(change.field)}
                  {change.redacted && (
                    <ShieldCheck size={12} className="text-muted-foreground" aria-label="Dado protegido" />
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatChangeValue(change.before, change.redacted)}
              </TableCell>
              <TableCell>{formatChangeValue(change.after, change.redacted)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
