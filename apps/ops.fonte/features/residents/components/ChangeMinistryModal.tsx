import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useHouseMinistries } from '../hooks/useHouseMinistries';

export function ChangeMinistryModal({
  visible,
  onClose,
  residentId,
  houseId,
  currentMinistryId,
}: {
  visible: boolean;
  onClose: () => void;
  residentId: string;
  houseId: string;
  currentMinistryId: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: ministries = [], isLoading } = useHouseMinistries(houseId, {
    enabled: visible,
  });

  const [selectedMinistryId, setSelectedMinistryId] = useState<string | null>(
    currentMinistryId,
  );

  useEffect(() => {
    if (visible) setSelectedMinistryId(currentMinistryId);
  }, [visible, currentMinistryId]);

  const mutation = useMutation({
    mutationFn: (ministryId: string | null) =>
      api.residents.update(residentId, { ministryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.residents.detail(residentId),
      });
      onClose();
    },
  });

  const handleConfirm = () => {
    if (selectedMinistryId === currentMinistryId) {
      onClose();
      return;
    }
    mutation.mutate(selectedMinistryId);
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
                Ministério
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Selecione o ministério do filho
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

          <ScrollView
            className="px-5"
            contentContainerClassName="py-4 gap-2"
          >
            {isLoading ? (
              <ActivityIndicator color="#2563eb" className="py-8" />
            ) : (
              <>
                <MinistryOption
                  label="Nenhum"
                  selected={selectedMinistryId === null}
                  onPress={() => setSelectedMinistryId(null)}
                />
                {ministries.map((hm) => (
                  <MinistryOption
                    key={hm.id}
                    label={hm.ministryName}
                    selected={selectedMinistryId === hm.ministryId}
                    onPress={() => setSelectedMinistryId(hm.ministryId)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
              onPress={onClose}
              disabled={mutation.isPending}
            >
              <Text className="text-sm font-medium text-gray-600">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
              onPress={handleConfirm}
              disabled={mutation.isPending || isLoading}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">
                  Confirmar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MinistryOption({
  label,
  selected,
  onPress,
}: {
  label: string;
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
        className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
          selected ? 'border-blue-500' : 'border-gray-300'
        }`}
      >
        {selected && (
          <View className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        )}
      </View>
      <Text className="text-sm text-gray-800 flex-1">{label}</Text>
    </Pressable>
  );
}
