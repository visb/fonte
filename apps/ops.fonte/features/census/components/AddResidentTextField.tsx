import { TextInput, type KeyboardTypeOptions } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import type { AddResidentFormValues } from '../lib/addResidentSchema';
import { AddResidentField } from './AddResidentField';

type TextFieldName = 'name' | 'cpf' | 'rg' | 'nationality';

interface Props {
  control: Control<AddResidentFormValues>;
  name: TextFieldName;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  /** Máscara aplicada na digitação (ex.: CPF, story 219). */
  mask?: (value: string) => string;
}

/** Campo de texto livre do formulário "Adicionar filho". */
export function AddResidentTextField({ control, name, label, placeholder, keyboardType, error, mask }: Props) {
  return (
    <AddResidentField label={label} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
            placeholder={placeholder}
            keyboardType={keyboardType}
            value={value}
            onChangeText={(text) => onChange(mask ? mask(text) : text)}
            onBlur={onBlur}
          />
        )}
      />
    </AddResidentField>
  );
}
