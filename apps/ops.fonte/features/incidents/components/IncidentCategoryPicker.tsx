import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INCIDENT_CATEGORIES_BY_TYPE } from '@fonte/types';
import type { IncidentCategory, IncidentType } from '@fonte/types';
import { INCIDENT_CATEGORY_LABELS } from '../constants';
import { IncidentCategoryOptionsModal } from './IncidentCategoryOptionsModal';

export const INCIDENT_CATEGORY_NEEDS_TYPE_HINT = 'Escolha positiva ou negativa primeiro';
export const INCIDENT_CATEGORY_PLACEHOLDER = 'Selecione a categoria';

type Props = {
  /** Tipo escolhido no form; sem tipo o picker fica desabilitado. */
  type: IncidentType | undefined;
  /** `null`/`undefined` = nenhuma escolhida (o form limpa com `null` ao trocar o tipo). */
  value: IncidentCategory | null | undefined;
  onChange: (category: IncidentCategory) => void;
  error?: string;
};

/**
 * Select da categoria (story 230): a lista vem de `INCIDENT_CATEGORIES_BY_TYPE`
 * (mesma fonte da validação do backend), com "Outros" sempre por último.
 */
export function IncidentCategoryPicker({ type, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const disabled = !type;
  const options = type ? INCIDENT_CATEGORIES_BY_TYPE[type] : [];
  const label = disabled
    ? INCIDENT_CATEGORY_NEEDS_TYPE_HINT
    : value
      ? INCIDENT_CATEGORY_LABELS[value]
      : INCIDENT_CATEGORY_PLACEHOLDER;

  return (
    <View>
      <Pressable
        testID="incident-category-trigger"
        accessibilityRole="button"
        accessibilityLabel="Categoria"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`flex-row items-center border rounded-lg px-4 py-3 ${
          disabled ? 'bg-gray-100' : 'bg-gray-50'
        } ${error ? 'border-red-500' : 'border-gray-300'}`}
      >
        <Text
          className={`flex-1 text-sm ${value && !disabled ? 'text-gray-900' : 'text-gray-400'}`}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </Pressable>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
      <IncidentCategoryOptionsModal
        visible={open && !disabled}
        options={options}
        value={value}
        onSelect={(category) => {
          onChange(category);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
