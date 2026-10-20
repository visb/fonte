import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { todayInSaoPaulo } from '@fonte/types';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import type { ServicePeriodFormValues } from '../lib/servicePeriodForm';

interface Props {
  control: Control<ServicePeriodFormValues>;
  register: UseFormRegister<ServicePeriodFormValues>;
  errors: FieldErrors<ServicePeriodFormValues>;
  houses: ReadonlyArray<{ id: string; name: string }>;
  /** Período em andamento: só o início (story 216, decisão 4). */
  startOnly: boolean;
}

/** Campos do `ServicePeriodFormDialog`: casa, início e fim. */
export function ServicePeriodFormFields({ control, register, errors, houses, startOnly }: Props) {
  const today = todayInSaoPaulo();
  return (
    <>
      {!startOnly && (
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
      )}

      <FormField label="Início *" error={errors.startDate?.message}>
        <ControlledDateInput control={control} name="startDate" id="service-period-start-date" max={today} />
      </FormField>

      {!startOnly && (
        <FormField label="Fim *" error={errors.endDate?.message}>
          <ControlledDateInput control={control} name="endDate" id="service-period-end-date" max={today} />
        </FormField>
      )}
    </>
  );
}
