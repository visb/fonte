import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ImportQueueItem } from '../../hooks/useBulkImport';
import { ImportItemCard } from './ImportItemCard';
import {
  IMPORT_TABS,
  IMPORT_TAB_EMPTY,
  IMPORT_TAB_LABELS,
  IMPORT_TAB_STATUSES,
  IMPORT_TEXTS,
  type ImportTab,
} from '../../constants';

interface ImportQueueProps {
  items: ImportQueueItem[];
  onRemove: (id: string) => void;
  onRestore?: (id: string) => void;
  onViewFicha?: (item: ImportQueueItem) => void;
  onImported?: (id: string) => void;
  sessionConflictName?: (item: ImportQueueItem) => string | null;
  /** Contagem por aba para os badges; calculada a partir de `items` se ausente. */
  tabCounts?: Record<ImportTab, number>;
}

export function ImportQueue({
  items,
  onRemove,
  onRestore,
  onViewFicha,
  onImported,
  sessionConflictName,
  tabCounts,
}: ImportQueueProps) {
  // Nada carregado ainda: instrução de arrastar as fichas (mantém o fluxo 104).
  if (items.length === 0) {
    return <EmptyState title={IMPORT_TEXTS.emptyQueue} />;
  }

  const itemsFor = (tab: ImportTab) =>
    items.filter((item) => IMPORT_TAB_STATUSES[tab].includes(item.status));

  return (
    <Tabs defaultValue="queue">
      <TabsList>
        {IMPORT_TABS.map((tab) => {
          const count = tabCounts?.[tab] ?? itemsFor(tab).length;
          return (
            <TabsTrigger key={tab} value={tab} className="gap-1.5">
              {IMPORT_TAB_LABELS[tab]}
              {count > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {IMPORT_TABS.map((tab) => {
        const tabItems = itemsFor(tab);
        return (
          <TabsContent key={tab} value={tab}>
            {tabItems.length === 0 ? (
              <EmptyState title={IMPORT_TAB_EMPTY[tab]} />
            ) : (
              <div className="space-y-3">
                {tabItems.map((item) => (
                  <ImportItemCard
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onRestore={onRestore}
                    onViewFicha={onViewFicha}
                    onImported={onImported}
                    sessionConflictName={sessionConflictName?.(item) ?? null}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
