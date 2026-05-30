import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StreetSaleType } from '@fonte/types';
import type { StreetSale } from '@fonte/api-client';
import { useDeleteStreetSale } from '../hooks/useStreetSales';

const EDIT_WINDOW_MS = 60 * 60 * 1000;

function formatBRL(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isWithinWindow(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

interface Props {
  sale: StreetSale;
  houseId: string;
}

export function StreetSaleRow({ sale, houseId }: Props) {
  const deleteMutation = useDeleteStreetSale(houseId);
  const editable = isWithinWindow(sale.createdAt);
  const isBread = sale.type === StreetSaleType.BREAD;

  const handleDelete = () => {
    Alert.alert(
      'Remover registro',
      'Tem certeza que deseja remover este registro de faturamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(sale.id, {
              onError: () => Alert.alert('Erro', 'Não foi possível remover o registro.'),
            }),
        },
      ],
    );
  };

  return (
    <View className="bg-white border border-gray-100 rounded-xl px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: isBread ? '#fffbeb' : '#fdf2f8' }}
          >
            <Ionicons
              name="storefront-outline"
              size={18}
              color={isBread ? '#b45309' : '#a21caf'}
            />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: isBread ? '#fef3c7' : '#fae8ff' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: isBread ? '#92400e' : '#86198f' }}
                >
                  {isBread ? 'Pão' : 'Pizza'}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">{formatDate(sale.date)}</Text>
            </View>
            <View className="flex-row items-center gap-3 mt-1">
              <Text className="text-xs text-gray-500">{sale.quantity} un.</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {formatBRL(sale.totalAmount)}
              </Text>
            </View>
          </View>
        </View>

        {editable && (
          <View className="flex-row items-center gap-1 ml-2">
            <TouchableOpacity
              onPress={() => router.push(`/(app)/street-sales/${sale.id}` as never)}
              className="w-8 h-8 items-center justify-center rounded-lg bg-indigo-50"
            >
              <Ionicons name="pencil-outline" size={16} color="#4f46e5" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-8 h-8 items-center justify-center rounded-lg bg-red-50"
            >
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View className="flex-row gap-4 mt-2 pl-12">
        <Text className="text-xs text-gray-400">PIX {formatBRL(sale.amountPix)}</Text>
        <Text className="text-xs text-gray-400">Din. {formatBRL(sale.amountCash)}</Text>
        <Text className="text-xs text-gray-400">Cart. {formatBRL(sale.amountCard)}</Text>
      </View>
    </View>
  );
}
