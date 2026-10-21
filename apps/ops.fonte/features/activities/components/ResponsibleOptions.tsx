import { Text, TouchableOpacity, View } from 'react-native';

interface Person {
  id: string;
  name: string;
}

interface Props {
  staff: Person[];
  /** Responsável atual (marcado na lista). */
  currentId: string | null;
  onSelect: (staffId: string) => void;
  disabled?: boolean;
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${selected ? 'border-indigo-500' : 'border-gray-300'}`}
    >
      {selected && <View className="w-2 h-2 rounded-full bg-indigo-500" />}
    </View>
  );
}

/**
 * Servos da casa para escolher o responsável (story 220). Não há opção "sem
 * responsável": no bloco de trabalho ele é obrigatório (decisão 6).
 */
export function ResponsibleOptions({ staff, currentId, onSelect, disabled }: Props) {
  return (
    <View className="border border-gray-200 rounded-xl overflow-hidden">
      {staff.map((person) => {
        const selected = person.id === currentId;
        return (
          <TouchableOpacity
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Responsável ${person.name}`}
            accessibilityState={{ selected, disabled: !!disabled }}
            className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selected ? 'bg-indigo-50' : 'bg-white'}`}
            disabled={disabled}
            onPress={() => onSelect(person.id)}
          >
            <Radio selected={selected} />
            <Text className="flex-1 text-sm text-gray-900">{person.name}</Text>
            {selected && <Text className="text-xs text-indigo-600">Atual</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
