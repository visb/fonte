import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResidentStatus } from '@fonte/types';
import { STATUS_CONFIG } from '@/lib/constants';
import {
  DEFAULT_RESIDENT_STATUS_FILTER,
  RESIDENT_STATUS_FILTER_OPTIONS,
} from '../constants';

export function ResidentStatusFilterModal({
  visible,
  onClose,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: ResidentStatus[];
  onApply: (statuses: ResidentStatus[]) => void;
}) {
  const [selected, setSelected] = useState<ResidentStatus[]>(value);

  useEffect(() => {
    if (visible) setSelected(value);
  }, [visible, value]);

  const toggle = (status: ResidentStatus) => {
    setSelected((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[70%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">
                Filtrar por status
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Selecione os status que deseja exibir
              </Text>
            </View>
            <Pressable
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerClassName="py-4 gap-2">
            {RESIDENT_STATUS_FILTER_OPTIONS.map((status) => (
              <StatusOption
                key={status}
                label={STATUS_CONFIG[status]?.label ?? status}
                color={STATUS_CONFIG[status]?.color ?? '#6b7280'}
                selected={selected.includes(status)}
                onPress={() => toggle(status)}
              />
            ))}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
              onPress={() => setSelected(DEFAULT_RESIDENT_STATUS_FILTER)}
            >
              <Text className="text-sm font-medium text-gray-600">
                Restaurar
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
              onPress={() => onApply(selected)}
            >
              <Text className="text-sm font-medium text-white">Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatusOption({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 rounded-xl border ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      onPress={onPress}
    >
      <View
        className={`w-5 h-5 rounded-md border-2 mr-3 items-center justify-center ${
          selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
        }`}
      >
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View
        className="w-2.5 h-2.5 rounded-full mr-2"
        style={{ backgroundColor: color }}
      />
      <Text className="text-sm text-gray-800 flex-1">{label}</Text>
    </Pressable>
  );
}
