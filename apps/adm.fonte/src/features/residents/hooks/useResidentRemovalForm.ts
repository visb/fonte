import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResidentStatus, type ResidentRowAction } from '@fonte/types';
import { useRemoveResident } from './useResidentRemoval';

const removalSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('discharge'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
  z.object({ action: z.literal('evade'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
  z.object({ action: z.literal('transfer'), targetHouseId: z.string().min(1, 'Selecione a casa de destino') }),
]);

type RemovalValues = z.infer<typeof removalSchema>;

/** Story 200: o item do menu escolhido decide o ponto de partida do form. */
export const removalDefaults = (mode: ResidentRowAction): RemovalValues =>
  mode === 'transfer'
    ? { action: 'transfer', targetHouseId: '' }
    : { action: 'discharge', exitDate: new Date().toISOString().split('T')[0] };

export function useResidentRemovalForm(
  resident: { id: string; houseId?: string | null },
  mode: ResidentRowAction,
  onClose: () => void,
) {
  const mutation = useRemoveResident(resident);
  const form = useForm<RemovalValues>({ resolver: zodResolver(removalSchema), defaultValues: removalDefaults(mode) });
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
