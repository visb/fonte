import { useController } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { View, Text } from 'react-native';
import type { IncidentType } from '@fonte/types';
import type { IncidentFormData as FormData } from '../schema';
import { IncidentTypeSelector } from './IncidentTypeSelector';
import { IncidentCategoryPicker } from './IncidentCategoryPicker';

interface Props {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
}

/**
 * Tipo (story 229) + categoria (story 230). A lista de categorias depende do
 * tipo, então trocar o tipo limpa a categoria escolhida.
 */
export function IncidentClassificationFields({ control, errors }: Props) {
  const { field: typeField } = useController({ control, name: 'type' });
  const { field: categoryField } = useController({ control, name: 'category' });

  // `null` (não `undefined`): o RHF trata valor `undefined` como "volta ao
  // default", o que reexibiria uma categoria inicial do outro tipo. O zod
  // rejeita `null` com "Escolha a categoria".
  const changeType = (type: IncidentType) => {
    if (type !== typeField.value) categoryField.onChange(null);
    typeField.onChange(type);
  };

  return (
    <>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Tipo <Text className="text-red-500">*</Text>
        </Text>
        <IncidentTypeSelector
          value={typeField.value}
          onChange={changeType}
          error={errors.type?.message}
        />
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          Categoria <Text className="text-red-500">*</Text>
        </Text>
        <IncidentCategoryPicker
          type={typeField.value}
          value={categoryField.value}
          onChange={categoryField.onChange}
          error={errors.category?.message}
        />
      </View>
    </>
  );
}
