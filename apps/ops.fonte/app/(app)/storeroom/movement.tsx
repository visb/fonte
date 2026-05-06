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

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function maskDateBR(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toISODate(dateBR: string): string {
  const [d, m, y] = dateBR.split('/');
  return `${y}-${m}-${d}`;
}

const today = formatDateBR(new Date().toISOString().split('T')[0]);

export default function MovementScreen() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const [itemId, setItemId] = useState('');
  const [type, setType] = useState<MovementType>(MovementType.OUT);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today);

  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemUnit, setNewItemUnit] = useState('');

  const { data: items = [] } = useQuery({
    queryKey: ['storeroom-items', staff?.houseId],
    queryFn: () => api.storeroom.listItems({ houseId: staff!.houseId }),
    enabled: !!staff?.houseId,
  });

  const selectedItem = items.find((i) => i.id === itemId);

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const showCreateOption = search.trim().length > 0 && filteredItems.length === 0;

  const createItemMutation = useMutation({
    mutationFn: () =>
      api.storeroom.createItem({
        name: search.trim(),
        unit: newItemUnit.trim(),
        houseId: staff!.houseId,
      }),
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['storeroom-items'] });
      setItemId(newItem.id);
      setSearch(newItem.name);
      setShowNewItemForm(false);
      setNewItemUnit('');
      setShowDropdown(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      Alert.alert('Erro', msg ?? 'Não foi possível cadastrar o item.');
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.storeroom.createMovement({
        itemId,
        type,
        quantity: parseFloat(quantity),
        responsibleId: staff!.id,
        date: toISODate(date),
        notes: notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeroom-items'] });
      queryClient.invalidateQueries({ queryKey: ['storeroom-movements'] });
      router.replace({
        pathname: '/(app)/storeroom',
        params: { successMsg: 'Movimentação registrada com sucesso.' },
      });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      Alert.alert('Erro', msg ?? 'Não foi possível registrar a movimentação.');
    },
  });

  function selectItem(item: StoreroomItem) {
    setItemId(item.id);
    setSearch(item.name);
    setShowDropdown(false);
    setShowNewItemForm(false);
  }

  function handleSearchChange(text: string) {
    setSearch(text);
    setItemId('');
    setShowDropdown(true);
    setShowNewItemForm(false);
  }

  function handleSubmit() {
    if (!itemId) {
      Alert.alert('Atenção', 'Selecione um item.');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Atenção', 'Informe a quantidade.');
      return;
    }
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
                    color:
                      type === t
                        ? t === MovementType.IN
                          ? '#16a34a'
                          : '#dc2626'
                        : '#6b7280',
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
          <TextInput
            className={`border rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50 ${
              itemId ? 'border-blue-400' : 'border-gray-300'
            }`}
            placeholder="Buscar item..."
            value={search}
            onChangeText={handleSearchChange}
            onFocus={() => setShowDropdown(true)}
          />
          {selectedItem && !showDropdown && (
            <Text className="text-xs text-gray-500 mt-1">
              {Number(selectedItem.currentQuantity)} {selectedItem.unit} em estoque
            </Text>
          )}
          {showDropdown && (
            <View className="border border-gray-200 rounded-lg mt-1 bg-white overflow-hidden">
              {filteredItems.map((i) => (
                <TouchableOpacity
                  key={i.id}
                  className="px-4 py-3 border-b border-gray-100"
                  onPress={() => selectItem(i)}
                >
                  <Text className="text-sm text-gray-800">{i.name}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {Number(i.currentQuantity)} {i.unit} em estoque
                  </Text>
                </TouchableOpacity>
              ))}
              {showCreateOption && (
                <TouchableOpacity
                  className="px-4 py-3"
                  onPress={() => {
                    setShowDropdown(false);
                    setShowNewItemForm(true);
                  }}
                >
                  <Text className="text-sm text-blue-600 font-medium">
                    + Cadastrar "{search.trim()}"
                  </Text>
                </TouchableOpacity>
              )}
              {!showCreateOption && filteredItems.length === 0 && (
                <View className="px-4 py-3">
                  <Text className="text-sm text-gray-400">Nenhum item encontrado.</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {showNewItemForm && (
          <View className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Novo item:{' '}
              <Text className="font-semibold text-gray-900">{search.trim()}</Text>
            </Text>
            <Text className="text-sm text-gray-600 mb-1.5">Unidade de medida</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white mb-3"
              placeholder="Ex: kg, L, unid., cx..."
              value={newItemUnit}
              onChangeText={setNewItemUnit}
              autoFocus
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 py-2.5 rounded-lg border border-gray-300 items-center bg-white"
                onPress={() => {
                  setShowNewItemForm(false);
                  setNewItemUnit('');
                }}
              >
                <Text className="text-sm text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-2.5 rounded-lg bg-blue-600 items-center"
                onPress={() => {
                  if (!newItemUnit.trim()) {
                    Alert.alert('Atenção', 'Informe a unidade de medida.');
                    return;
                  }
                  createItemMutation.mutate();
                }}
                disabled={createItemMutation.isPending}
              >
                {createItemMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Cadastrar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Quantidade ({selectedItem?.unit ?? 'unid.'}){' '}
            <Text className="text-red-500">*</Text>
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
            onChangeText={(t) => setDate(maskDateBR(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Observações (opcional)
          </Text>
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
          className={`rounded-lg py-3.5 items-center mt-2 ${
            type === MovementType.IN ? 'bg-green-600' : 'bg-red-600'
          }`}
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
