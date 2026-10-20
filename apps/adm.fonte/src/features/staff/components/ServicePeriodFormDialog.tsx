import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StaffServicePeriod } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useCreateServicePeriod, useStaffServicePeriods, useUpdateServicePeriod } from '../hooks/useStaff';
import {
  makeServicePeriodFormSchema,
  servicePeriodFormDefaults,
  servicePeriodFormMode,
  toCreateServicePeriodPayload,
  toUpdateServicePeriodPayload,
  type ServicePeriodFormMode,
  type ServicePeriodFormValues,
} from '../lib/servicePeriodForm';
import { ServicePeriodFormFields } from './ServicePeriodFormFields';

interface Props {
  open: boolean;
  onClose: () => void;
  staffId: string;
  /** Ausente = registrar período antigo; presente = editar este período. */
  period?: StaffServicePeriod | null;
}

const TITLES: Record<ServicePeriodFormMode, string> = {
  create: 'Adicionar período de serviço',
  edit: 'Editar período de serviço',
  open: 'Editar período em andamento',
};

const HINTS: Record<ServicePeriodFormMode, string> = {
  create: 'Registre um período antigo, já encerrado. O período atual nasce na promoção ou no cadastro.',
  edit: 'Corrija a casa e as datas deste período encerrado.',
  open: 'No período em andamento só a data de início pode ser corrigida — o fim é registrado pelo desligamento do servo.',
};

/**
 * Story 216 — registra período antigo ou corrige um existente (só ADMIN).
 * Busca as próprias casas e os períodos do servo (sobreposição).
 */
export function ServicePeriodFormDialog({ open, onClose, staffId, period }: Props) {
  const { data: houses = [] } = useHouses({ enabled: open });
  const { data: periods = [] } = useStaffServicePeriods(staffId, { enabled: open });
  const createMutation = useCreateServicePeriod(staffId);
  const updateMutation = useUpdateServicePeriod(staffId);
  const mutation = period ? updateMutation : createMutation;

  const mode = servicePeriodFormMode(period);
  const schema = useMemo(
    () => makeServicePeriodFormSchema({ mode, period, periods }),
    [mode, period, periods],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServicePeriodFormValues>({
    resolver: zodResolver(schema),
    defaultValues: servicePeriodFormDefaults(period),
  });

  useEffect(() => {
    if (open) reset(servicePeriodFormDefaults(period));
  }, [open, period, reset]);

  const handleClose = () => {
    createMutation.reset();
    updateMutation.reset();
    onClose();
  };

  const onSubmit = (values: ServicePeriodFormValues) => {
    if (!period) {
      createMutation.mutate(toCreateServicePeriodPayload(values), { onSuccess: handleClose });
      return;
    }
    const payload = toUpdateServicePeriodPayload(values, period);
    if (Object.keys(payload).length === 0) return handleClose();
    updateMutation.mutate({ periodId: period.id, payload }, { onSuccess: handleClose });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-xs text-muted-foreground">{HINTS[mode]}</p>

          <ServicePeriodFormFields
            control={control}
            register={register}
            errors={errors}
            houses={houses}
            startOnly={mode === 'open'}
          />

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao salvar o período de serviço.')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
