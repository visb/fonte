import { useState } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IncidentSeverity } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

const SEVERITIES = [
  { value: IncidentSeverity.LOW, label: 'Baixa', color: '#16a34a' },
  { value: IncidentSeverity.MEDIUM, label: 'Média', color: '#ca8a04' },
  { value: IncidentSeverity.HIGH, label: 'Alta', color: '#ea580c' },
  { value: IncidentSeverity.CRITICAL, label: 'Crítica', color: '#dc2626' },
];

export default function NewIncidentScreen() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>(IncidentSeverity.MEDIUM);
  const [residentId, setResidentId] = useState('');
  const [date, setDate] = useState(today);

  const { data: residents = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['residents', staff?.houseId],
    queryFn: () => api.residents.listByHouse(staff!.houseId),
    enabled: !!staff?.houseId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.incidents.create({
        date,
        severity,
        description,
        houseId: staff!.houseId,
        responsibleId: staff!.id,
        residentId: residentId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      Alert.alert('Sucesso', 'Ocorrência registrada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível registrar a ocorrência.'),
  });

  function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Atenção', 'Descreva a ocorrência.');
      return;
    }
    mutation.mutate();
  }

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Severidade</Text>
          <View className="flex-row gap-2">
            {SEVERITIES.map((s) => (
              <TouchableOpacity
                key={s.value}
                className={`flex-1 py-2 rounded-lg border items-center ${severity === s.value ? 'border-transparent' : 'border-gray-200 bg-gray-50'}`}
                style={severity === s.value ? { backgroundColor: `${s.color}20`, borderColor: s.color } : {}}
                onPress={() => setSeverity(s.value)}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: severity === s.value ? s.color : '#6b7280' }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Descrição <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            placeholder="Descreva a ocorrência com detalhes..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Filho envolvido (opcional)</Text>
          <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <TouchableOpacity
              className="px-4 py-3"
              onPress={() => setResidentId('')}
            >
              <Text className={`text-sm ${!residentId ? 'text-gray-400' : 'text-gray-900'}`}>
                {residentId ? residents.find((r) => r.id === residentId)?.name : 'Nenhum específico'}
              </Text>
            </TouchableOpacity>
            {residents.map((r) => (
              <TouchableOpacity
                key={r.id}
                className={`px-4 py-2.5 border-t border-gray-200 ${residentId === r.id ? 'bg-blue-50' : ''}`}
                onPress={() => setResidentId(r.id)}
              >
                <Text className={`text-sm ${residentId === r.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{staff?.name}</Text>
        </View>

        <TouchableOpacity
          className="bg-red-600 rounded-lg py-3.5 items-center mt-2"
          onPress={handleSubmit}
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
