import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { House } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { houseSchema, sanitizeHouseData, type HouseFormData } from '../constants';
import { HouseFormFields } from './HouseFormFields';
import { useCreateHouse, useHouseById, useUpdateHouse } from '../hooks/useHouses';

interface Props {
  open: boolean;
  house: House | null;
  onClose: () => void;
}

const emptyForm: HouseFormData = {
  name: '', generalCapacity: undefined, staffCapacity: undefined,
  address: '', city: '', state: '', coordinatorId: '', phone: '', isMotherHouse: false,
};

export function HouseDialog({ open, house, onClose }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dialog autossuficiente: a lista de titulares elegíveis é a dos coordenadores
  // DESTA casa (story 194), que vem do próprio detalhe — sem consumir o staff
  // inteiro da organização.
  const { data: detail } = useHouseById(house?.id ?? '', { enabled: open && !!house });
  const coordinators = detail?.coordinators ?? house?.coordinators ?? [];

  const createMutation = useCreateHouse();
  const updateMutation = useUpdateHouse(house?.id ?? '');

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      reset(house ? {
        name: house.name,
        generalCapacity: house.generalCapacity ?? undefined,
        staffCapacity: house.staffCapacity ?? undefined,
        address: house.address ?? '',
        city: house.city ?? '',
        state: house.state ?? '',
        coordinatorId: house.coordinatorId ?? '',
        phone: house.phone ?? '',
        isMotherHouse: house.isMotherHouse ?? false,
      } : emptyForm);
    }
    // `coordinators` não é usado aqui; mantê-lo nas deps causava loop de render
    // quando a ref do array muda a cada render (default `[]` / data instável).
  }, [open, house, reset]);

  const onSubmit = (data: HouseFormData) => {
    const payload = sanitizeHouseData(data);
    const options = {
      onSuccess: () => onClose(),
      // Os 400 da story 194 (titular inelegível / titular na criação) chegam com
      // a frase do backend — nunca o erro cru do axios.
      onError: (error: unknown) => setSubmitError(getErrorMessage(error, 'Erro ao salvar a casa.')),
    };
    if (house) {
      updateMutation.mutate(payload, options);
    } else {
      createMutation.mutate(payload, options);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{house ? 'Editar Casa' : 'Nova Casa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <HouseFormFields
            register={register}
            errors={errors}
            coordinators={coordinators}
            isEdit={!!house}
          />
          {submitError && <p className="text-sm text-destructive pb-2">{submitError}</p>}
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
