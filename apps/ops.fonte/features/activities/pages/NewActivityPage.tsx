import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useCreateActivity } from '@/features/activities/hooks/useActivities';
import { ActivityFormFields } from '@/features/activities/components/ActivityFormFields';

const schema = z.object({
  title: z.string().min(1, 'Informe o título'),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function NewActivityPage() {
  const { staff } = useAuth();
  const mutation = useCreateActivity();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const onSubmit = (data: FormData) => {
    // ops cria sempre como rascunho (DRAFT) na própria casa.
    mutation.mutate(
      {
        title: data.title,
        description: data.description || null,
        houseId: staff?.houseId ?? null,
      },
      {
        onSuccess: () =>
          Alert.alert('Sucesso', 'Rascunho criado.', [
            { text: 'OK', onPress: () => router.back() },
          ]),
        onError: () =>
          Alert.alert('Erro', 'Não foi possível criar a atividade.'),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5">
        <ActivityFormFields
          control={control}
          errors={errors}
          houseName={staff?.house?.name}
        />

        <TouchableOpacity
          className="bg-indigo-600 rounded-lg py-3.5 items-center mt-5"
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Criar rascunho</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
