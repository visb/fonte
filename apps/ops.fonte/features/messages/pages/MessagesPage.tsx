import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useConversations, useDirectConversations, useMyConversations, usePendingMessages } from '../hooks/useMessages';
import type { Conversation } from '@fonte/api-client';

function ConversationItem({
  item,
  onPress,
}: {
  item: Conversation;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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
      {item.pendingCount > 0 && (
        <View className="bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1 mr-2">
          <Text className="text-white text-xs font-bold">{item.pendingCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

function StaffMessagesPage() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: conversations = [], refetch } = useConversations();
  const { data: pending = [] } = usePendingMessages();
  const { data: directConversations = [] } = useDirectConversations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const grouped = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    if (!acc[c.residentName]) acc[c.residentName] = [];
    acc[c.residentName].push(c);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([residentName, items]) => ({
    residentName,
    items,
  }));

  return (
    <View className="flex-1 bg-gray-50">
      {pending.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push('/(app)/messages/moderation' as never)}
          className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex-row items-center"
        >
          <Ionicons name="alert-circle-outline" size={18} color="#d97706" />
          <Text className="text-sm text-amber-700 ml-2 flex-1">
            {pending.length} mensagem(s) aguardando aprovação
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#d97706" />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => router.push('/(app)/messages/direct' as never)}
        className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center"
      >
        <View className="w-9 h-9 rounded-full bg-[#272950]/10 items-center justify-center mr-3">
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#272950" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">Conversas diretas</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {directConversations.length > 0
              ? `${directConversations.length} conversa(s) com familiares`
              : 'Mensagens diretas com familiares'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      </TouchableOpacity>

      <FlatList
        data={sections}
        keyExtractor={(s) => s.residentName}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item: section }) => (
          <View>
            <View className="px-4 py-2 bg-gray-100">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {section.residentName}
              </Text>
            </View>
            {section.items.map((conv) => (
              <ConversationItem
                key={`${conv.residentId}-${conv.relativeId}`}
                item={conv}
                onPress={() =>
                  router.push(
                    `/(app)/messages/${conv.residentId}/${conv.relativeId}` as never,
                  )
                }
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
            <Text className="text-base font-medium text-gray-400 mt-4">
              Nenhuma conversa ainda
            </Text>
          </View>
        }
      />
    </View>
  );
}

function ResidentMessagesPage() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: conversations = [], refetch } = useMyConversations();

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
      renderItem={({ item }) => (
        <ConversationItem
          item={item}
          onPress={() =>
            router.push(
              `/(app)/messages/${item.residentId}/${item.relativeId}` as never,
            )
          }
        />
      )}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
          <Text className="text-base font-medium text-gray-400 mt-4">
            Nenhum familiar cadastrado
          </Text>
        </View>
      }
    />
  );
}

export function MessagesPage() {
  const { isResident } = useAuth();
  return isResident ? <ResidentMessagesPage /> : <StaffMessagesPage />;
}
