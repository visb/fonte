import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { StreetSale } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { SuccessBanner } from '@/components/shared/SuccessBanner';
import { useStreetSales } from '../hooks/useStreetSales';
import { StreetSaleRow } from '../components/StreetSaleRow';

export function StreetSalesPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId ?? undefined;
  const { data: sales = [], isLoading, error } = useStreetSales(houseId);
  const { successMsg } = useLocalSearchParams<{ successMsg?: string }>();

  return (
    <View className="flex-1 bg-gray-50">
      {successMsg ? (
        <SuccessBanner
          message={successMsg}
          onDismiss={() => router.setParams({ successMsg: '' })}
        />
      ) : null}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#272950" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-red-500 text-center">Erro ao carregar registros.</Text>
        </View>
      ) : (
        <FlatList<StreetSale>
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="storefront-outline" size={40} color="#d1d5db" />
              <Text className="text-sm text-gray-400 mt-3">Nenhum registro ainda.</Text>
              <Text className="text-xs text-gray-400 mt-1">
                Toque em "+" para registrar o faturamento do dia.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <StreetSaleRow sale={item} houseId={houseId ?? ''} />
          )}
        />
      )}

      <TouchableOpacity
        onPress={() => router.push('/(app)/street-sales/new' as never)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-900 items-center justify-center shadow-lg"
        style={{ elevation: 4 }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
