import { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAddWishlistItem } from '../hooks/useWishlist';

interface Props {
  visible: boolean;
  onClose: () => void;
  residentId: string;
}

export function AddWishlistItemModal({ visible, onClose, residentId }: Props) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const addMutation = useAddWishlistItem(residentId);

  function handleAdd() {
    if (!description.trim()) return;
    addMutation.mutate(
      { description: description.trim(), quantity: parseInt(quantity) || 1 },
      {
        onSuccess: () => {
          setDescription('');
          setQuantity('1');
          onClose();
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">Adicionar item</Text>
          <Text className="text-sm text-gray-500 mb-1">Descrição</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: Bermuda azul tamanho M"
          />
          <Text className="text-sm text-gray-500 mb-1">Quantidade</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 w-24"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="1"
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!description.trim() || addMutation.isPending}
              className="flex-1 bg-[#272950] rounded-lg py-3 items-center"
            >
              <Text className="text-sm text-white font-medium">
                {addMutation.isPending ? 'Adicionando...' : 'Adicionar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
