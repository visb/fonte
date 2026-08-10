import { Modal, Pressable, Text, View } from 'react-native';
import { useDiscardItem, type SyncQueueItem } from '../hooks/useSyncQueue';

interface Props {
  /** `null` fecha o dialog — o item é a própria abertura. */
  item: SyncQueueItem | null;
  onClose: () => void;
}

/**
 * Confirmação de descarte. Autossuficiente (CLAUDE.md): busca a própria mutation
 * em vez de receber `onConfirm` por prop drilling.
 *
 * Descartar é **perda deliberada** de um lançamento de campo que nunca chegou ao
 * servidor — por isso a confirmação é obrigatória e o texto diz o que se perde.
 */
export function DiscardItemDialog({ item, onClose }: Props) {
  const discard = useDiscardItem();

  const handleConfirm = () => {
    if (!item) return;
    discard.mutate(item, { onSettled: onClose });
  };

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="discard-item-dialog"
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="bg-white rounded-2xl w-full px-5 py-5">
          <Text className="text-base font-semibold text-gray-900">Descartar lançamento?</Text>
          <Text className="text-sm text-gray-600 mt-2">
            {item?.label ?? ''}
            {item?.detail ? ` — ${item.detail}` : ''}
          </Text>
          <Text className="text-sm text-gray-600 mt-2">
            Este lançamento nunca chegou ao servidor. Descartar apaga o registro do aparelho e
            não há como recuperá-lo.
          </Text>

          <View className="flex-row justify-end gap-2 mt-5">
            <Pressable
              accessibilityLabel="Cancelar descarte"
              onPress={onClose}
              disabled={discard.isPending}
              className="rounded-lg px-4 py-2 border border-gray-300"
            >
              <Text className="text-sm font-semibold text-gray-700">Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Confirmar descarte"
              onPress={handleConfirm}
              disabled={discard.isPending}
              className={`rounded-lg px-4 py-2 ${discard.isPending ? 'bg-red-300' : 'bg-red-600'}`}
            >
              <Text className="text-sm font-semibold text-white">Descartar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
