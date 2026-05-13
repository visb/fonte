import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApproveMessage, usePendingMessages, useRejectMessage } from '../hooks/useMessages';
import type { Message } from '@fonte/api-client';

function PendingMessageCard({ message }: { message: Message }) {
  const approveMutation = useApproveMessage();
  const rejectMutation = useRejectMessage();
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <View className="bg-white border border-gray-100 rounded-xl mx-4 my-2 p-4">
      <Text className="text-xs text-gray-400 mb-1">{message.senderName}</Text>
      <Text className="text-sm text-gray-900 mb-3">{message.content}</Text>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => approveMutation.mutate(message.id)}
          disabled={isPending}
          className="flex-1 bg-green-50 border border-green-200 rounded-lg py-2 items-center flex-row justify-center gap-1"
        >
          <Ionicons name="checkmark" size={14} color="#16a34a" />
          <Text className="text-sm text-green-700 font-medium">Aprovar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => rejectMutation.mutate(message.id)}
          disabled={isPending}
          className="flex-1 bg-red-50 border border-red-200 rounded-lg py-2 items-center flex-row justify-center gap-1"
        >
          <Ionicons name="close" size={14} color="#dc2626" />
          <Text className="text-sm text-red-700 font-medium">Rejeitar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ModerationPage() {
  const { data: pending = [], refetch, isRefetching } = usePendingMessages();

  return (
    <FlatList
      data={pending}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      renderItem={({ item }) => <PendingMessageCard message={item} />}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
          <Text className="text-base font-medium text-gray-400 mt-4">
            Nenhuma mensagem pendente
          </Text>
        </View>
      }
    />
  );
}
