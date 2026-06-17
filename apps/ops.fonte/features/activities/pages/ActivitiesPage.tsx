import { useState } from 'react';
import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  useActivities,
  useChangeActivityStatus,
} from '@/features/activities/hooks/useActivities';
import { ActivityCard } from '@/features/activities/components/ActivityCard';

/** Ordem fixa das seções (colunas do board), igual ao backend. */
const SECTION_ORDER: { status: ActivityStatus; title: string }[] = [
  { status: ActivityStatus.DRAFT, title: 'Rascunhos' },
  { status: ActivityStatus.REQUESTED, title: 'Solicitações' },
  { status: ActivityStatus.TODO, title: 'A fazer' },
  { status: ActivityStatus.DOING, title: 'Fazendo' },
  { status: ActivityStatus.BLOCKED, title: 'Impedimento' },
  { status: ActivityStatus.DONE, title: 'Concluídas' },
];

export function ActivitiesPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: activities = [], isLoading, error, refetch } = useActivities(
    staff?.houseId,
  );
  const changeStatus = useChangeActivityStatus();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleChangeStatus = (activity: Activity, status: ActivityStatus) => {
    changeStatus.mutate({ id: activity.id, data: { status } });
  };

  const sections = SECTION_ORDER.map((s) => ({
    title: s.title,
    data: activities.filter((a) => a.status === s.status),
  })).filter((s) => s.data.length > 0);

  if (isLoading) return <LoadingState />;
  if (error) {
    return <ErrorState message="Erro ao carregar atividades." onRetry={refetch} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1">
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            currentUserId={staff?.userId}
            onChangeStatus={handleChangeStatus}
            pending={changeStatus.isPending}
          />
        )}
        ListEmptyComponent={<EmptyState message="Nenhuma atividade registrada." />}
      />

      <TouchableOpacity
        accessibilityLabel="Nova atividade"
        className="absolute bottom-6 right-6 bg-indigo-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={() => router.push('/(app)/activities/new')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
