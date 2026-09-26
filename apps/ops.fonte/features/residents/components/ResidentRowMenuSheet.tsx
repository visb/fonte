import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  residentName?: string;
  onClose: () => void;
  onRemove: () => void;
}

/**
 * Menu de linha da lista de filhos (story 196). Só chega aqui quem pode remover
 * — o gate de role e de status está em `ResidentListItem`, que decide se o `⋮`
 * existe. Sheet em vez de toque longo/swipe: o servo aprende o app em campo,
 * sem treino, então a ação precisa ser visível.
 */
export function ResidentRowMenuSheet({ visible, residentName, onClose, onRemove }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Pressable>
      <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-5 pt-5 pb-8">
        <Text className="text-base font-semibold text-gray-900">Ações</Text>
        {residentName ? (
          <Text className="text-xs text-gray-400 mt-0.5">{residentName}</Text>
        ) : null}

        <TouchableOpacity
          className="flex-row items-center gap-3 py-4 mt-2"
          onPress={onRemove}
        >
          <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center">
            <Ionicons name="exit-outline" size={20} color="#dc2626" />
          </View>
          <Text className="text-base text-gray-900">Remover da casa</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center py-3" onPress={onClose}>
          <Text className="text-sm text-gray-500">Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
