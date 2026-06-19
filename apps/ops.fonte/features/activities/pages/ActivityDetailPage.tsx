import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useActivity, useUpdateActivity } from '@/features/activities/hooks/useActivities';
import { StatusBadge } from '@/features/activities/components/StatusBadge';
import { canEditDescription } from '@/features/activities/lib/permissions';

const schema = z.object({ description: z.string().optional() });
type FormData = z.infer<typeof schema>;

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-100">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-800 flex-1 text-right ml-3">{value}</Text>
    </View>
  );
}

export function ActivityDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuth();
  const { data: activity, isLoading, error, refetch } = useActivity(id);

  if (isLoading) return <LoadingState />;
  if (error || !activity) {
    return <ErrorState message="Erro ao carregar a atividade." onRetry={refetch} />;
  }

  const editable = canEditDescription(activity, {
    role: staff?.user?.role ?? null,
    userId: staff?.userId ?? null,
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

        <View className="bg-white rounded-xl px-4 py-1 mb-5">
          <InfoRow label="Casa" value={activity.house?.name ?? 'Geral (sem casa)'} />
          <InfoRow
            label="Responsável"
            value={activity.responsible?.name ?? 'Não atribuído'}
          />
          <InfoRow label="Criado por" value={activity.createdBy?.name ?? '—'} />
          <InfoRow label="Criada em" value={formatDateTime(activity.createdAt)} />
          <InfoRow label="Atualizada em" value={formatDateTime(activity.updatedAt)} />
        </View>

        <DescriptionSection activity={activity} editable={editable} />
      </View>
    </ScrollView>
  );
}

function DescriptionSection({
  activity,
  editable,
}: {
  activity: Activity;
  editable: boolean;
}) {
  const mutation = useUpdateActivity();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: activity.description ?? '' },
  });

  useEffect(() => {
    reset({ description: activity.description ?? '' });
  }, [activity.description, reset]);

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      { id: activity.id, data: { description: data.description ? data.description : null } },
      {
        onSuccess: () => Alert.alert('Sucesso', 'Descrição atualizada.'),
        onError: (err) => Alert.alert('Erro', getErrorMessage(err, 'Erro ao salvar a descrição.')),
      },
    );
  };

  if (!editable) {
    return (
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Descrição</Text>
        <Text className="text-sm text-gray-600">
          {activity.description || 'Sem descrição.'}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">Descrição</Text>
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
            placeholder="Detalhe a atividade..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      <TouchableOpacity
        className="bg-indigo-600 rounded-lg py-3.5 items-center mt-4"
        onPress={handleSubmit(onSubmit)}
        disabled={!isDirty || mutation.isPending}
        style={{ opacity: !isDirty || mutation.isPending ? 0.5 : 1 }}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Salvar descrição</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
