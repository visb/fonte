import { Text, View } from 'react-native';

interface Props {
  title: string;
  description: string;
  count: number;
}

/**
 * Cabeçalho de uma seção da fila.
 *
 * A lista fica na `SectionList` da page — e não numa `FlatList` por seção —
 * porque `FlatList` dentro de `ScrollView` é lista virtualizada aninhada, que o
 * React Native desaconselha. O item continua extraído (`SyncItemCard`).
 */
export function SyncSection({ title, description, count }: Props) {
  return (
    <View className="bg-gray-50 pt-4 pb-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </Text>
        <View className="bg-gray-200 rounded-full px-2 py-0.5">
          <Text className="text-xs font-semibold text-gray-700">{count}</Text>
        </View>
      </View>
      <Text className="text-xs text-gray-500 mt-1">{description}</Text>
    </View>
  );
}
