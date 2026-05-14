import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { House } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { houseSchema, sanitizeHouseData, type HouseFormData } from '../constants';
import { HouseFormFields } from './HouseFormFields';
import { useCreateHouse, useUpdateHouse } from '../hooks/useHouses';
import { useStaff } from '@/features/staff/hooks/useStaff';

interface Props {
  open: boolean;
  house: House | null;
  onClose: () => void;
}

const emptyForm: HouseFormData = {
  name: '', generalCapacity: undefined, staffCapacity: undefined,
  address: '', city: '', state: '', coordinatorId: '', phone: '',
};

export function HouseDialog({ open, house, onClose }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const { data: staffList = [] } = useStaff({ enabled: open });
  const createMutation = useCreateHouse();
  const updateMutation = useUpdateHouse(house?.id ?? '');

  useEffect(() => {
    if (open) {
      reset(house ? {
        name: house.name,
        generalCapacity: house.generalCapacity ?? undefined,
        staffCapacity: house.staffCapacity ?? undefined,
        address: house.address ?? '',
        city: house.city ?? '',
        state: house.state ?? '',
        coordinatorId: house.coordinatorId ?? '',
        phone: house.phone ?? '',
      } : emptyForm);
    }
  }, [open, house, reset]);

  const onSubmit = (data: HouseFormData) => {
    const payload = sanitizeHouseData(data);
    if (house) {
      updateMutation.mutate(payload, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{house ? 'Editar Casa' : 'Nova Casa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <HouseFormFields register={register} errors={errors} staffList={staffList} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {house ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
