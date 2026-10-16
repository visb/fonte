import {
  RESIDENT_REMOVAL_LABELS,
  RESIDENT_ROW_ACTION_LABELS,
  RESIDENT_ROW_ACTIONS,
  todayInSaoPaulo,
  type ResidentRemovalAction,
  type ResidentRowAction,
} from '@fonte/types';
import type { House, Resident } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useResidentRemovalForm } from '../hooks/useResidentRemovalForm';

interface Props {
  open: boolean;
  onClose: () => void;
  resident: Resident;
  /** Item do menu escolhido (story 200): saída da comunidade ou transferência. */
  mode: ResidentRowAction;
}

export function RemoveResidentDialog({ open, onClose, resident, mode }: Props) {
  // Autossuficiente (CLAUDE.md): busca as casas por conta própria, só enquanto
  // aberto — nada de prop drilling de lista de casas pela listagem de filhos.
  const { data: houses = [] } = useHouses({ enabled: open });
  const {
    register,
    control,
    action,
    isPending,
    handleClose,
    onSubmit,
    formState: { errors },
  } = useResidentRemovalForm(resident, mode, onClose);
  const actions = RESIDENT_ROW_ACTIONS[mode];
  const otherHouses = houses.filter((h: House) => h.id !== resident.houseId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{RESIDENT_ROW_ACTION_LABELS[mode]}</DialogTitle>
          <DialogDescription>{resident.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {/* Transferência tem uma ação só: nada a escolher, vai direto à casa. */}
          {actions.length > 1 && (
            <FormField label="O que aconteceu?" error={errors.action?.message}>
              <Select {...register('action')}>
                {actions.map((key: ResidentRemovalAction) => (
                  <option key={key} value={key}>
                    {RESIDENT_REMOVAL_LABELS[key].label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <p className="text-xs text-muted-foreground">
            {RESIDENT_REMOVAL_LABELS[action]?.description}
          </p>

          {action === 'transfer' ? (
            <FormField
              label="Casa de destino"
              error={'targetHouseId' in errors ? errors.targetHouseId?.message : undefined}
            >
              <Select {...register('targetHouseId')}>
                <option value="">Selecione...</option>
                {otherHouses.map((house: House) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField
              label="Data do acontecimento"
              error={'exitDate' in errors ? errors.exitDate?.message : undefined}
            >
              <ControlledDateInput
                control={control}
                name="exitDate"
                min={resident.entryDate ? resident.entryDate.slice(0, 10) : undefined}
                max={todayInSaoPaulo()}
              />
            </FormField>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
