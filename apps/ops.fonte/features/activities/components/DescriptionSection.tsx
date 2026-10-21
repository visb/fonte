import { useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Activity } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { useUpdateActivity } from '@/features/activities/hooks/useActivities';
import { DescriptionMarkdown } from './DescriptionMarkdown';

const schema = z.object({ description: z.string().optional() });
type FormData = z.infer<typeof schema>;

interface Props {
  activity: Activity;
  editable: boolean;
}

/** Descrição do detalhe: markdown read-only (story 72) ou edição (story 62). */
export function DescriptionSection({ activity, editable }: Props) {
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
        {/* Markdown renderizado read-only (negrito, listas, links) — story 72. */}
        <DescriptionMarkdown markdown={activity.description} />
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
