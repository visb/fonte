import { useEffect, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRejectWishlistItem } from '../hooks/useWishlist';

interface Props {
  itemId: string | null;
  onClose: () => void;
}

export function RejectWishlistItemModal({ itemId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const rejectMutation = useRejectWishlistItem();

  useEffect(() => {
    if (itemId) setReason('');
  }, [itemId]);

  function handleReject() {
    if (!itemId) return;
    rejectMutation.mutate(
      { itemId, data: reason.trim() ? { reason: reason.trim() } : undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal visible={!!itemId} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-base font-semibold text-gray-900 mb-1">Recusar item</Text>
          <Text className="text-sm text-gray-500 mb-4">Motivo (opcional) — será exibido ao filho</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
            value={reason}
            onChangeText={setReason}
            placeholder="Ex: Não permitido na fase atual"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReject}
              disabled={rejectMutation.isPending}
              className="flex-1 bg-red-600 rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-white font-medium">
                {rejectMutation.isPending ? 'Recusando...' : 'Recusar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
