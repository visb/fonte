import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface StoreroomItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
}

export default function StoreroomScreen() {
  const { staff } = useAuth();

  const { data: items = [], isLoading } = useQuery<StoreroomItem[]>({
    queryKey: ['storeroom-items', staff?.houseId],
    queryFn: () =>
      api.get(`/storerooms/items?houseId=${staff?.houseId}`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const lowStock = items.filter((i) => Number(i.currentQuantity) <= 5);

  return (
    <View className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            lowStock.length > 0 ? (
              <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-sm font-semibold text-orange-700 mb-1">
                  Estoque baixo ({lowStock.length} {lowStock.length === 1 ? 'item' : 'itens'})
                </Text>
                {lowStock.map((i) => (
                  <Text key={i.id} className="text-xs text-orange-600">
                    • {i.name}: {Number(i.currentQuantity)} {i.unit}
                  </Text>
                ))}
              </View>
            ) : null
          }
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhum item cadastrado na dispensa.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                <Ionicons name="cube-outline" size={20} color="#16a34a" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {Number(item.currentQuantity)} {item.unit}
                </Text>
              </View>
              {Number(item.currentQuantity) <= 5 && (
                <View className="bg-orange-50 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-orange-600 font-medium">Baixo</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-green-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push('/(app)/storeroom/movement')}
      >
        <Ionicons name="swap-vertical" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
