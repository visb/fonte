import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LeaderAutocomplete, type SelectedLeader } from '../LeaderAutocomplete';
import { useAddMinistry, useHouseMinistriesList } from '../../hooks/useHouseMinistries';
import { useHouseStaff, useHouseResidents } from '../../hooks/useHouses';
import { useMinistries } from '@/features/ministries/hooks/useMinistries';
import { SELECT_CLASS } from '../../constants';

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
}

export function AddMinistryDialog({ open, onClose, houseId }: Props) {
  const { data: staff = [] } = useHouseStaff(houseId, { enabled: open });
  const { data: residents = [] } = useHouseResidents(houseId, { enabled: open });
  const { data: allMinistries = [] } = useMinistries({ enabled: open });
  const { data: houseMinistries = [] } = useHouseMinistriesList(houseId);

  const addedIds = new Set(houseMinistries.map((hm) => hm.ministryId));
  const availableMinistries = allMinistries.filter((m) => !addedIds.has(m.id));
  const [ministryId, setMinistryId] = useState('');
  const [leader, setLeader] = useState<SelectedLeader | null>(null);

  const mutation = useAddMinistry(houseId);

  function handleClose() {
    setMinistryId('');
    setLeader(null);
    onClose();
  }

  function handleSubmit() {
    mutation.mutate(
      { ministryId, leaderId: leader?.id, leaderType: leader?.type },
      { onSuccess: handleClose },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Setor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Setor *</Label>
            <select value={ministryId} onChange={(e) => setMinistryId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Selecionar...</option>
              {availableMinistries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {availableMinistries.length === 0 && (
              <p className="text-xs text-muted-foreground">Todos os ministérios já foram adicionados.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Responsável (opcional)</Label>
            <LeaderAutocomplete
              selectedId={leader?.id ?? null}
              selectedType={leader?.type ?? null}
              onSelect={(id, type) => setLeader(id && type ? { id, type } : null)}
              staff={staff}
              residents={residents}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!ministryId || mutation.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
