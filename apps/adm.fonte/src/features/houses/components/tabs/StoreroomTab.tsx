import { ArrowDown, ArrowUp } from 'lucide-react';
import { MovementType } from '@fonte/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseStoreroomItems, useHouseStoreroomMovements } from '../../hooks/useHouses';

export function StoreroomTab({ houseId }: { houseId: string }) {
  const { data: items = [], isLoading: loadingItems } = useHouseStoreroomItems(houseId);
  const { data: movements = [], isLoading: loadingMovements } = useHouseStoreroomMovements(houseId);

  if (loadingItems || loadingMovements) return <LoadingState />;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold mb-3">Itens</h3>
        {items.length === 0 ? (
          <EmptyState title="Nenhum item cadastrado." />
        ) : (
          <div className="rounded-lg border divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium">{item.name}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {Number(item.currentQuantity)} <span className="font-normal text-muted-foreground">{item.unit}</span>
                  </p>
                  {item.weeklyAverageUsage !== null && (
                    <p className="text-xs text-muted-foreground">
                      ~{Number(item.weeklyAverageUsage).toFixed(1)} {item.unit}/sem
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Movimentações recentes</h3>
        {movements.length === 0 ? (
          <EmptyState title="Nenhuma movimentação registrada." />
        ) : (
          <div className="rounded-lg border divide-y">
            {movements.map((mov) => (
              <div key={mov.id} className="flex items-center gap-3 px-4 py-3">
                <div className="shrink-0">
                  {mov.type === MovementType.IN ? (
                    <ArrowDown size={16} className="text-green-600" />
                  ) : (
                    <ArrowUp size={16} className="text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mov.item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {mov.responsible.name} · {new Date(mov.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {mov.notes && ` · ${mov.notes}`}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">
                  {mov.type === MovementType.IN ? '+' : '-'}{Number(mov.quantity)}{' '}
                  <span className="font-normal text-muted-foreground">{mov.item.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
