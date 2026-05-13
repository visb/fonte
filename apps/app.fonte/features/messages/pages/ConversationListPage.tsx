import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useHouseStaffThreads } from '../hooks/useMessages';
import type { StaffThreadSummary } from '@fonte/api-client';

function ResidentThreadItem() {
  const { relative } = useAuth();
  if (!relative) return null;

  return (
    <Pressable
      onPress={() => router.push('/(app)/messages/resident' as never)}
      className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-violet-100 items-center justify-center mr-3">
        <Ionicons name="person-outline" size={20} color="#4c1d95" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-gray-900">{relative.residentName}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">Seu familiar</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

function StaffThreadItem({ item }: { item: StaffThreadSummary }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/messages/[staffId]' as never,
          params: { staffId: item.staffId, name: item.staffName },
        } as never)
      }
      className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Ionicons name="person-circle-outline" size={22} color="#6b7280" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-gray-900">{item.staffName}</Text>
        {item.lastMessage ? (
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
            {item.lastMessage}
          </Text>
        ) : (
          <Text className="text-xs text-gray-400 mt-0.5">Toque para iniciar conversa</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

export function ConversationListPage() {
  const { data: staffThreads = [], isLoading, isError, refetch, isRefetching } = useHouseStaffThreads();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <FlatList
      data={staffThreads}
      keyExtractor={(s) => s.staffId}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListHeaderComponent={
        <>
          <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Familiar
            </Text>
          </View>
          <ResidentThreadItem />
          {staffThreads.length > 0 && (
            <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Servos da casa
              </Text>
            </View>
          )}
        </>
      }
      renderItem={({ item }) => <StaffThreadItem item={item} />}
      ListEmptyComponent={
        <View className="items-center justify-center py-12">
          <Ionicons name="people-outline" size={32} color="#d1d5db" />
          <Text className="text-sm text-gray-400 mt-3">Nenhum servo cadastrado na casa</Text>
        </View>
      }
    />
  );
}
