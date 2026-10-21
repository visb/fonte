import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityStatus } from '@fonte/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { getErrorMessage } from '@/lib/errors';
import { useIsOnline } from '@/lib/offline/network';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import {
  useChangeActivityStatus,
  useUpdateActivity,
} from '@/features/activities/hooks/useActivities';
import type { ResponsibleModalTarget } from '@/features/activities/hooks/useResponsibleModal';
import { ResponsibleOptions } from './ResponsibleOptions';

interface Props {
  /** Atividade + modo; `null` fecha o modal. */
  target: ResponsibleModalTarget | null;
  onClose: () => void;
}

const TITLE = { approve: 'Aprovar solicitação', change: 'Selecionar responsável' } as const;
const FALLBACK_ERROR = {
  approve: 'Não foi possível aprovar a solicitação.',
  change: 'Não foi possível trocar o responsável.',
} as const;

/**
 * Seletor do responsável (story 220), autossuficiente: busca os servos da casa
 * da atividade e dispara a mutation do modo. `approve` aprova já com o
 * escolhido (`PATCH /status` com TODO + responsável); `change` só troca
 * (`PATCH /activities/:id`). Exige rede: sem sinal a lista fica desabilitada.
 */
export function SelectResponsibleModal({ target, onClose }: Props) {
  const activity = target?.activity ?? null;
  const mode = target?.mode ?? 'change';
  const staffQuery = useHouseStaff(activity?.houseId);
  const update = useUpdateActivity();
  const changeStatus = useChangeActivityStatus();
  const isOnline = useIsOnline();
  const mutation = mode === 'approve' ? changeStatus : update;

  const close = () => {
    update.reset();
    changeStatus.reset();
    onClose();
  };

  const handleSelect = (staffId: string) => {
    if (!activity) return;
    if (mode === 'approve') {
      changeStatus.mutate(
        { id: activity.id, data: { status: ActivityStatus.TODO, responsibleStaffId: staffId } },
        { onSuccess: close },
      );
      return;
    }
    if (staffId === activity.responsibleStaffId) return close();
    update.mutate(
      { id: activity.id, data: { responsibleStaffId: staffId } },
      { onSuccess: close },
    );
  };

  const staff = staffQuery.data ?? [];

  return (
    <Modal visible={!!activity} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={close} />
        <View testID="select-responsible-modal" className="bg-white rounded-t-3xl max-h-[60%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-gray-900">{TITLE[mode]}</Text>
            <Pressable accessibilityLabel="Fechar" onPress={close}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="py-4 gap-2">
            {mode === 'approve' && (
              <Text className="text-sm text-gray-500">
                Escolha o responsável para aprovar a solicitação.
              </Text>
            )}
            {!isOnline && (
              <OfflineNotice message="Precisa de conexão para trocar o responsável." />
            )}
            {mutation.error != null && (
              <Text className="text-xs text-red-600">
                {getErrorMessage(mutation.error, FALLBACK_ERROR[mode])}
              </Text>
            )}
            {staffQuery.isLoading ? (
              <LoadingState />
            ) : staffQuery.error ? (
              <ErrorState message="Erro ao carregar os servos." onRetry={staffQuery.refetch} />
            ) : staff.length === 0 ? (
              <EmptyState message="Nenhum servo na casa." />
            ) : (
              <ResponsibleOptions
                staff={staff}
                currentId={activity?.responsibleStaffId ?? null}
                onSelect={handleSelect}
                disabled={!isOnline || mutation.isPending}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
