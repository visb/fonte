import { AlertTriangle, Archive, CalendarArrowDown, CalendarArrowUp, Home, Loader2, RotateCcw, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getErrorMessage } from '@/lib/errors';
import { useHouses } from '@/features/houses/hooks/useHouses';
import type { ImportQueueItem } from '../../hooks/useBulkImport';
import { useCheckImportConflict, useCommitImport } from '../../hooks/useBulkImport';
import { buildCommitPayloadFromPreview } from '../../lib/importCommit';
import {
  IMPORT_ITEM_STATUS_LABELS,
  IMPORT_ITEM_STATUS_VARIANT,
  IMPORT_TEXTS,
  importWarningsSummary,
  warningsToList,
} from '../../constants';
import { ImportWarnings } from './ImportWarnings';

interface ImportItemCardProps {
  item: ImportQueueItem;
  onRemove: (id: string) => void;
  /** Restaura um item cancelado (story 109) — só usado na aba Canceladas. */
  onRestore?: (id: string) => void;
  onViewFicha?: (item: ImportQueueItem) => void;
  /** Chamado quando o commit direto pelo card conclui — a fila marca `imported`. */
  onImported?: (id: string) => void;
  /** Nome de um filho já aprovado nesta sessão que conflita com este item. */
  sessionConflictName?: string | null;
}

function formatDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function ImportItemCard({
  item,
  onRemove,
  onRestore,
  onViewFicha,
  onImported,
  sessionConflictName,
}: ImportItemCardProps) {
  const { preview, status } = item;
  const resident = (preview?.resident ?? {}) as Record<string, unknown>;
  const name = typeof resident.name === 'string' ? resident.name : null;
  const cpf = typeof resident.cpf === 'string' ? resident.cpf : null;
  const entryDate = formatDate(resident.entryDate);
  const exitDate = formatDate(resident.exitDate);
  const houseName = preview?.matchedHouseName ?? preview?.houseName ?? null;

  const { data: houses = [], isPending: housesLoading } = useHouses();
  const conflictQuery = useCheckImportConflict(name, cpf, { enabled: status === 'ready' });
  const conflicts = conflictQuery.data?.conflicts ?? [];
  const warningsList = preview ? warningsToList(preview.warnings) : [];
  const warningsCount = warningsList.length;
  const commit = useCommitImport();

  const isImported = status === 'imported';
  const isCancelled = status === 'cancelled';
  const blockedReason = conflicts.length > 0
    ? IMPORT_TEXTS.conflictReason
    : sessionConflictName
      ? IMPORT_TEXTS.sessionConflictReason
      : null;

  const handleApprove = () => {
    if (!preview) return;
    commit.mutate(buildCommitPayloadFromPreview(preview, houses), {
      onSuccess: () => onImported?.(item.id),
    });
  };

  return (
    <Card className="p-4" data-testid="import-item-card">
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
            {/* Ficha fora da planilha: entra como arquivado (status ARCHIVED). */}
            {preview?.matchStatus === 'unmatched' && (status === 'ready' || isImported) && (
              <Badge
                variant="secondary"
                className="shrink-0 gap-1"
                title={IMPORT_TEXTS.archivedBadgeTitle}
              >
                <Archive size={11} />
                {IMPORT_TEXTS.archivedBadge}
              </Badge>
            )}
          </div>

          {/* Erro de extração ou motivo de pulo/falha da aprovação em lote. */}
          {item.error && (
            <p className="text-sm text-destructive">{item.error}</p>
          )}

          {(status === 'ready' || isImported) && preview && (
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
                {warningsCount > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded text-yellow-700 underline decoration-dotted underline-offset-2 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                      >
                        <AlertTriangle size={13} />
                        {importWarningsSummary(warningsCount)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-2">
                      <ImportWarnings warnings={warningsList} />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span>{importWarningsSummary(warningsCount)}</span>
                )}
                {status === 'ready' && conflicts.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle size={11} />
                    {IMPORT_TEXTS.conflictBadge}: {conflicts[0].name}
                  </Badge>
                )}
                {status === 'ready' && sessionConflictName && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle size={11} />
                    {IMPORT_TEXTS.sessionConflictReason}
                  </Badge>
                )}
              </div>
              {commit.isError && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(commit.error, IMPORT_TEXTS.commitError)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isCancelled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={IMPORT_TEXTS.restore}
              onClick={() => onRestore?.(item.id)}
            >
              <RotateCcw size={15} />
            </Button>
          ) : (
            !isImported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={IMPORT_TEXTS.remove}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 size={15} />
              </Button>
            )
          )}
          {status === 'ready' && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onViewFicha?.(item)}>
                {IMPORT_TEXTS.viewFicha}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1"
                disabled={!!blockedReason || commit.isPending || housesLoading}
                title={blockedReason ?? undefined}
                onClick={handleApprove}
              >
                {commit.isPending && <Loader2 size={12} className="animate-spin" />}
                {IMPORT_TEXTS.approve}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
