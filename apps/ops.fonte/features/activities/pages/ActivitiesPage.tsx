import { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { useIsOnline } from '@/lib/offline/network';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  useActivities,
  useChangeActivityStatus,
} from '@/features/activities/hooks/useActivities';
import { useResponsibleModal } from '@/features/activities/hooks/useResponsibleModal';
import { ActivityBoard } from '@/features/activities/components/ActivityBoard';
import { ActivityColumn } from '@/features/activities/components/ActivityColumn';
import { SelectResponsibleModal } from '@/features/activities/components/SelectResponsibleModal';
import {
  groupActivitiesByStatus,
  initialActivityTab,
  parseActivityTab,
} from '@/features/activities/lib/columns';
import {
  canCreateInStatus,
  type ActivityViewer,
} from '@/features/activities/lib/permissions';

/**
 * Rota do FAB (story 224): leva a aba atual em `?status=` quando quem olha pode
 * criar nela, para o formulário abrir já nessa coluna.
 */
function newActivityHref(tab: ActivityStatus, viewer: ActivityViewer) {
  if (!canCreateInStatus(tab, viewer)) return '/(app)/activities/new' as const;
  return { pathname: '/(app)/activities/new', params: { status: tab } } as never;
}

/**
 * Atividades da casa em colunas (story 208): abas por status, uma coluna por
 * vez. A page só orquestra hooks, agrupamento, a aba ativa e o seletor de
 * responsável (story 220).
 */
export function ActivitiesPage() {
  const { staff } = useAuth();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = parseActivityTab(tab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selected, setSelected] = useState<ActivityStatus | null>(null);

  const { data, isLoading, error, refetch } = useActivities(staff?.houseId);
  const changeStatus = useChangeActivityStatus();
  const responsibleModal = useResponsibleModal();
  const isOnline = useIsOnline();

  const columns = useMemo(() => groupActivitiesByStatus(data ?? []), [data]);
  const active = selected ?? requestedTab ?? initialActivityTab(columns);

  // `?tab=` (vindo de criar atividade, story 220) prevalece sobre a regra da
  // aba inicial — inclusive se o param mudar com a tela já montada.
  useEffect(() => {
    if (requestedTab) setSelected(requestedTab);
  }, [requestedTab]);

  // A aba inicial é fixada quando os dados chegam: depois disso, mudar o status
  // de um card não troca de aba (decisão 6), nem na atualização otimista.
  useEffect(() => {
    if (!isLoading && selected === null) {
      setSelected(requestedTab ?? initialActivityTab(columns));
    }
  }, [isLoading, selected, columns, requestedTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleChangeStatus = (activity: Activity, status: ActivityStatus) => {
    setSelected(active);
    // Aprovar sem responsável (story 220): escolhe no seletor, que já aprova.
    const approving =
      activity.status === ActivityStatus.REQUESTED && status === ActivityStatus.TODO;
    if (approving && !activity.responsibleStaffId) {
      responsibleModal.open(activity, 'approve');
      return;
    }
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
            onPressResponsible={(activity) => responsibleModal.open(activity, 'change')}
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
        onPress={() => router.push(newActivityHref(active, { role, houseId: staff?.houseId }))}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <SelectResponsibleModal
        target={responsibleModal.target}
        onClose={responsibleModal.close}
      />
    </View>
  );
}
