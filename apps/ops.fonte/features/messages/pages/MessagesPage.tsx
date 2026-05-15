import { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { resolveAssetUrl } from '@/lib/api';
import { useConversations, useMyConversations, usePendingMessages } from '../hooks/useMessages';
import { ModerationPage } from './ModerationPage';
import { DirectConversationsPage } from './DirectConversationsPage';
import type { Conversation } from '@fonte/api-client';

type TabKey = 'direct' | 'residents' | 'moderate';

const TAB_LABELS: Record<TabKey, string> = {
  direct: 'Mensagens diretas',
  residents: 'Filhos',
  moderate: 'Moderar',
};

function PartnerAvatar({ photoUrl }: { photoUrl: string | null }) {
  const uri = resolveAssetUrl(photoUrl);
  if (uri) {
    return <Image source={{ uri }} style={{ width: 40, height: 40, borderRadius: 20 }} />;
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(39,41,80,0.1)', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="person-outline" size={20} color="#272950" />
    </View>
  );
}

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
      {item.pendingCount > 0 && (
        <View className="bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1 mr-2">
          <Text className="text-white text-xs font-bold">{item.pendingCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

function ResidentsTab() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: conversations = [], refetch } = useConversations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const sections = Object.entries(
    conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
      if (!acc[c.residentName]) acc[c.residentName] = [];
      acc[c.residentName].push(c);
      return acc;
    }, {}),
  ).map(([residentName, items]) => ({ residentName, items }));

  return (
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
                router.push({
                  pathname: '/(app)/messages/[residentId]/[relativeId]' as never,
                  params: { residentId: conv.residentId, relativeId: conv.relativeId, partnerName: conv.relativeName, partnerPhotoUrl: conv.relativePhotoUrl ?? '' },
                } as never)
              }
            />
          ))}
        </View>
      )}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
          <Text className="text-base font-medium text-gray-400 mt-4">Nenhuma conversa ainda</Text>
        </View>
      }
    />
  );
}

function StaffMessagesPage() {
  const { canModerateMessages, canSendMessagesToFamilies } = useAuth();
  const { data: pending = [] } = usePendingMessages();

  const availableTabs: TabKey[] = [
    ...(canSendMessagesToFamilies ? (['direct'] as TabKey[]) : []),
    ...(canModerateMessages ? (['residents', 'moderate'] as TabKey[]) : []),
  ];

  const [activeTab, setActiveTab] = useState<TabKey>(availableTabs[0] ?? 'direct');
  const showTabs = availableTabs.length > 1;

  return (
    <View className="flex-1 bg-gray-50">
      {showTabs && (
        <View className="flex-row bg-white border-b border-gray-100">
          {availableTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-3 items-center"
              style={activeTab === tab ? { borderBottomWidth: 2, borderBottomColor: '#272950' } : undefined}
            >
              <View className="flex-row items-center gap-1.5">
                <Text className={`text-sm font-medium ${activeTab === tab ? 'text-[#272950]' : 'text-gray-400'}`}>
                  {TAB_LABELS[tab]}
                </Text>
                {tab === 'moderate' && pending.length > 0 && (
                  <View className="bg-amber-500 rounded-full min-w-4 h-4 items-center justify-center px-1">
                    <Text className="text-white text-xs font-bold">{pending.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'direct' && <DirectConversationsPage />}
      {activeTab === 'residents' && <ResidentsTab />}
      {activeTab === 'moderate' && <ModerationPage />}
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
