import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Admission } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useCreateAdmission, useResidentAdmissions, useUpdateAdmission } from '../hooks/useResidents';
import {
  admissionFormDefaults,
  makeAdmissionFormSchema,
  toCreateAdmissionPayload,
  toUpdateAdmissionPayload,
  type AdmissionFormMode,
  type AdmissionFormValues,
} from '../lib/admissionForm';
import { AdmissionFormFields } from './AdmissionFormFields';

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
  /** Ausente = criar passagem antiga; presente = editar esta passagem. */
  admission?: Admission | null;
}

const TITLES: Record<AdmissionFormMode, string> = {
  create: 'Adicionar acolhimento',
  edit: 'Editar acolhimento',
  current: 'Editar acolhimento atual',
};

/**
 * Story 215 — cria passagem antiga ou corrige uma existente (só ADMIN). No
 * acolhimento atual só a entrada muda; casa, saída e status seguem pela ficha
 * (transferência, alta, readmissão). Busca as próprias casas e passagens.
 */
export function AdmissionFormDialog({ open, onClose, residentId, admission }: Props) {
  const { data: houses = [] } = useHouses({ enabled: open });
  const { data: admissions = [] } = useResidentAdmissions(residentId, { enabled: open });
  const createMutation = useCreateAdmission(residentId);
  const updateMutation = useUpdateAdmission(residentId);
  const mutation = admission ? updateMutation : createMutation;

  const mode: AdmissionFormMode = !admission
    ? 'create'
    : admissions[0]?.id === admission.id
      ? 'current'
      : 'edit';
  const schema = useMemo(
    () => makeAdmissionFormSchema({ mode, admission, admissions }),
    [mode, admission, admissions],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: admissionFormDefaults(admission),
  });

  useEffect(() => {
    if (open) reset(admissionFormDefaults(admission));
  }, [open, admission, reset]);

  const handleClose = () => {
    createMutation.reset();
    updateMutation.reset();
    onClose();
  };

  const onSubmit = (values: AdmissionFormValues) => {
    if (!admission) {
      createMutation.mutate(toCreateAdmissionPayload(values), { onSuccess: handleClose });
      return;
    }
    const payload = toUpdateAdmissionPayload(values, admission, mode);
    if (Object.keys(payload).length === 0) return handleClose();
    updateMutation.mutate({ admissionId: admission.id, payload }, { onSuccess: handleClose });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {mode === 'current' && (
            <p className="text-xs text-muted-foreground">
              No acolhimento atual só a data de entrada pode ser corrigida — casa, saída e status
              mudam por transferência, alta ou readmissão. O carnê não é recalculado.
            </p>
          )}
          {mode === 'create' && (
            <p className="text-xs text-muted-foreground">
              Registre uma passagem antiga, já encerrada. Novo acolhimento é pela readmissão.
            </p>
          )}

          <AdmissionFormFields
            control={control}
            register={register}
            errors={errors}
            houses={houses}
            entryOnly={mode === 'current'}
          />

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao salvar o acolhimento.')}
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
