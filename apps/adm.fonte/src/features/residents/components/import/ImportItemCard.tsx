import { AlertTriangle, CalendarArrowDown, CalendarArrowUp, Home, Loader2, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ImportQueueItem } from '../../hooks/useBulkImport';
import { useCheckImportConflict } from '../../hooks/useBulkImport';
import {
  IMPORT_ITEM_STATUS_LABELS,
  IMPORT_ITEM_STATUS_VARIANT,
  IMPORT_TEXTS,
  importWarningsSummary,
} from '../../constants';

interface ImportItemCardProps {
  item: ImportQueueItem;
  onRemove: (id: string) => void;
  onApprove?: (item: ImportQueueItem) => void;
  onViewFicha?: (item: ImportQueueItem) => void;
}

function formatDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function countWarnings(warnings: Record<string, string>): number {
  return Object.values(warnings).filter(Boolean).length;
}

export function ImportItemCard({ item, onRemove, onApprove, onViewFicha }: ImportItemCardProps) {
  const { preview, status } = item;
  const resident = (preview?.resident ?? {}) as Record<string, unknown>;
  const name = typeof resident.name === 'string' ? resident.name : null;
  const cpf = typeof resident.cpf === 'string' ? resident.cpf : null;
  const entryDate = formatDate(resident.entryDate);
  const exitDate = formatDate(resident.exitDate);
  const houseName = preview?.matchedHouseName ?? preview?.houseName ?? null;

  const conflictQuery = useCheckImportConflict(name, cpf, { enabled: status === 'ready' });
  const conflicts = conflictQuery.data?.conflicts ?? [];
  const warningsCount = preview ? countWarnings(preview.warnings) : 0;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Foto */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {preview?.photoBase64 ? (
            <img src={preview.photoBase64} alt={name ?? item.fileName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <User size={24} />
            </div>
          )}
        </div>

        {/* Dados */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{name ?? item.fileName}</p>
            <Badge variant={IMPORT_ITEM_STATUS_VARIANT[status]} className="shrink-0">
              {status === 'processing' && <Loader2 size={11} className="mr-1 animate-spin" />}
              {IMPORT_ITEM_STATUS_LABELS[status]}
            </Badge>
          </div>

          {status === 'error' && (
            <p className="text-sm text-destructive">{item.error}</p>
          )}

          {status === 'ready' && preview && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {entryDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarArrowDown size={13} /> Entrada: {entryDate}
                  </span>
                )}
                {exitDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarArrowUp size={13} /> Saída: {exitDate}
                  </span>
                )}
                {!exitDate && houseName && (
                  <span className="inline-flex items-center gap-1">
                    <Home size={13} /> {houseName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(warningsCount > 0 && 'text-yellow-700 dark:text-yellow-400')}>
                  {importWarningsSummary(warningsCount)}
                </span>
                {conflicts.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle size={11} />
                    {IMPORT_TEXTS.conflictBadge}: {conflicts[0].name}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Remover"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 size={15} />
          </Button>
          {status === 'ready' && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onViewFicha?.(item)}>
                Ver ficha
              </Button>
              <Button type="button" size="sm" onClick={() => onApprove?.(item)}>
                Aprovar
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
