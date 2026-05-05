import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardScreen() {
  const { staff } = useAuth();

  const { data: routines = [] } = useQuery({
    queryKey: ['routines', 'today', staff?.houseId],
    queryFn: () =>
      api.get(`/routines?houseId=${staff?.houseId}&date=${today}`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const { data: residents = [] } = useQuery({
    queryKey: ['residents-count', staff?.houseId],
    queryFn: () =>
      api.get(`/houses/${staff?.houseId}/residents`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const actions = [
    {
      label: 'Nova rotina',
      icon: 'clipboard-outline' as const,
      color: '#2563eb',
      bg: '#eff6ff',
      route: '/(app)/routines/new',
    },
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
          <View className="flex-1 bg-white rounded-xl border border-gray-100 p-4">
            <Text className="text-3xl font-bold text-gray-900">{routines.length}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Rotinas hoje</Text>
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

        {routines.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">
              Rotinas de hoje — {formatDate(today)}
            </Text>
            <View className="space-y-2">
              {routines.slice(0, 5).map((r: { id: string; responsible: { name: string }; description: string }) => (
                <View key={r.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <Text className="text-xs text-gray-500 mb-0.5">{r.responsible?.name}</Text>
                  <Text className="text-sm text-gray-800" numberOfLines={2}>
                    {r.description}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
