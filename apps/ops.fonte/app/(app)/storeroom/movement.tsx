import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MovementType } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

interface StoreroomItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
}

export default function MovementScreen() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const [itemId, setItemId] = useState('');
  const [type, setType] = useState<MovementType>(MovementType.OUT);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today);

  const { data: items = [] } = useQuery<StoreroomItem[]>({
    queryKey: ['storeroom-items', staff?.houseId],
    queryFn: () =>
      api.get(`/storerooms/items?houseId=${staff?.houseId}`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const selectedItem = items.find((i) => i.id === itemId);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/storerooms/movements', {
        itemId,
        type,
        quantity: parseFloat(quantity),
        responsibleId: staff!.id,
        date,
        notes: notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeroom-items'] });
      queryClient.invalidateQueries({ queryKey: ['storeroom-movements'] });
      Alert.alert('Sucesso', 'Movimentação registrada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Erro', msg ?? 'Não foi possível registrar a movimentação.');
    },
  });

  function handleSubmit() {
    if (!itemId) { Alert.alert('Atenção', 'Selecione um item.'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { Alert.alert('Atenção', 'Informe a quantidade.'); return; }
    mutation.mutate();
  }

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
          <View className="flex-row gap-3">
            {([MovementType.IN, MovementType.OUT] as const).map((t) => (
              <TouchableOpacity
                key={t}
                className={`flex-1 py-3 rounded-lg border items-center ${
                  type === t
                    ? t === MovementType.IN
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                    : 'border-gray-200 bg-gray-50'
                }`}
                onPress={() => setType(t)}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: type === t ? (t === MovementType.IN ? '#16a34a' : '#dc2626') : '#6b7280',
                  }}
                >
                  {t === MovementType.IN ? '↑ Entrada' : '↓ Saída'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Item</Text>
          <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <TouchableOpacity className="px-4 py-3" onPress={() => setItemId('')}>
              <Text className={`text-sm ${itemId ? 'text-gray-900' : 'text-gray-400'}`}>
                {selectedItem ? `${selectedItem.name} (${Number(selectedItem.currentQuantity)} ${selectedItem.unit})` : 'Selecione um item'}
              </Text>
            </TouchableOpacity>
            {items.map((i) => (
              <TouchableOpacity
                key={i.id}
                className={`px-4 py-2.5 border-t border-gray-200 ${itemId === i.id ? 'bg-blue-50' : ''}`}
                onPress={() => setItemId(i.id)}
              >
                <Text className={`text-sm ${itemId === i.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                  {i.name} — {Number(i.currentQuantity)} {i.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Quantidade ({selectedItem?.unit ?? 'unid.'}) <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            placeholder="0"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Observações (opcional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            placeholder="Ex: compra do mercado, uso na cozinha..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{staff?.name}</Text>
        </View>

        <TouchableOpacity
          className={`rounded-lg py-3.5 items-center mt-2 ${type === MovementType.IN ? 'bg-green-600' : 'bg-red-600'}`}
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Registrar {type === MovementType.IN ? 'entrada' : 'saída'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
