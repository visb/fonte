import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useDirectConversations } from '../hooks/useMessages';
import type { DirectConversation } from '@fonte/api-client';

function DirectConversationItem({ item }: { item: DirectConversation }) {
  return (
    <Pressable
      onPress={() =>
        router.push(
          `/(app)/messages/direct/${item.relativeId}` as never,
        )
      }
      className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-[#272950]/10 items-center justify-center mr-3">
        <Ionicons name="person-outline" size={20} color="#272950" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-gray-900">{item.relativeName}</Text>
        {item.lastMessage ? (
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
            {item.lastMessage}
          </Text>
        ) : (
          <Text className="text-xs text-gray-400 mt-0.5">Sem mensagens ainda</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

export function DirectConversationsPage() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: conversations = [], refetch } = useDirectConversations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.relativeId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => <DirectConversationItem item={item} />}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="chatbubble-ellipses-outline" size={40} color="#d1d5db" />
          <Text className="text-base font-medium text-gray-400 mt-4">
            Nenhuma conversa direta ainda
          </Text>
          <Text className="text-sm text-gray-400 mt-1 text-center px-8">
            Familiares podem iniciar conversas diretas pelo app deles
          </Text>
        </View>
      }
    />
  );
}
