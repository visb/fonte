import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  confirmedCount: number;
  total: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Warning shown before concluding the census ("chamada" na refeição): the
// coordinator must double-check nobody was left out before notifying the ADM.
export function ConcludeCensusModal({
  visible,
  confirmedCount,
  total,
  isPending,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="bg-white rounded-2xl w-full max-w-sm p-5">
          <View className="items-center mb-3">
            <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center">
              <Ionicons name="alert" size={26} color="#d97706" />
            </View>
          </View>
          <Text className="text-base font-semibold text-gray-900 text-center mb-2">
            Concluir contagem?
          </Text>
          <Text className="text-sm text-gray-600 text-center mb-1">
            Verifique se nenhum filho ficou de fora antes de concluir. Esta contagem é a
            chamada da refeição.
          </Text>
          <Text className="text-xs text-gray-400 text-center mb-4">
            {confirmedCount}/{total} confirmados
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              onPress={onClose}
              disabled={isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Revisar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
              onPress={onConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Concluir</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
