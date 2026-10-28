import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useCreateIncident } from '@/features/incidents/hooks/useIncidents';
import { useResidentsByHouse } from '@/features/residents/hooks/useResidents';
import { IncidentFormFields } from '@/features/incidents/components/IncidentFormFields';
import {
  incidentFormDefaults,
  incidentFormSchema,
  type IncidentFormData as FormData,
} from '@/features/incidents/schema';

export function NewIncidentPage() {
  const { staff } = useAuth();
  const { data: residents = [] } = useResidentsByHouse(staff?.houseId);
  const mutation = useCreateIncident();
  const submit = useFieldSubmit(mutation);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: incidentFormDefaults(),
  });

  const onSubmit = (data: FormData) => {
    // Ocorrência é lançada no momento em que acontece, muitas vezes sem sinal:
    // offline ela entra na fila e a tela volta na hora (story 171).
    submit(
      {
        date: data.date,
        type: data.type,
        description: data.description,
        houseId: staff!.houseId!,
        responsibleId: staff!.id,
        residentIds: data.residentIds,
        responsibleName: staff?.name,
        residentNames: data.residentIds.map((id) => residents.find((r) => r.id === id)?.name ?? ''),
      },
      {
        onSent: () =>
          Alert.alert('Sucesso', 'Ocorrência registrada.', [{ text: 'OK', onPress: () => router.back() }]),
        // Volta primeiro e avisa depois: preso no aviso, o operador ficaria
        // olhando um botão girando por um envio que só acontece com rede.
        onQueued: () => {
          router.back();
          Alert.alert(
            'Salvo no aparelho',
            'Sem conexão agora: a ocorrência será enviada assim que a conexão voltar.',
          );
        },
        onFailed: () =>
          Alert.alert('Erro', 'Não foi possível registrar a ocorrência.'),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5">
        <IncidentFormFields
          control={control}
          errors={errors}
          residents={residents}
          responsibleName={staff?.name}
        />

        <TouchableOpacity
          // Cor neutra (story 229): vermelho fixo não combina com ocorrência positiva.
          className="bg-gray-800 rounded-lg py-3.5 items-center mt-5"
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Registrar ocorrência</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
