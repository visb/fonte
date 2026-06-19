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
import { QuickAddCard } from '@/features/activities/components/QuickAddCard';
import { canQuickAddInStatus } from '@/features/activities/constants';

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

  const role = staff?.user?.role ?? null;

  const sections = SECTION_ORDER.map((s) => ({
    status: s.status,
    title: s.title,
    data: activities.filter((a) => a.status === s.status),
  })).filter(
    // Mostra seções com itens; mantém a seção de rascunho mesmo vazia para
    // exibir o quick-add (criação inline da primeira atividade).
    (s) => s.data.length > 0 || canQuickAddInStatus(s.status, role),
  );

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
        renderSectionFooter={({ section }) =>
          canQuickAddInStatus(section.status, role) ? (
            <QuickAddCard
              status={section.status}
              houseId={staff?.houseId}
            />
          ) : null
        }
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
