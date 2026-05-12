import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { HouseMinistry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseMinistriesList } from '../../hooks/useHouseMinistries';
import { AddMinistryDialog } from './AddMinistryDialog';
import { EditMinistryLeaderDialog } from './EditMinistryLeaderDialog';
import { RemoveMinistryDialog } from './RemoveMinistryDialog';

export function MinistriesTab({ houseId }: { houseId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseMinistry | null>(null);
  const [removeTarget, setRemoveTarget] = useState<HouseMinistry | null>(null);

  const { data: houseMinistries = [], isLoading } = useHouseMinistriesList(houseId);

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-2" />
            Novo ministério
          </Button>
        </div>

        {houseMinistries.length === 0 ? (
          <EmptyState title="Nenhum ministério cadastrado para esta casa." />
        ) : (
          <div className="space-y-2">
            {houseMinistries.map((hm) => (
              <div key={hm.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{hm.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Responsável: {hm.leaderName ?? 'Não definido'}
                    {' · '}
                    {hm.filhoCount} {hm.filhoCount === 1 ? 'filho' : 'filhos'}
                    {' · '}
                    {hm.servoCount} {hm.servoCount === 1 ? 'servo' : 'servos'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar responsável"
                    onClick={() => setEditTarget(hm)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Remover ministério"
                    onClick={() => setRemoveTarget(hm)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddMinistryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        houseId={houseId}
      />

      <EditMinistryLeaderDialog
        ministry={editTarget}
        onClose={() => setEditTarget(null)}
        houseId={houseId}
      />

      <RemoveMinistryDialog
        ministry={removeTarget}
        onClose={() => setRemoveTarget(null)}
        houseId={houseId}
      />
    </>
  );
}
