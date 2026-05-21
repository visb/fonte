import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { IncidentSeverity } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { useCreateIncident } from '@/features/incidents/hooks/useIncidents';
import { useResidentsByHouse } from '@/features/residents/hooks/useResidents';
import { IncidentFormFields } from '@/features/incidents/components/IncidentFormFields';

const today = new Date().toISOString().split('T')[0];

const schema = z.object({
  date: z.string().min(1),
  severity: z.nativeEnum(IncidentSeverity),
  description: z.string().min(1, 'Descreva a ocorrência'),
  residentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function NewIncidentPage() {
  const { staff } = useAuth();
  const { data: residents = [] } = useResidentsByHouse(staff?.houseId);
  const mutation = useCreateIncident();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: today, severity: IncidentSeverity.MEDIUM, description: '', residentId: '' },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        date: data.date,
        severity: data.severity,
        description: data.description,
        houseId: staff!.houseId!,
        responsibleId: staff!.id,
        residentId: data.residentId || null,
      },
      {
        onSuccess: () =>
          Alert.alert('Sucesso', 'Ocorrência registrada.', [{ text: 'OK', onPress: () => router.back() }]),
        onError: () =>
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
          className="bg-red-600 rounded-lg py-3.5 items-center mt-5"
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
