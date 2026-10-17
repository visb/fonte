import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { getErrorMessage } from '@/lib/errors';
import { useIsOnline } from '@/lib/offline/network';
import { useChangeResidentMinistry, useHouseMinistries } from '../hooks/useHouseMinistries';
import { MinistryOption } from './MinistryOption';

interface Props {
  visible: boolean;
  onClose: () => void;
  residentId: string;
  houseId: string;
  currentMinistryId: string | null;
}

/**
 * Ministério do filho pela ficha (story 205). Lista só os ministérios da casa do
 * filho (`house-ministries`, store local). Gravar exige rede: sem sinal o botão
 * fica desabilitado com aviso. Erro do backend (400) aparece aqui.
 */
export function ChangeMinistryModal({ visible, onClose, residentId, houseId, currentMinistryId }: Props) {
  const isOnline = useIsOnline();
  const { data: ministries = [], isLoading } = useHouseMinistries(houseId, { enabled: visible });
  const mutation = useChangeResidentMinistry(residentId, houseId);
  const [selected, setSelected] = useState<string | null>(currentMinistryId);

  useEffect(() => {
    if (visible) setSelected(currentMinistryId);
  }, [visible, currentMinistryId]);

  const handleConfirm = () => {
    if (selected === currentMinistryId) {
      onClose();
      return;
    }
    mutation.mutate(selected, { onSuccess: onClose });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[70%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">Ministério</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Ministérios da casa do filho</Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar"
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerClassName="py-4 gap-2">
            {!isOnline && <OfflineNotice message="Precisa de conexão para trocar o ministério." />}
            {isLoading ? (
              <ActivityIndicator color="#2563eb" className="py-8" />
            ) : (
              <>
                <MinistryOption label="Nenhum" selected={selected === null} onPress={() => setSelected(null)} />
                {ministries.map((hm) => (
                  <MinistryOption
                    key={hm.id}
                    label={hm.name}
                    selected={selected === hm.id}
                    onPress={() => setSelected(hm.id)}
                  />
                ))}
              </>
            )}
            {mutation.isError && (
              <Text className="text-sm text-red-600">
                {getErrorMessage(mutation.error, 'Não foi possível trocar o ministério.')}
              </Text>
            )}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
              onPress={onClose}
              disabled={mutation.isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Confirmar ministério"
              className={`flex-1 py-3 rounded-xl items-center ${isOnline ? 'bg-blue-600' : 'bg-gray-300'}`}
              onPress={handleConfirm}
              disabled={!isOnline || mutation.isPending || isLoading}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Confirmar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
