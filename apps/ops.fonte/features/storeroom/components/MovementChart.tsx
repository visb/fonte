import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MovementType } from '@fonte/types';
import type { StoreroomMovement } from '@fonte/api-client';
import { toNumber, formatQuantity } from '../utils';

const CHART_HEIGHT = 100;

export function MovementChart({
  movements,
  unit,
}: {
  movements: StoreroomMovement[];
  unit: string;
}) {
  if (movements.length === 0) {
    return (
      <View className="bg-gray-50 rounded-xl px-4 py-6 items-center">
        <Ionicons name="bar-chart-outline" size={24} color="#9ca3af" />
        <Text className="text-sm text-gray-500 mt-2">
          Sem movimentações para este item.
        </Text>
      </View>
    );
  }

  const maxQuantity = Math.max(
    ...movements.map((m) => toNumber(m.quantity)),
    1,
  );

  return (
    <View className="bg-gray-50 rounded-xl px-4 py-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', paddingRight: 4 }}>
          {movements.map((movement, index) => {
            const quantity = toNumber(movement.quantity);
            const barHeight = Math.max(6, (quantity / maxQuantity) * CHART_HEIGHT);
            const isEntry = movement.type === MovementType.IN;

            return (
              <View
                key={movement.id}
                style={{
                  width: 12,
                  height: barHeight,
                  borderRadius: 2,
                  backgroundColor: isEntry ? '#22c55e' : '#ef4444',
                  marginRight: index < movements.length - 1 ? 4 : 0,
                }}
              />
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
          <Text className="text-xs text-gray-500">Entrada</Text>
        </View>
        <Text className="text-xs text-gray-400">
          Máx. {formatQuantity(maxQuantity)} {unit}
        </Text>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
          <Text className="text-xs text-gray-500">Saída</Text>
        </View>
      </View>
    </View>
  );
}
