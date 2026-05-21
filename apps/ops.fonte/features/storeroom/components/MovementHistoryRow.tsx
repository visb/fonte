import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MovementType } from '@fonte/types';
import type { StoreroomMovement } from '@fonte/api-client';
import { formatQuantity, formatDateBR, movementLabel } from '../utils';

interface Props {
  movement: StoreroomMovement;
  unit: string;
}

export function MovementHistoryRow({ movement, unit }: Props) {
  const isEntry = movement.type === MovementType.IN;

  return (
    <View className="border border-gray-100 rounded-xl px-4 py-3 bg-white">
      <View className="flex-row items-center">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
            isEntry ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <Ionicons
            name={isEntry ? 'arrow-up' : 'arrow-down'}
            size={16}
            color={isEntry ? '#16a34a' : '#dc2626'}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">
            {movementLabel(movement.type)} de {formatQuantity(movement.quantity)} {unit}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {formatDateBR(movement.date)} • {movement.responsible?.name ?? 'Sem responsável'}
          </Text>
        </View>
      </View>
      {movement.notes ? (
        <Text className="text-xs text-gray-500 mt-2 pl-11">{movement.notes}</Text>
      ) : null}
    </View>
  );
}
