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
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

export default function NewRoutineScreen() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [residentId, setResidentId] = useState('');
  const [date, setDate] = useState(today);

  const { data: residents = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['residents', staff?.houseId],
    queryFn: () =>
      api.get(`/houses/${staff?.houseId}/residents`).then((r) => r.data),
    enabled: !!staff?.houseId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/routines', {
        date,
        description,
        houseId: staff!.houseId,
        responsibleId: staff!.id,
        residentId: residentId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      Alert.alert('Sucesso', 'Entrada de rotina registrada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar a entrada.'),
  });

  function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Atenção', 'Descreva a entrada de rotina.');
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
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Descrição <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
            placeholder="Descreva o que aconteceu..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Filho (opcional)</Text>
          <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <TouchableOpacity
              className="px-4 py-3 flex-row items-center justify-between"
              onPress={() => setResidentId('')}
            >
              <Text className={`text-sm ${residentId ? 'text-gray-900' : 'text-gray-400'}`}>
                {residentId
                  ? residents.find((r) => r.id === residentId)?.name ?? 'Selecionar'
                  : 'Nenhum (entrada geral)'}
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
          className="bg-blue-600 rounded-lg py-3.5 items-center mt-2"
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Salvar entrada</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
