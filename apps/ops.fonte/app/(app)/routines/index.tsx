import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

function fmt(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function RoutinesScreen() {
  const { staff } = useAuth();

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ['routines', staff?.houseId],
    queryFn: () =>
      api.get(`/routines?houseId=${staff?.houseId}`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  return (
    <View className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item: { id: string }) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 text-sm py-8">
              Nenhuma entrada de rotina registrada.
            </Text>
          }
          renderItem={({ item }: { item: { id: string; date: string; description: string; responsible: { name: string }; resident: { name: string } | null } }) => (
            <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-gray-500">{fmt(item.date)}</Text>
                {item.date === today && (
                  <View className="bg-blue-50 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-blue-600 font-medium">Hoje</Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-gray-800 mb-1.5" numberOfLines={3}>{item.description}</Text>
              <Text className="text-xs text-gray-400">por {item.responsible?.name}</Text>
              {item.resident && (
                <Text className="text-xs text-blue-600 mt-0.5">Filho: {item.resident.name}</Text>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push('/(app)/routines/new')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
