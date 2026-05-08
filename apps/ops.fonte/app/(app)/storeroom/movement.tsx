import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MovementType } from '@fonte/types';
import type { StoreroomItem } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { useStoreroomItems, useCreateMovement, useCreateStoreroomItem } from '@/features/storeroom/hooks/useStoreroom';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ITEM_H = 44;

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function toISODate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function PickerColumn({
  items,
  selectedIndex,
  onChange,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
}) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 50);
  }, []);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onChange(Math.max(0, Math.min(idx, items.length - 1)));
  }

  return (
    <ScrollView
      ref={ref}
      style={{ height: ITEM_H * 5, flex: 1 }}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={onScrollEnd}
      onScrollEndDrag={onScrollEnd}
    >
      {items.map((label, i) => (
        <View key={i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#111827' }}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function DatePickerModal({
  visible,
  date,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  date: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - 5 + i));

  const [day, setDay] = useState(date.getDate() - 1);
  const [month, setMonth] = useState(date.getMonth());
  const [year, setYear] = useState(years.indexOf(String(date.getFullYear())));

  const yearNum = parseInt(years[year] ?? String(currentYear));
  const dayCount = daysInMonth(month, yearNum);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0'));
  const safeDay = Math.min(day, dayCount - 1);

  function confirm() {
    onConfirm(new Date(yearNum, month, safeDay + 1));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Selecionar data
            </Text>
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  position: 'absolute', top: ITEM_H * 2, left: 0, right: 0,
                  height: ITEM_H, backgroundColor: '#f3f4f6', borderRadius: 8,
                }}
                pointerEvents="none"
              />
              <View style={{ flexDirection: 'row' }}>
                <PickerColumn items={days} selectedIndex={safeDay} onChange={setDay} />
                <PickerColumn items={MONTHS_PT} selectedIndex={month} onChange={setMonth} />
                <PickerColumn items={years} selectedIndex={year} onChange={setYear} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' }}
                onPress={onCancel}
              >
                <Text style={{ color: '#374151', fontWeight: '500' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
                onPress={confirm}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const schema = z.object({
  itemId: z.string().min(1, 'Selecione um item'),
  type: z.nativeEnum(MovementType),
  quantity: z.string().min(1, 'Informe a quantidade').refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    'Quantidade deve ser maior que 0',
  ),
  notes: z.string().optional(),
  date: z.string(),
});
type FormData = z.infer<typeof schema>;

export default function MovementScreen() {
  const { staff } = useAuth();

  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemUnit, setNewItemUnit] = useState('');

  const { data: items = [] } = useStoreroomItems(staff?.houseId);
  const createItemMutation = useCreateStoreroomItem();
  const mutation = useCreateMovement();

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemId: '',
      type: MovementType.IN,
      quantity: '',
      notes: '',
      date: toISODate(new Date()),
    },
  });

  const currentType = watch('type');
  const currentItemId = watch('itemId');
  const selectedItem = items.find((i) => i.id === currentItemId);

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const showCreateOption = search.trim().length > 0 && filteredItems.length === 0;

  function selectItem(item: StoreroomItem) {
    setValue('itemId', item.id);
    setSearch(item.name);
    setShowDropdown(false);
    setShowNewItemForm(false);
  }

  function handleSearchChange(text: string) {
    setSearch(text);
    setValue('itemId', '');
    setShowDropdown(true);
    setShowNewItemForm(false);
  }

  function handleDateConfirm(d: Date) {
    setDateObj(d);
    setValue('date', toISODate(d));
    setShowDatePicker(false);
  }

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        itemId: data.itemId,
        type: data.type,
        quantity: parseFloat(data.quantity),
        responsibleId: staff!.id,
        date: data.date,
        notes: data.notes || null,
      },
      {
        onSuccess: () =>
          router.replace({
            pathname: '/(app)/storeroom',
            params: { successMsg: 'Movimentação registrada com sucesso.' },
          }),
        onError: (err) =>
          Alert.alert('Erro', getErrorMessage(err, 'Não foi possível registrar a movimentação.')),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        {/* Tipo */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
          <Controller
            control={control}
            name="type"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row gap-3">
                {([MovementType.IN, MovementType.OUT] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    className={`flex-1 py-3 rounded-lg border items-center ${
                      value === t
                        ? t === MovementType.IN ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => onChange(t)}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons
                        name={t === MovementType.IN ? 'arrow-up-outline' : 'arrow-down-outline'}
                        size={20}
                        color={value === t ? (t === MovementType.IN ? '#16a34a' : '#dc2626') : '#9ca3af'}
                      />
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: value === t ? (t === MovementType.IN ? '#16a34a' : '#dc2626') : '#6b7280' }}
                      >
                        {t === MovementType.IN ? 'Entrada' : 'Saída'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </View>

        {/* Item */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Item</Text>
          <TextInput
            className={`border rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50 ${
              currentItemId ? 'border-blue-400' : 'border-gray-300'
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
          {errors.itemId && (
            <Text className="text-xs text-red-500 mt-1">{errors.itemId.message}</Text>
          )}
          {showDropdown && (
            <View className="border border-gray-200 rounded-lg mt-1 bg-white overflow-hidden">
              {filteredItems.map((i) => (
                <TouchableOpacity key={i.id} className="px-4 py-3 border-b border-gray-100" onPress={() => selectItem(i)}>
                  <Text className="text-sm text-gray-800">{i.name}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {Number(i.currentQuantity)} {i.unit} em estoque
                  </Text>
                </TouchableOpacity>
              ))}
              {showCreateOption && (
                <TouchableOpacity
                  className="px-4 py-3"
                  onPress={() => { setShowDropdown(false); setShowNewItemForm(true); }}
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

        {/* Novo item */}
        {showNewItemForm && (
          <View className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Novo item: <Text className="font-semibold text-gray-900">{search.trim()}</Text>
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
                onPress={() => { setShowNewItemForm(false); setNewItemUnit(''); }}
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
                  createItemMutation.mutate(
                    { name: search.trim(), unit: newItemUnit.trim(), houseId: staff!.houseId },
                    {
                      onSuccess: (newItem) => {
                        setValue('itemId', newItem.id);
                        setSearch(newItem.name);
                        setShowNewItemForm(false);
                        setNewItemUnit('');
                        setShowDropdown(false);
                      },
                      onError: (err) =>
                        Alert.alert('Erro', getErrorMessage(err, 'Não foi possível cadastrar o item.')),
                    },
                  );
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

        {/* Quantidade */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Quantidade ({selectedItem?.unit ?? 'unid.'}) <Text className="text-red-500">*</Text>
          </Text>
          <Controller
            control={control}
            name="quantity"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                placeholder="0"
                keyboardType="numeric"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.quantity && (
            <Text className="text-xs text-red-500 mt-1">{errors.quantity.message}</Text>
          )}
        </View>

        {/* Data */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 flex-row justify-between items-center"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className="text-sm text-gray-900">{formatDateBR(dateObj)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <DatePickerModal
            visible={showDatePicker}
            date={dateObj}
            onConfirm={handleDateConfirm}
            onCancel={() => setShowDatePicker(false)}
          />
        </View>

        {/* Observações */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Observações (opcional)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                placeholder="Ex: compra do mercado, uso na cozinha..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>

        {/* Responsável */}
        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{staff?.name}</Text>
        </View>

        <TouchableOpacity
          className={`rounded-lg py-3.5 items-center mt-2 ${
            currentType === MovementType.IN ? 'bg-green-600' : 'bg-red-600'
          }`}
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Registrar {currentType === MovementType.IN ? 'entrada' : 'saída'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
