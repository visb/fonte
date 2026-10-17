import { Controller, useWatch, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { isFutureDate, maxBirthDateFor, todayInSaoPaulo } from '@fonte/types';
import { DateInput } from '@/components/shared/DateInput';
import type { AddResidentFormValues } from '../lib/addResidentSchema';
import { AddResidentField } from './AddResidentField';

interface Props {
  control: Control<AddResidentFormValues>;
  errors: FieldErrors<AddResidentFormValues>;
  setValue: UseFormSetValue<AddResidentFormValues>;
}

/**
 * Acolhimento e nascimento digitáveis (story 209). O calendário fica como
 * alternativa e só oferece datas que o schema aceitaria: acolhimento até hoje,
 * nascimento até 18 anos antes do acolhimento.
 */
export function AddResidentDateFields({ control, errors, setValue }: Props) {
  const today = todayInSaoPaulo();
  const entryDate = useWatch({ control, name: 'entryDate' });
  const birthRef = entryDate && !isFutureDate(entryDate, today) ? entryDate : today;

  return (
    <>
      <AddResidentField label="Data de acolhimento *">
        <Controller
          control={control}
          name="entryDate"
          render={({ field: { value, onChange, onBlur } }) => (
            <DateInput
              accessibilityLabel="Data de acolhimento"
              value={value ?? ''}
              onChange={onChange}
              onBlur={onBlur}
              onInvalidChange={(invalid) => setValue('entryDateInvalid', invalid)}
              maxDate={today}
              error={errors.entryDate?.message}
            />
          )}
        />
      </AddResidentField>

      <AddResidentField label="Data de nascimento">
        <Controller
          control={control}
          name="birthDate"
          render={({ field: { value, onChange, onBlur } }) => (
            <DateInput
              accessibilityLabel="Data de nascimento"
              value={value ?? ''}
              onChange={onChange}
              onBlur={onBlur}
              onInvalidChange={(invalid) => setValue('birthDateInvalid', invalid)}
              maxDate={maxBirthDateFor(birthRef)}
              error={errors.birthDate?.message}
            />
          )}
        />
      </AddResidentField>
    </>
  );
}
