import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import type { HouseRule } from '@fonte/api-client';
import { useHouseRules } from '../../hooks/useHouseRules';
import { AddRuleDialog } from './AddRuleDialog';
import { RemoveRuleDialog } from './RemoveRuleDialog';

export function RulesTab({ houseId }: { houseId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<HouseRule | null>(null);

  const { data: rules = [], isLoading } = useHouseRules(houseId);

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-2" />
            Nova regra
          </Button>
        </div>

        {rules.length === 0 ? (
          <EmptyState title="Nenhuma regra cadastrada." />
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm">{rule.title}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    title="Remover regra"
                    onClick={() => setRemoveTarget(rule)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddRuleDialog open={addOpen} onClose={() => setAddOpen(false)} houseId={houseId} />
      <RemoveRuleDialog rule={removeTarget} onClose={() => setRemoveTarget(null)} houseId={houseId} />
    </>
  );
}
