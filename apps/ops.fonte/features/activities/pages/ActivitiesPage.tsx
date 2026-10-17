import { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { useIsOnline } from '@/lib/offline/network';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  useActivities,
  useChangeActivityStatus,
} from '@/features/activities/hooks/useActivities';
import { ActivityBoard } from '@/features/activities/components/ActivityBoard';
import { ActivityColumn } from '@/features/activities/components/ActivityColumn';
import {
  groupActivitiesByStatus,
  initialActivityTab,
} from '@/features/activities/lib/columns';

/**
 * Atividades da casa em colunas (story 208): abas por status, uma coluna por
 * vez. A page só orquestra hooks, agrupamento e a aba ativa.
 */
export function ActivitiesPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selected, setSelected] = useState<ActivityStatus | null>(null);

  const { data, isLoading, error, refetch } = useActivities(staff?.houseId);
  const changeStatus = useChangeActivityStatus();
  const isOnline = useIsOnline();

  const columns = useMemo(() => groupActivitiesByStatus(data ?? []), [data]);
  const active = selected ?? initialActivityTab(columns);

  // A aba inicial é fixada quando os dados chegam: depois disso, mudar o status
  // de um card não troca de aba (decisão 6), nem na atualização otimista.
  useEffect(() => {
    if (!isLoading && selected === null) setSelected(initialActivityTab(columns));
  }, [isLoading, selected, columns]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleChangeStatus = (activity: Activity, status: ActivityStatus) => {
    setSelected(active);
    changeStatus.mutate({ id: activity.id, data: { status } });
  };

  const role = staff?.user?.role ?? null;

  if (isLoading) return <LoadingState />;
  if (error) {
    return <ErrorState message="Erro ao carregar atividades." onRetry={refetch} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ActivityBoard
        columns={columns}
        active={active}
        onSelect={setSelected}
        renderColumn={(column, width) => (
          <ActivityColumn
            column={column}
            width={width}
            role={role}
            houseId={staff?.houseId}
            currentUserId={staff?.userId}
            onChangeStatus={handleChangeStatus}
            onPressActivity={(activity) => router.push(`/(app)/activities/${activity.id}`)}
            pending={changeStatus.isPending}
            isOnline={isOnline}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        )}
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
