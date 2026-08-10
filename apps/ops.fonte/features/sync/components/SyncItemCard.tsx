import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SYNC_STATUS_LABELS, syncItemPresentation } from '../constants';
import { formatQueuedAt } from '../utils';
import type { SyncQueueItem } from '../hooks/useSyncQueue';

interface Props {
  item: SyncQueueItem;
  /** Só existe em item recusado — pendente não se reenvia à mão (decisão 3). */
  onRetry?: (item: SyncQueueItem) => void;
  onDiscard: (item: SyncQueueItem) => void;
  isRetrying?: boolean;
}

/**
 * Um item da fila: o que é, quando entrou, em que estado está e — quando o
 * servidor recusou — **a mensagem do backend**, que é o que o operador precisa
 * ler para decidir entre reenviar e descartar.
 */
export function SyncItemCard({ item, onRetry, onDiscard, isRetrying = false }: Props) {
  const presentation = syncItemPresentation(item.mutationKey);
  const isFailed = item.status === 'failed';

  return (
    <View
      testID={`sync-item-${item.id}`}
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2"
    >
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: presentation.background }}
        >
          <Ionicons name={presentation.icon} size={20} color={presentation.tint} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">{item.label}</Text>
          {item.detail ? (
            <Text className="text-xs text-gray-500 mt-0.5">{item.detail}</Text>
          ) : null}
          <Text className="text-xs text-gray-400 mt-0.5">{formatQueuedAt(item.createdAt)}</Text>
        </View>
        <View
          testID={isFailed ? 'sync-status-failed' : 'sync-status-pending'}
          className={`rounded-full px-2 py-0.5 ${isFailed ? 'bg-red-50' : 'bg-amber-50'}`}
        >
          <Text
            className={`text-xs font-medium ${isFailed ? 'text-red-700' : 'text-amber-700'}`}
          >
            {isFailed ? SYNC_STATUS_LABELS.failed : SYNC_STATUS_LABELS.pending}
          </Text>
        </View>
      </View>

      {isFailed && item.error ? (
        <View className="bg-red-50 rounded-lg px-3 py-2 mt-3">
          <Text className="text-xs text-red-700">{item.error}</Text>
        </View>
      ) : null}

      <View className="flex-row justify-end gap-2 mt-3">
        {isFailed && onRetry ? (
          <Pressable
            accessibilityLabel="Reenviar lançamento"
            disabled={isRetrying}
            onPress={() => onRetry(item)}
            className={`rounded-lg px-3 py-2 ${isRetrying ? 'bg-blue-50' : 'bg-blue-600'}`}
          >
            <Text
              className={`text-xs font-semibold ${isRetrying ? 'text-blue-400' : 'text-white'}`}
            >
              Reenviar
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Descartar lançamento"
          onPress={() => onDiscard(item)}
          className="rounded-lg px-3 py-2 border border-gray-300"
        >
          <Text className="text-xs font-semibold text-gray-700">Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}
