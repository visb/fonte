import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { useIsOnline } from '@/lib/offline/network';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  useActivity,
  useDeleteAttachment,
  useUploadActivityAttachment,
} from '@/features/activities/hooks/useActivities';
import { useResponsibleModal } from '@/features/activities/hooks/useResponsibleModal';
import { StatusBadge } from '@/features/activities/components/StatusBadge';
import {
  canEditDescription,
  canManageResponsible,
} from '@/features/activities/lib/permissions';
import { ActivityAttachments } from '@/features/activities/components/ActivityAttachments';
import { ActivityInfoCard } from '@/features/activities/components/ActivityInfoCard';
import { ActivityTabs } from '@/features/activities/components/ActivityTabs';
import { DescriptionSection } from '@/features/activities/components/DescriptionSection';
import { SelectResponsibleModal } from '@/features/activities/components/SelectResponsibleModal';

export function ActivityDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuth();
  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const responsibleModal = useResponsibleModal();
  const isOnline = useIsOnline();

  if (isLoading) return <LoadingState />;
  if (error || !activity) {
    return <ErrorState message="Erro ao carregar a atividade." onRetry={refetch} />;
  }

  const role = staff?.user?.role ?? null;
  const editable = canEditDescription(activity, { role, userId: staff?.userId ?? null });
  // Story 220: o coordenador da casa troca o responsável (menos em Concluída).
  const canChangeResponsible = canManageResponsible(activity, {
    role,
    houseId: staff?.houseId ?? null,
  });

  return (
    <ScrollView className="flex-1 bg-gray-50" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5">
        <View className="flex-row items-start justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900 flex-1 pr-3">
            {activity.title}
          </Text>
          <StatusBadge status={activity.status} />
        </View>

        <ActivityInfoCard
          activity={activity}
          isOnline={isOnline}
          onChangeResponsible={
            canChangeResponsible ? () => responsibleModal.open(activity, 'change') : undefined
          }
        />

        <DescriptionSection activity={activity} editable={editable} />

        {/* Anexos da atividade (story 73). */}
        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Anexos</Text>
          <ActivityAttachmentsSection activity={activity} />
        </View>

        {/* Abas inferiores: Comentários (story 65) | Histórico (story 220). */}
        <View className="mt-6">
          <ActivityTabs activityId={activity.id} houseId={activity.houseId} />
        </View>
      </View>

      <SelectResponsibleModal
        target={responsibleModal.target}
        onClose={responsibleModal.close}
      />
    </ScrollView>
  );
}

function ActivityAttachmentsSection({ activity }: { activity: Activity }) {
  const uploadMutation = useUploadActivityAttachment(activity.id);
  const deleteMutation = useDeleteAttachment(activity.id);

  return (
    <ActivityAttachments
      attachments={activity.attachments ?? []}
      onUpload={(att) => uploadMutation.mutate(att)}
      onDelete={(id) => deleteMutation.mutate(id)}
      uploading={uploadMutation.isPending}
      deleting={deleteMutation.isPending}
      uploadError={uploadMutation.error}
    />
  );
}
