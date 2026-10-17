import { X } from 'lucide-react';
import type { HouseMinistry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { toastError } from '@/lib/toast';
import {
  useAddMinistryResident,
  useMinistryDetail,
  useMinistryEligibleResidents,
  useRemoveMinistryResident,
} from '../../hooks/useHouseMinistries';
import { MinistryResidentPicker } from './MinistryResidentPicker';

interface Props {
  ministry: HouseMinistry | null;
  onClose: () => void;
  houseId: string;
}

/**
 * Filhos do ministério (story 205): lista os membros filhos com "remover" e a
 * busca "Adicionar filho", que só oferece filho em acolhimento na casa. Cada
 * adição é uma chamada — sem lote fora de transação.
 */
export function MinistryResidentsDialog({ ministry, onClose, houseId }: Props) {
  const ministryId = ministry?.id ?? '';
  const detail = useMinistryDetail(ministry?.id ?? null);
  const { data: candidates = [] } = useMinistryEligibleResidents(houseId, { enabled: !!ministry });
  const addResident = useAddMinistryResident(houseId, ministryId);
  const removeResident = useRemoveMinistryResident(houseId, ministryId);

  const members = (detail.data?.members ?? []).filter((m) => m.role === 'FILHO');
  const memberIds = new Set(members.map((m) => m.id));
  const busy = addResident.isPending || removeResident.isPending;

  const onError = (error: unknown) => toastError(error, 'Erro ao atualizar os filhos do ministério');

  return (
    <Dialog open={!!ministry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filhos — {ministry?.name}</DialogTitle>
        </DialogHeader>

        {detail.isLoading ? (
          <LoadingState />
        ) : detail.error ? (
          <ErrorState message={getErrorMessage(detail.error, 'Erro ao carregar o ministério.')} />
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Filhos ({members.length})</Label>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">Nenhum filho neste ministério.</p>
              ) : (
                <ul className="border border-border rounded-md divide-y">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{m.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={`Remover ${m.name}`}
                        disabled={busy}
                        onClick={() => removeResident.mutate(m.id, { onError })}
                      >
                        <X size={13} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Adicionar filho</Label>
              <MinistryResidentPicker
                candidates={candidates}
                memberIds={memberIds}
                disabled={busy}
                onAdd={(residentId) => addResident.mutate(residentId, { onError })}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
