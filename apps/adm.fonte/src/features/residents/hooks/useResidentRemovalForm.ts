import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResidentStatus } from '@fonte/types';
import { useRemoveResident } from './useResidentRemoval';

const removalSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('discharge'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
  z.object({ action: z.literal('evade'), exitDate: z.string().min(1, 'Informe a data do acontecimento') }),
  z.object({ action: z.literal('transfer'), targetHouseId: z.string().min(1, 'Selecione a casa de destino') }),
]);

type RemovalValues = z.infer<typeof removalSchema>;
const removalDefaults = (): RemovalValues => ({ action: 'discharge', exitDate: new Date().toISOString().split('T')[0] });

export function useResidentRemovalForm(resident: { id: string; houseId?: string | null }, onClose: () => void) {
  const mutation = useRemoveResident(resident);
  const form = useForm<RemovalValues>({ resolver: zodResolver(removalSchema), defaultValues: removalDefaults() });
  const handleClose = () => {
    form.reset(removalDefaults());
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
