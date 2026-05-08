import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { IncidentSeverity } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { SEVERITY_CONFIG } from '@/lib/constants';
import { useCreateIncident } from '@/features/incidents/hooks/useIncidents';
import { useResidentsByHouse } from '@/features/residents/hooks/useResidents';

const today = new Date().toISOString().split('T')[0];

const SEVERITIES = Object.values(IncidentSeverity) as IncidentSeverity[];

const schema = z.object({
  date: z.string().min(1),
  severity: z.nativeEnum(IncidentSeverity),
  description: z.string().min(1, 'Descreva a ocorrência'),
  residentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function NewIncidentScreen() {
  const { staff } = useAuth();

  const { data: residents = [] } = useResidentsByHouse(staff?.houseId);
  const mutation = useCreateIncident();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      severity: IncidentSeverity.MEDIUM,
      description: '',
      residentId: '',
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        date: data.date,
        severity: data.severity,
        description: data.description,
        houseId: staff!.houseId,
        responsibleId: staff!.id,
        residentId: data.residentId || null,
      },
      {
        onSuccess: () =>
          Alert.alert('Sucesso', 'Ocorrência registrada.', [
            { text: 'OK', onPress: () => router.back() },
          ]),
        onError: () => Alert.alert('Erro', 'Não foi possível registrar a ocorrência.'),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        {/* Data */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <Controller
            control={control}
            name="date"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                value={value}
                onChangeText={onChange}
                placeholder="AAAA-MM-DD"
              />
            )}
          />
        </View>

        {/* Severidade */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Severidade</Text>
          <Controller
            control={control}
            name="severity"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row gap-2">
                {SEVERITIES.map((s) => {
                  const cfg = SEVERITY_CONFIG[s];
                  const active = value === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      className={`flex-1 py-2 rounded-lg border items-center ${active ? 'border-transparent' : 'border-gray-200 bg-gray-50'}`}
                      style={active ? { backgroundColor: `${cfg.color}20`, borderColor: cfg.color } : {}}
                      onPress={() => onChange(s)}
                    >
                      <Text className="text-xs font-semibold" style={{ color: active ? cfg.color : '#6b7280' }}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
        </View>

        {/* Descrição */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Descrição <Text className="text-red-500">*</Text>
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                placeholder="Descreva a ocorrência com detalhes..."
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.description && (
            <Text className="text-xs text-red-500 mt-1">{errors.description.message}</Text>
          )}
        </View>

        {/* Filho envolvido */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Filho envolvido (opcional)</Text>
          <Controller
            control={control}
            name="residentId"
            render={({ field: { onChange, value } }) => (
              <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                <TouchableOpacity className="px-4 py-3" onPress={() => onChange('')}>
                  <Text className={`text-sm ${!value ? 'text-gray-400' : 'text-gray-900'}`}>
                    {value ? residents.find((r) => r.id === value)?.name : 'Nenhum específico'}
                  </Text>
                </TouchableOpacity>
                {residents.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    className={`px-4 py-2.5 border-t border-gray-200 ${value === r.id ? 'bg-blue-50' : ''}`}
                    onPress={() => onChange(r.id)}
                  >
                    <Text className={`text-sm ${value === r.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </View>

        {/* Responsável */}
        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{staff?.name}</Text>
        </View>

        <TouchableOpacity
          className="bg-red-600 rounded-lg py-3.5 items-center mt-2"
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
