import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityStaffRef } from '@fonte/types';
import { getInitials } from '../lib/initials';

interface Props {
  responsible: ActivityStaffRef | null | undefined;
}

/**
 * Mostra o responsável de uma atividade com avatar de iniciais + nome.
 * Sem responsável → ícone "person" esmaecido + rótulo "Sem responsável",
 * reforçando rascunhos/solicitações ainda sem dono.
 */
export function ResponsibleBadge({ responsible }: Props) {
  if (!responsible) {
    return (
      <View className="flex-row items-center gap-1.5" accessibilityLabel="Sem responsável">
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="person-outline" size={12} color="#9ca3af" />
        </View>
        <Text className="text-xs text-gray-400">Sem responsável</Text>
      </View>
    );
  }

  const initials = getInitials(responsible.name);

  return (
    <View
      className="flex-row items-center gap-1.5"
      accessibilityLabel={`Responsável: ${responsible.name}`}
    >
      <View className="h-5 w-5 items-center justify-center rounded-full bg-blue-100">
        {initials ? (
          <Text className="text-[9px] font-semibold uppercase text-blue-700">{initials}</Text>
        ) : (
          <Ionicons name="person" size={12} color="#1d4ed8" />
        )}
      </View>
      <Text className="text-xs text-gray-600">{responsible.name}</Text>
    </View>
  );
}
