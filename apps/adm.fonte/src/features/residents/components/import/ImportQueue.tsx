import { EmptyState } from '@/components/shared/EmptyState';
import type { ImportQueueItem } from '../../hooks/useBulkImport';
import { ImportItemCard } from './ImportItemCard';
import { IMPORT_TEXTS } from '../../constants';

interface ImportQueueProps {
  items: ImportQueueItem[];
  onRemove: (id: string) => void;
  onViewFicha?: (item: ImportQueueItem) => void;
  onImported?: (id: string) => void;
  sessionConflictName?: (item: ImportQueueItem) => string | null;
}

export function ImportQueue({
  items,
  onRemove,
  onViewFicha,
  onImported,
  sessionConflictName,
}: ImportQueueProps) {
  if (items.length === 0) {
    return <EmptyState title={IMPORT_TEXTS.emptyQueue} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ImportItemCard
          key={item.id}
          item={item}
          onRemove={onRemove}
          onViewFicha={onViewFicha}
          onImported={onImported}
          sessionConflictName={sessionConflictName?.(item) ?? null}
        />
      ))}
    </div>
  );
}
