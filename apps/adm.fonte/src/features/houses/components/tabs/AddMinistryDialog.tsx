import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeaderAutocomplete, type SelectedLeader } from '../LeaderAutocomplete';
import { useCreateHouseMinistry } from '../../hooks/useHouseMinistries';
import { useHouseStaff } from '../../hooks/useHouses';

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
}

// Story 197: ministério é organização de trabalho de servo — não há mais
// seleção de filhos aqui, nem filho como líder.
export function AddMinistryDialog({ open, onClose, houseId }: Props) {
  const [name, setName] = useState('');
  const [leader, setLeader] = useState<SelectedLeader | null>(null);

  const { data: staff = [] } = useHouseStaff(houseId, { enabled: open });
  const mutation = useCreateHouseMinistry(houseId);

  function handleClose() {
    setName('');
    setLeader(null);
    onClose();
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutation.mutate(
      {
        name: trimmed,
        leaderId: leader?.id ?? null,
        leaderType: leader?.type ?? null,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo ministério</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ministry-name">Nome *</Label>
            <Input
              id="ministry-name"
              placeholder="Ex: Cozinha, Horta, Manutenção..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* Leader */}
          <div className="space-y-1.5">
            <Label>Líder (opcional)</Label>
            <LeaderAutocomplete
              selectedId={leader?.id ?? null}
              onSelect={(id, type) => setLeader(id && type ? { id, type } : null)}
              staff={staff}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
