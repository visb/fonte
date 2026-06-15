import { useMemo, useState } from 'react';
import { normalizeForSearch } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeaderAutocomplete, type LeaderType, type SelectedLeader } from '../LeaderAutocomplete';
import { useCreateHouseMinistry } from '../../hooks/useHouseMinistries';
import { useHouseStaff, useHouseResidents } from '../../hooks/useHouses';

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
}

export function AddMinistryDialog({ open, onClose, houseId }: Props) {
  const [name, setName] = useState('');
  const [leader, setLeader] = useState<SelectedLeader | null>(null);
  const [residentIds, setResidentIds] = useState<Set<string>>(new Set());
  const [residentSearch, setResidentSearch] = useState('');

  const { data: staff = [] } = useHouseStaff(houseId, { enabled: open });
  const { data: residents = [] } = useHouseResidents(houseId, { enabled: open });
  const mutation = useCreateHouseMinistry(houseId);

  const filteredResidents = useMemo(
    () => residents.filter((r) => normalizeForSearch(r.name).includes(normalizeForSearch(residentSearch))),
    [residents, residentSearch],
  );

  function toggleResident(id: string) {
    setResidentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setName('');
    setLeader(null);
    setResidentIds(new Set());
    setResidentSearch('');
    onClose();
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutation.mutate(
      {
        name: trimmed,
        leaderId: leader?.id ?? null,
        leaderType: leader?.type as LeaderType ?? null,
        residentIds: [...residentIds],
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
              selectedType={leader?.type ?? null}
              onSelect={(id, type) => setLeader(id && type ? { id, type } : null)}
              staff={staff}
              residents={residents}
            />
          </div>

          {/* Filhos */}
          <div className="space-y-1.5">
            <Label>
              Filhos{residentIds.size > 0 ? ` (${residentIds.size} selecionados)` : ' (opcional)'}
            </Label>
            <Input
              placeholder="Buscar filho..."
              value={residentSearch}
              onChange={(e) => setResidentSearch(e.target.value)}
            />
            {filteredResidents.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">Nenhum filho encontrado.</p>
            ) : (
              <div className="border border-border rounded-md overflow-hidden max-h-40 overflow-y-auto">
                {filteredResidents.map((r) => {
                  const selected = residentIds.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left border-b border-border last:border-0 hover:bg-accent transition-colors ${selected ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleResident(r.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span>{r.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
