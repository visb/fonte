import { useState, useMemo } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SupportGroupMeeting } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { resolveAssetUrl } from '@/lib/api';
import { useAllMeetings } from '../hooks/useSupportGroups';
import { MeetingCard } from '../components/MeetingCard';
import { CreateMeetingModal } from '../components/CreateMeetingModal';
import { LoadingState } from '@/components/shared/LoadingState';

export function SupportGroupsPage() {
  const { staff, logout } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: meetings = [], isLoading, refetch } = useAllMeetings();

  const sortedMeetings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeetings = meetings.filter((m: SupportGroupMeeting) => m.date === today);
    const otherMeetings = meetings.filter((m: SupportGroupMeeting) => m.date !== today);
    return [...todayMeetings, ...otherMeetings];
  }, [meetings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const photoUri = resolveAssetUrl(staff?.photoUrl ?? null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="bg-[#272950] px-4 pt-12 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="w-11 h-11 rounded-full" />
          ) : (
            <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          <View>
            <Text className="text-white/70 text-xs">Bem-vindo,</Text>
            <Text className="text-white font-semibold text-sm">{staff?.name}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.push('/(app)/profile' as never)} hitSlop={8}>
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 bg-gray-50">
        {isLoading ? (
          <LoadingState />
        ) : (
          <FlatList
            data={sortedMeetings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 88 }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-gray-500 text-sm py-8">
                Nenhuma reunião cadastrada.
              </Text>
            }
            renderItem={({ item }: { item: SupportGroupMeeting }) => (
              <MeetingCard meeting={item} />
            )}
          />
        )}

        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <CreateMeetingModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => refetch()}
      />
    </>
  );
}
