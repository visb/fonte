import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useStreetSales } from '@/features/street-sales/hooks/useStreetSales';
import { EditStreetSalePage } from '@/features/street-sales/pages/EditStreetSalePage';

export default function EditStreetSaleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuth();
  const { data: sales, isLoading } = useStreetSales(staff?.houseId ?? undefined);

  const sale = sales?.find((s) => s.id === id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#272950" />
      </View>
    );
  }

  if (!sale) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-sm text-gray-500 text-center">Registro não encontrado.</Text>
      </View>
    );
  }

  return <EditStreetSalePage sale={sale} />;
}
