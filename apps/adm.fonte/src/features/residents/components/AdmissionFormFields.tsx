import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { ADMISSION_EXIT_STATUSES, todayInSaoPaulo } from '@fonte/types';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import { RESIDENT_STATUS_LABELS } from '../constants';
import type { AdmissionFormValues } from '../lib/admissionForm';

interface Props {
  control: Control<AdmissionFormValues>;
  register: UseFormRegister<AdmissionFormValues>;
  errors: FieldErrors<AdmissionFormValues>;
  houses: ReadonlyArray<{ id: string; name: string }>;
  /** Acolhimento atual: só a entrada (story 215, decisão 5). */
  entryOnly: boolean;
}

/** Campos do `AdmissionFormDialog`: casa, entrada, saída e status de saída. */
export function AdmissionFormFields({ control, register, errors, houses, entryOnly }: Props) {
  const today = todayInSaoPaulo();
  return (
    <>
      {!entryOnly && (
        <FormField label="Casa" error={errors.houseId?.message}>
          <Select aria-label="Casa" {...register('houseId')}>
            <option value="">Sem casa (só arquivado)</option>
            {houses.map((house) => (
              <option key={house.id} value={house.id}>
                {house.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Entrada *" error={errors.entryDate?.message}>
        <ControlledDateInput control={control} name="entryDate" id="admission-entry-date" max={today} />
      </FormField>

      {!entryOnly && (
        <>
          <FormField label="Saída *" error={errors.exitDate?.message}>
            <ControlledDateInput control={control} name="exitDate" id="admission-exit-date" max={today} />
          </FormField>

          <FormField label="Status *" error={errors.status?.message}>
            <Select aria-label="Status" {...register('status')}>
              <option value="">Selecione</option>
              {ADMISSION_EXIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {RESIDENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      )}
    </>
  );
}
