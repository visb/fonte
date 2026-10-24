import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useCreateActivity } from '@/features/activities/hooks/useActivities';
import { SelectResponsibleModal, type PickedResponsible } from './SelectResponsibleModal';

const quickAddSchema = z.object({
  title: z.string().min(1, 'Informe o título'),
});
type QuickAddData = z.infer<typeof quickAddSchema>;

interface Props {
  /** Coluna onde o card será criado (DRAFT; REQUESTED/TODO só coordenador — story 224). */
  status: ActivityStatus;
  /** Casa do staff autenticado; o backend resolve o escopo. */
  houseId?: string | null;
}

/**
 * Criação rápida estilo Trello no topo da coluna: digita o título, confirma
 * (return-key ou botão) e cria. Em A fazer (story 224) o "Adicionar" abre o
 * seletor de responsável e escolher o servo cria a atividade com ele; cancelar
 * não cria e mantém o título. Após criar limpa o campo para criar vários em
 * sequência. O "modal aberto" é estado de UI do card, não campo do form.
 */
export function QuickAddCard({ status, houseId }: Props) {
  const mutation = useCreateActivity();
  const submit = useFieldSubmit(mutation);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickAddData>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '' },
  });

  const create = (title: string, responsibleStaffId?: string) => {
    // Offline o card já aparece na lista como pendente e o campo limpa na hora:
    // esperar o `onSuccess` deixaria o operador sem saber se salvou (story 171).
    const clear = () => reset({ title: '' });
    submit(
      {
        title,
        status,
        houseId: houseId ?? null,
        ...(responsibleStaffId ? { responsibleStaffId } : {}),
      },
      { onSent: clear, onQueued: clear },
    );
  };

  const onSubmit = (data: QuickAddData) => {
    if (status === ActivityStatus.TODO) {
      setPendingTitle(data.title);
      return;
    }
    create(data.title);
  };

  const onPickResponsible = (person: PickedResponsible) => {
    if (pendingTitle) create(pendingTitle, person.id);
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
      {status === ActivityStatus.TODO && (
        <SelectResponsibleModal
          pick={
            pendingTitle !== null
              ? { houseId, currentId: null, onSelect: onPickResponsible }
              : null
          }
          onClose={() => setPendingTitle(null)}
        />
      )}
    </View>
  );
}
