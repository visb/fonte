import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { DateInput } from './DateInput';

interface ControlledDateInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  min?: string;
  max?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Efeito extra depois de gravar o valor no form (ex.: recalcular outro campo). */
  onValueChange?: (value: string) => void;
}

/**
 * `DateInput` ligado ao react-hook-form via `Controller` (story 201). O valor no
 * form continua `YYYY-MM-DD`; `register` não serve porque o campo não emite
 * evento de `<input>` nativo com o ISO.
 */
export function ControlledDateInput<T extends FieldValues>({
  control,
  name,
  onValueChange,
  ...props
}: ControlledDateInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DateInput
          {...props}
          ref={field.ref}
          name={field.name}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={(v) => {
            field.onChange(v);
            onValueChange?.(v);
          }}
          onBlur={field.onBlur}
          aria-invalid={fieldState.invalid || undefined}
        />
      )}
    />
  );
}
