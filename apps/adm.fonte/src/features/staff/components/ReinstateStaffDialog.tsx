import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { todayInSaoPaulo } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useReinstateStaff, useStaffServicePeriods } from '../hooks/useStaff';
import {
  makeReinstateFormSchema,
  reinstateFormDefaults,
  toReinstatePayload,
  type ReinstateFormValues,
} from '../lib/dismissalForm';

interface Props {
  open: boolean;
  onClose: () => void;
  staffId: string;
  /** Casa sugerida (a última do cadastro). */
  houseId?: string | null;
}

/**
 * Story 217 — reintegra o servo desligado (só ADMIN): reativa o acesso e abre
 * um período de serviço novo na casa escolhida, a partir da data informada.
 */
export function ReinstateStaffDialog({ open, onClose, staffId, houseId }: Props) {
  const { data: houses = [] } = useHouses({ enabled: open });
  const { data: periods = [] } = useStaffServicePeriods(staffId, { enabled: open });
  const mutation = useReinstateStaff(staffId);
  const schema = useMemo(() => makeReinstateFormSchema({ periods }), [periods]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReinstateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: reinstateFormDefaults(houseId),
  });

  useEffect(() => {
    if (open) reset(reinstateFormDefaults(houseId));
  }, [open, houseId, reset]);

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: ReinstateFormValues) =>
    mutation.mutate(toReinstatePayload(values), { onSuccess: handleClose });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reintegrar servo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O acesso ao sistema volta e um novo período de serviço começa na data informada.
          </p>

          <FormField label="Casa" error={errors.houseId?.message}>
            <Select aria-label="Casa" {...register('houseId')}>
              <option value="">Sem casa</option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Início do novo período *" error={errors.date?.message}>
            <ControlledDateInput control={control} name="date" id="reinstate-date" max={todayInSaoPaulo()} />
          </FormField>

          {mutation.isError && (
            <p className="text-sm text-destructive">{getErrorMessage(mutation.error, 'Erro ao reintegrar o servo.')}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Reintegrando...' : 'Reintegrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
