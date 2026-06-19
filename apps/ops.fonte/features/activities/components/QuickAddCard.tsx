import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ActivityStatus } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { useCreateActivity } from '@/features/activities/hooks/useActivities';

const quickAddSchema = z.object({
  title: z.string().min(1, 'Informe o título'),
});
type QuickAddData = z.infer<typeof quickAddSchema>;

interface Props {
  /** Coluna onde o card será criado (sempre DRAFT no ops). */
  status: ActivityStatus;
  /** Casa do staff autenticado; o backend resolve o escopo. */
  houseId?: string | null;
}

/**
 * Criação rápida estilo Trello no rodapé da seção rascunho: digita o título,
 * confirma (return-key ou botão) e cria. Após sucesso limpa o campo e mantém o
 * foco para criar vários em sequência.
 */
export function QuickAddCard({ status, houseId }: Props) {
  const mutation = useCreateActivity();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickAddData>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '' },
  });

  const onSubmit = (data: QuickAddData) => {
    mutation.mutate(
      { title: data.title, status, houseId: houseId ?? null },
      { onSuccess: () => reset({ title: '' }) },
    );
  };

  return (
    <View className="bg-white rounded-xl border border-dashed border-gray-200 px-4 py-3 mt-1">
      <View className="flex-row items-center gap-2">
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="flex-1 text-sm text-gray-900 py-1"
              placeholder="+ Nova atividade (título)"
              value={value}
              onChangeText={onChange}
              editable={!mutation.isPending}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              blurOnSubmit={false}
            />
          )}
        />
        <TouchableOpacity
          accessibilityLabel="Adicionar atividade"
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: '#4f46e515', opacity: mutation.isPending ? 0.5 : 1 }}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text className="text-xs font-semibold" style={{ color: '#4f46e5' }}>
              Adicionar
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {errors.title && (
        <Text className="text-xs text-red-500 mt-1">{errors.title.message}</Text>
      )}
      {mutation.error != null && (
        <Text className="text-xs text-red-500 mt-1">
          {getErrorMessage(mutation.error, 'Não foi possível criar a atividade.')}
        </Text>
      )}
    </View>
  );
}
