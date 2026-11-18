import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { ADMISSION_EXIT_STATUSES, todayInSaoPaulo } from '@fonte/types';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import { RESIDENT_STATUS_LABELS } from '../constants';
import type { AdmissionFormValues, AdmissionEditableFields } from '../lib/admissionForm';

interface Props {
  control: Control<AdmissionFormValues>;
  register: UseFormRegister<AdmissionFormValues>;
  errors: FieldErrors<AdmissionFormValues>;
  houses: ReadonlyArray<{ id: string; name: string }>;
  /**
   * `all` = casa, datas e status; `dates` = acolhimento atual já encerrado
   * (entrada e saída); `entry` = acolhimento atual em aberto (só a entrada).
   */
  editable: AdmissionEditableFields;
}

/** Campos do `AdmissionFormDialog`: casa, entrada, saída e status de saída. */
export function AdmissionFormFields({ control, register, errors, houses, editable }: Props) {
  const today = todayInSaoPaulo();
  const all = editable === 'all';
  return (
    <>
      {all && (
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

      {editable !== 'entry' && (
        <FormField label="Saída *" error={errors.exitDate?.message}>
          <ControlledDateInput control={control} name="exitDate" id="admission-exit-date" max={today} />
        </FormField>
      )}

      {all && (
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
      )}
    </>
  );
}
