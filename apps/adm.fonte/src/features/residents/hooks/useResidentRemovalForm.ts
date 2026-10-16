import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResidentStatus, todayInSaoPaulo, type ResidentRowAction } from '@fonte/types';
import { useRemoveResident } from './useResidentRemoval';
import { refineAdmissionDates } from '../lib/admissionDates';

/**
 * Story 203: na alta/evasão a saída não pode ser futura nem anterior à entrada
 * do filho (`entryDate`). Sem entrada conhecida, só a regra do futuro vale.
 */
export const makeRemovalSchema = (entryDate?: string | null) =>
  z
    .discriminatedUnion('action', [
      z.object({ action: z.literal('discharge'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
      z.object({ action: z.literal('evade'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
      z.object({ action: z.literal('transfer'), targetHouseId: z.string().min(1, 'Selecione a casa de destino') }),
    ])
    .superRefine((values, ctx) => {
      if (values.action === 'transfer') return;
      // A entrada é a gravada (não julgada aqui): só a saída é informada agora.
      refineAdmissionDates({ entryDate, exitDate: values.exitDate }, ctx, {
        initial: { entryDate, exitDate: null },
      });
    });

type RemovalValues = z.infer<ReturnType<typeof makeRemovalSchema>>;

/** Story 200: o item do menu escolhido decide o ponto de partida do form. */
export const removalDefaults = (mode: ResidentRowAction): RemovalValues =>
  mode === 'transfer'
    ? { action: 'transfer', targetHouseId: '' }
    : { action: 'discharge', exitDate: todayInSaoPaulo() };

export function useResidentRemovalForm(
  resident: { id: string; houseId?: string | null; entryDate?: string | null },
  mode: ResidentRowAction,
  onClose: () => void,
) {
  const mutation = useRemoveResident(resident);
  const schema = useMemo(() => makeRemovalSchema(resident.entryDate), [resident.entryDate]);
  const form = useForm<RemovalValues>({ resolver: zodResolver(schema), defaultValues: removalDefaults(mode) });
  const handleClose = () => {
    form.reset(removalDefaults(mode));
    mutation.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) => {
    const data = values.action === 'transfer'
      ? { houseId: values.targetHouseId }
      : { status: values.action === 'discharge' ? ResidentStatus.DISCHARGED : ResidentStatus.EVADED, exitDate: values.exitDate };
    mutation.mutate(data, { onSuccess: handleClose });
  });
  return { ...form, action: form.watch('action'), isPending: mutation.isPending, handleClose, onSubmit };
}
