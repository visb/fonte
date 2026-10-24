import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityStatus } from '@fonte/types';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { getErrorMessage } from '@/lib/errors';
import { useIsOnline } from '@/lib/offline/network';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import {
  useChangeActivityStatus,
  useUpdateActivity,
} from '@/features/activities/hooks/useActivities';
import type { ResponsibleModalTarget } from '@/features/activities/hooks/useResponsibleModal';
import { ResponsibleStaffList } from './ResponsibleStaffList';

/** Servo escolhido no modo "escolher". */
export interface PickedResponsible {
  id: string;
  name: string;
}

/**
 * Modo "escolher" (story 224): só devolve o servo escolhido, sem mutation — quem
 * abriu decide o que fazer (campo do formulário, quick-add em A fazer). A lista
 * vem do cache offline da casa, então funciona sem sinal.
 */
export interface ResponsiblePick {
  houseId: string | null | undefined;
  currentId: string | null;
  onSelect: (staff: PickedResponsible) => void;
}

interface Props {
  /** Atividade + modo; `null` fecha o modal. */
  target?: ResponsibleModalTarget | null;
  /** Modo "escolher"; tem precedência sobre `target`. */
  pick?: ResponsiblePick | null;
  onClose: () => void;
}

type Mode = 'approve' | 'change' | 'pick';

const TITLE: Record<Mode, string> = {
  approve: 'Aprovar solicitação',
  change: 'Selecionar responsável',
  pick: 'Escolher responsável',
};
const FALLBACK_ERROR = {
  approve: 'Não foi possível aprovar a solicitação.',
  change: 'Não foi possível trocar o responsável.',
} as const;

/**
 * Seletor do responsável (story 220), autossuficiente: busca os servos da casa
 * e age conforme o modo. `approve` aprova já com o escolhido (`PATCH /status`
 * com TODO + responsável); `change` só troca (`PATCH /activities/:id`) — os dois
 * exigem rede. `pick` (story 224) devolve o escolhido e fecha.
 */
export function SelectResponsibleModal({ target, pick, onClose }: Props) {
  const activity = pick ? null : (target?.activity ?? null);
  const mode: Mode = pick ? 'pick' : (target?.mode ?? 'change');
  const staffQuery = useHouseStaff(pick ? pick.houseId : activity?.houseId);
  const update = useUpdateActivity();
  const changeStatus = useChangeActivityStatus();
  const isOnline = useIsOnline();
  const mutation = mode === 'approve' ? changeStatus : update;
  const needsNetwork = mode !== 'pick';

  const close = () => {
    update.reset();
    changeStatus.reset();
    onClose();
  };

  const handleSelect = (staffId: string) => {
    if (pick) {
      const person = staffQuery.data?.find((s) => s.id === staffId);
      if (person) pick.onSelect({ id: person.id, name: person.name });
      return close();
    }
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

  const currentId = pick ? pick.currentId : (activity?.responsibleStaffId ?? null);

  return (
    <Modal visible={!!pick || !!activity} transparent animationType="slide" onRequestClose={close}>
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
            {needsNetwork && !isOnline && (
              <OfflineNotice message="Precisa de conexão para trocar o responsável." />
            )}
            {needsNetwork && mutation.error != null && (
              <Text className="text-xs text-red-600">
                {getErrorMessage(mutation.error, FALLBACK_ERROR[mode as 'approve' | 'change'])}
              </Text>
            )}
            <ResponsibleStaffList
              query={staffQuery}
              currentId={currentId}
              onSelect={handleSelect}
              disabled={needsNetwork && (!isOnline || mutation.isPending)}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
