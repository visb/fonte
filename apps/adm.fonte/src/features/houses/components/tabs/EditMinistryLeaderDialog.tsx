import { useEffect, useState } from 'react';
import type { HouseMinistry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LeaderAutocomplete, type SelectedLeader, type LeaderType } from '../LeaderAutocomplete';
import { useUpdateMinistryLeader } from '../../hooks/useHouseMinistries';
import { useHouseStaff, useHouseResidents } from '../../hooks/useHouses';

interface Props {
  ministry: HouseMinistry | null;
  onClose: () => void;
  houseId: string;
}

export function EditMinistryLeaderDialog({ ministry, onClose, houseId }: Props) {
  const { data: staff = [] } = useHouseStaff(houseId, { enabled: !!ministry });
  const { data: residents = [] } = useHouseResidents(houseId, { enabled: !!ministry });
  const [leader, setLeader] = useState<SelectedLeader | null>(null);

  useEffect(() => {
    if (ministry) {
      setLeader(
        ministry.leaderId && ministry.leaderType
          ? { id: ministry.leaderId, type: ministry.leaderType as LeaderType }
          : null,
      );
    }
  }, [ministry]);

  const mutation = useUpdateMinistryLeader(houseId);

  function handleSubmit() {
    if (!ministry) return;
    mutation.mutate(
      { ministryId: ministry.id, leaderId: leader?.id ?? null, leaderType: leader?.type ?? null },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={!!ministry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Responsável — {ministry?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Responsável</Label>
          <LeaderAutocomplete
            selectedId={leader?.id ?? null}
            selectedType={leader?.type ?? null}
            onSelect={(id, type) => setLeader(id && type ? { id, type } : null)}
            staff={staff}
            residents={residents}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
