import { Text, TouchableOpacity, View } from 'react-native';
import type { ActivityStatus } from '@fonte/types';
import { CREATE_STATUS_LABELS } from '@/features/activities/constants';

interface Props {
  /** Status oferecidos (`creatableStatuses(viewer)`): nunca Fazendo/Impedimento/Concluídas. */
  options: ActivityStatus[];
  value: ActivityStatus;
  onChange: (status: ActivityStatus) => void;
}

/**
 * Seletor da coluna onde a atividade nasce (story 224): Rascunho | Solicitação |
 * A fazer. Só o coordenador da casa vê; o servo cria sempre rascunho.
 */
export function ActivityStatusPicker({ options, value, onChange }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">Coluna</Text>
      <View className="flex-row rounded-lg border border-gray-300 overflow-hidden">
        {options.map((status) => {
          const selected = status === value;
          return (
            <TouchableOpacity
              key={status}
              accessibilityRole="button"
              accessibilityLabel={`Criar em ${CREATE_STATUS_LABELS[status]}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(status)}
              className={`flex-1 py-2.5 items-center ${selected ? 'bg-indigo-600' : 'bg-gray-50'}`}
            >
              <Text
                className={`text-sm font-medium ${selected ? 'text-white' : 'text-gray-700'}`}
              >
                {CREATE_STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
