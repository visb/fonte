import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StaffDismissalReason, todayInSaoPaulo } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDismissStaff, useStaffServicePeriods } from '../hooks/useStaff';
import { DISMISSAL_REASON_LABELS, DISMISSAL_REASON_ORDER } from '../constants';
import {
  dismissFormDefaults,
  makeDismissFormSchema,
  toDismissPayload,
  type DismissFormValues,
} from '../lib/dismissalForm';

interface Props {
  open: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
}

/**
 * Story 217 — desliga o servo (só ADMIN): data (default hoje), motivo e
 * observação (obrigatória quando "Outro"). Busca os próprios períodos para
 * validar a data contra o início do período em andamento.
 */
export function DismissStaffDialog({ open, onClose, staffId, staffName }: Props) {
  const { data: periods = [] } = useStaffServicePeriods(staffId, { enabled: open });
  const mutation = useDismissStaff(staffId);
  const schema = useMemo(() => makeDismissFormSchema({ periods }), [periods]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DismissFormValues>({ resolver: zodResolver(schema), defaultValues: dismissFormDefaults() });

  useEffect(() => {
    if (open) reset(dismissFormDefaults());
  }, [open, reset]);

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: DismissFormValues) =>
    mutation.mutate(toDismissPayload(values), { onSuccess: handleClose });

  const notesRequired = watch('reason') === StaffDismissalReason.OTHER;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desligar servo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <strong>{staffName}</strong> perde o acesso ao sistema e sai das listas de servos ativos. O
            cadastro e o histórico continuam disponíveis no filtro “Desligados”.
          </p>

          <FormField label="Data do desligamento *" error={errors.date?.message}>
            <ControlledDateInput control={control} name="date" id="dismiss-date" max={todayInSaoPaulo()} />
          </FormField>

          <FormField label="Motivo *" error={errors.reason?.message}>
            <Select aria-label="Motivo" {...register('reason')}>
              <option value="">Selecione…</option>
              {DISMISSAL_REASON_ORDER.map((reason) => (
                <option key={reason} value={reason}>
                  {DISMISSAL_REASON_LABELS[reason]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={notesRequired ? 'Observação *' : 'Observação'} error={errors.notes?.message}>
            <Textarea aria-label="Observação" rows={3} {...register('notes')} />
          </FormField>

          {mutation.isError && (
            <p className="text-sm text-destructive">{getErrorMessage(mutation.error, 'Erro ao desligar o servo.')}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending ? 'Desligando...' : 'Desligar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
