import { View, ScrollView } from 'react-native';
import { notify } from '@/lib/dialogs';
import { router, useLocalSearchParams } from 'expo-router';
import type { ActivityStatus } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useCreateActivity } from '@/features/activities/hooks/useActivities';
import { NewActivityForm } from '@/features/activities/components/NewActivityForm';
import { CREATE_COPY } from '@/features/activities/constants';
import { creatableStatuses } from '@/features/activities/lib/permissions';
import {
  resolveCreateStatus,
  type NewActivityValues,
} from '@/features/activities/lib/activityForm';

/** Lista de atividades aberta na aba do status criado (`?tab=`, stories 220/224). */
function goToTab(status: ActivityStatus) {
  router.replace({
    pathname: '/(app)/activities',
    params: { tab: status },
  } as never);
}

/**
 * Nova atividade (story 224): o coordenador escolhe a coluna (default = aba de
 * onde veio o FAB, `?status=`); o servo cria sempre rascunho. Todos podem
 * indicar o responsável. A criação passa pela outbox (offline-first).
 */
export function NewActivityPage() {
  const { staff } = useAuth();
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const mutation = useCreateActivity();
  const submit = useFieldSubmit(mutation);

  const viewer = { role: staff?.user?.role ?? null, houseId: staff?.houseId ?? null };
  const statusOptions = creatableStatuses(viewer);
  const defaultStatus = resolveCreateStatus(statusParam, viewer);

  const onSubmit = (data: NewActivityValues) => {
    const copy = CREATE_COPY[data.status]!;
    submit(
      {
        title: data.title,
        description: data.description || null,
        houseId: staff?.houseId ?? null,
        status: data.status,
        ...(data.responsibleStaffId ? { responsibleStaffId: data.responsibleStaffId } : {}),
      },
      {
        // Cai na aba do que acabou de criar — vai para a lista primeiro, avisa depois.
        onSent: () => {
          goToTab(data.status);
          notify('Sucesso', copy.sent);
        },
        // Sem sinal fica na fila e já aparece na lista como pendente.
        onQueued: () => {
          goToTab(data.status);
          notify('Salvo no aparelho', copy.queued);
        },
        onFailed: (error) =>
          notify('Erro', getErrorMessage(error, 'Não foi possível criar a atividade.')),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5">
        <NewActivityForm
          defaultStatus={defaultStatus}
          statusOptions={statusOptions}
          houseId={staff?.houseId}
          houseName={staff?.house?.name}
          isPending={mutation.isPending}
          onSubmit={onSubmit}
        />
      </View>
    </ScrollView>
  );
}
