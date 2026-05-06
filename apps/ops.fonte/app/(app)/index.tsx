import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function DashboardScreen() {
  const { staff } = useAuth();

  const { data: residents = [] } = useQuery({
    queryKey: ['residents-count', staff?.houseId],
    queryFn: () => api.residents.listByHouse(staff!.houseId),
    enabled: !!staff?.houseId,
  });

  const actions = [
    {
      label: 'Nova ocorrência',
      icon: 'warning-outline' as const,
      color: '#dc2626',
      bg: '#fef2f2',
      route: '/(app)/incidents/new',
    },
    {
      label: 'Movimentar dispensa',
      icon: 'cube-outline' as const,
      color: '#16a34a',
      bg: '#f0fdf4',
      route: '/(app)/storeroom/movement',
    },
    {
      label: 'Ver filhos',
      icon: 'people-outline' as const,
      color: '#9333ea',
      bg: '#faf5ff',
      route: '/(app)/residents',
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <Text className="text-gray-500 text-sm">Bem-vindo,</Text>
        <Text className="text-2xl font-bold text-gray-900">{staff?.name ?? '—'}</Text>
        {staff?.house && (
          <Text className="text-sm text-blue-600 mt-0.5">{staff.house.name}</Text>
        )}
      </View>

      <View className="px-4 py-4">
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white rounded-xl border border-gray-100 p-4">
            <Text className="text-3xl font-bold text-gray-900">{residents.length}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Filhos na casa</Text>
          </View>
        </View>

        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Ações rápidas
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={() => router.push(a.route as never)}
              className="w-[47%] bg-white rounded-xl border border-gray-100 p-4 items-center"
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: a.bg }}
              >
                <Ionicons name={a.icon} size={24} color={a.color} />
              </View>
              <Text className="text-sm font-medium text-gray-700 text-center">{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
