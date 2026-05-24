import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';
import { useDirectConversations } from '../hooks/useMessages';
import { NewDirectConversationModal } from '../components/NewDirectConversationModal';
import type { DirectConversation } from '@fonte/api-client';

function PartnerAvatar({ photoUrl }: { photoUrl: string | null }) {
  const uri = resolveAssetUrl(photoUrl);
  if (uri) {
    return <Image source={{ uri }} style={{ width: 40, height: 40, borderRadius: 20 }} />;
  }
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(39,41,80,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="person-outline" size={20} color="#272950" />
    </View>
  );
}

function DirectConversationItem({ item }: { item: DirectConversation }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/messages/direct/[relativeId]' as never,
          params: {
            relativeId: item.relativeId,
            partnerName: item.relativeName,
            partnerPhotoUrl: item.relativePhotoUrl ?? '',
          },
        } as never)
      }
      className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center"
    >
      <View className="mr-3">
        <PartnerAvatar photoUrl={item.relativePhotoUrl} />
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
  const [showNewModal, setShowNewModal] = useState(false);
  const { data: conversations = [], refetch } = useDirectConversations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
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
              Toque em + para iniciar uma conversa com um familiar
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowNewModal(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#272950',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <NewDirectConversationModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
      />
    </View>
  );
}
