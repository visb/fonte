import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ActivityStatus } from '@fonte/types';
import { CREATE_COPY } from '@/features/activities/constants';
import {
  newActivitySchema,
  type CreatableStatus,
  type NewActivityValues,
} from '@/features/activities/lib/activityForm';
import { ActivityFormFields } from './ActivityFormFields';

interface Props {
  /** Coluna inicial (`?status=` já validado para quem cria). */
  defaultStatus: CreatableStatus;
  /** Colunas que quem cria pode escolher; uma só esconde o seletor. */
  statusOptions: ActivityStatus[];
  houseId?: string | null;
  houseName?: string;
  isPending: boolean;
  onSubmit: (values: NewActivityValues) => void;
}

/**
 * Formulário de nova atividade (story 224 — sai da page, que não usa `useForm`):
 * título, descrição, coluna (só coordenador) e responsável. O texto do botão
 * segue a coluna escolhida.
 */
export function NewActivityForm({
  defaultStatus,
  statusOptions,
  houseId,
  houseName,
  isPending,
  onSubmit,
}: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewActivityValues>({
    resolver: zodResolver(newActivitySchema),
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus,
      responsibleStaffId: null,
    },
  });
  const status = useWatch({ control, name: 'status' });

  return (
    <View>
      <ActivityFormFields
        control={control}
        errors={errors}
        houseName={houseName}
        houseId={houseId}
        statusOptions={statusOptions}
      />

      <TouchableOpacity
        className="bg-indigo-600 rounded-lg py-3.5 items-center mt-5"
        onPress={handleSubmit(onSubmit)}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">
            {CREATE_COPY[status]!.button}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
