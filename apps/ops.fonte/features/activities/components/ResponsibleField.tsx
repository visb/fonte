import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import { ResponsibleBadge } from './ResponsibleBadge';
import { SelectResponsibleModal } from './SelectResponsibleModal';

interface Props {
  /** `responsibleStaffId` do formulário (`Controller`). */
  value: string | null | undefined;
  onChange: (staffId: string | null) => void;
  /** Casa onde a atividade vai nascer: a lista vem do cache offline dela. */
  houseId: string | null | undefined;
  /** Em A fazer o responsável é obrigatório: sem "limpar" (story 224). */
  required?: boolean;
  error?: string;
}

/**
 * Campo "Responsável" da criação (story 224): mostra o escolhido, abre o
 * `SelectResponsibleModal` no modo "escolher" e permite limpar — exceto quando
 * obrigatório. Aberto/fechado do modal é estado de UI, não campo do form.
 */
export function ResponsibleField({ value, onChange, houseId, required, error }: Props) {
  const [open, setOpen] = useState(false);
  const { data: staff } = useHouseStaff(houseId);
  const selected = value ? (staff?.find((s) => s.id === value) ?? null) : null;

  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        Responsável {required && <Text className="text-red-500">*</Text>}
      </Text>
      <View className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 flex-row items-center">
        <View className="flex-1">
          <ResponsibleBadge
            responsible={selected ? { id: selected.id, name: selected.name, userId: '' } : null}
          />
        </View>
        {value && !required && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Limpar responsável"
            onPress={() => onChange(null)}
            className="px-2 py-1 mr-1"
          >
            <Text className="text-xs text-gray-500">Limpar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={value ? 'Trocar responsável' : 'Escolher responsável'}
          onPress={() => setOpen(true)}
          className="px-2 py-1"
        >
          <Text className="text-xs font-semibold text-indigo-600">
            {value ? 'Trocar' : 'Escolher'}
          </Text>
        </TouchableOpacity>
      </View>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}

      <SelectResponsibleModal
        pick={
          open
            ? { houseId, currentId: value ?? null, onSelect: (person) => onChange(person.id) }
            : null
        }
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
