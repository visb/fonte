import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { HouseMinistry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseMinistriesList } from '../../hooks/useHouseMinistries';
import { AddMinistryDialog } from './AddMinistryDialog';
import { EditMinistryLeaderDialog } from './EditMinistryLeaderDialog';
import { MinistryResidentsDialog } from './MinistryResidentsDialog';
import { MinistryRow } from './MinistryRow';
import { RemoveMinistryDialog } from './RemoveMinistryDialog';

export function MinistriesTab({ houseId }: { houseId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseMinistry | null>(null);
  const [residentsTarget, setResidentsTarget] = useState<HouseMinistry | null>(null);
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
              <MinistryRow
                key={hm.id}
                ministry={hm}
                onEditLeader={() => setEditTarget(hm)}
                onManageResidents={() => setResidentsTarget(hm)}
                onRemove={() => setRemoveTarget(hm)}
              />
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

      <MinistryResidentsDialog
        ministry={residentsTarget}
        onClose={() => setResidentsTarget(null)}
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
