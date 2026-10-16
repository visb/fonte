import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RESIDENT_ROW_ACTION_LABELS, type ResidentRowAction } from '@fonte/types';

interface Props {
  visible: boolean;
  residentName?: string;
  onClose: () => void;
  onSelect: (mode: ResidentRowAction) => void;
}

// Rótulo vem de `@fonte/types` (story 200) — o `adm` mostra o mesmo. Ícone e
// cor são do RN e ficam aqui.
const ITEMS: {
  mode: ResidentRowAction;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}[] = [
  { mode: 'exit', icon: 'exit-outline', color: '#dc2626', bg: 'bg-red-50' },
  { mode: 'transfer', icon: 'swap-horizontal-outline', color: '#2563eb', bg: 'bg-blue-50' },
];

/**
 * Menu de linha da lista de filhos (story 196). Só chega aqui quem pode dar
 * baixa — o gate de role e de status está em `ResidentListItem`, que decide se
 * o `⋮` existe. Sheet em vez de toque longo/swipe: o servo aprende o app em
 * campo, sem treino, então a ação precisa ser visível.
 *
 * Story 200: saída da comunidade (alta/evasão) e transferência são itens
 * separados — quem é transferido continua na comunidade.
 */
export function ResidentRowMenuSheet({ visible, residentName, onClose, onSelect }: Props) {
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

        <View className="mt-2">
          {ITEMS.map((item) => (
            <TouchableOpacity
              key={item.mode}
              className="flex-row items-center gap-3 py-4"
              onPress={() => onSelect(item.mode)}
            >
              <View className={`w-10 h-10 rounded-full ${item.bg} items-center justify-center`}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text className="text-base text-gray-900">{RESIDENT_ROW_ACTION_LABELS[item.mode]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity className="items-center py-3" onPress={onClose}>
          <Text className="text-sm text-gray-500">Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
