import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  useMinistries,
  useCreateMinistry,
  useHouseStaffForMinistry,
  useHouseResidentsForMinistry,
} from '../hooks/useMinistries';

type LeaderType = 'STAFF' | 'RESIDENT';
interface LeaderOption { id: string; name: string; type: LeaderType }

export function MinistriesPage() {
  const { staff } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // create form state
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [leaderType, setLeaderType] = useState<LeaderType | null>(null);
  const [residentIds, setResidentIds] = useState<Set<string>>(new Set());
  const [residentSearch, setResidentSearch] = useState('');

  const { data: ministries = [], isLoading, refetch } = useMinistries(staff?.houseId);
  const { data: allStaff = [] } = useHouseStaffForMinistry(createOpen ? staff?.houseId : undefined);
  const { data: allResidents = [] } = useHouseResidentsForMinistry(createOpen ? staff?.houseId : undefined);
  const createMutation = useCreateMinistry(staff?.houseId ?? '');

  const leaderOptions: LeaderOption[] = useMemo(() => [
    ...allStaff.map((s) => ({ id: s.id, name: s.name, type: 'STAFF' as const })),
    ...allResidents.map((r) => ({ id: r.id, name: r.name, type: 'RESIDENT' as const })),
  ], [allStaff, allResidents]);

  const filteredResidents = useMemo(
    () => allResidents.filter((r) => r.name.toLowerCase().includes(residentSearch.toLowerCase())),
    [allResidents, residentSearch],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  function resetForm() {
    setName('');
    setLeaderId(null);
    setLeaderType(null);
    setResidentIds(new Set());
    setResidentSearch('');
  }

  function handleClose() {
    resetForm();
    setCreateOpen(false);
  }

  function selectLeader(id: string | null, type: LeaderType | null) {
    setLeaderId(id);
    setLeaderType(type);
  }

  function toggleResident(id: string) {
    setResidentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), leaderId, leaderType, residentIds: [...residentIds] },
      {
        onSuccess: () => {
          handleClose();
          refetch();
        },
      },
    );
  }

  const selectedLeaderName = leaderOptions.find((o) => o.id === leaderId)?.name;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ministérios',
          headerStyle: { backgroundColor: '#272950' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <View className="flex-1 bg-gray-50">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <FlatList
            data={ministries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 88 }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-gray-500 text-sm py-8">
                Nenhum ministério cadastrado.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                className="bg-white rounded-xl p-4 border border-gray-200"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => router.push(`/(app)/ministries/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {item.leaderName ? `Líder: ${item.leaderName}` : 'Sem líder definido'}
                </Text>
                <View className="flex-row gap-4 mt-2">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="person-outline" size={13} color="#6b7280" />
                    <Text className="text-xs text-gray-500">
                      {item.filhoCount} {item.filhoCount === 1 ? 'filho' : 'filhos'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="people-outline" size={13} color="#6b7280" />
                    <Text className="text-xs text-gray-500">
                      {item.servoCount} {item.servoCount === 1 ? 'servo' : 'servos'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* FAB */}
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Create ministry bottom sheet */}
      <Modal visible={createOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={handleClose} />
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
            {/* Header */}
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-gray-900">Novo ministério</Text>
              <Pressable onPress={handleClose}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingVertical: 20, gap: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name */}
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Nome *</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                  placeholder="Ex: Cozinha, Horta, Louvor..."
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              {/* Leader */}
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Líder (opcional)</Text>
                {leaderOptions.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhuma pessoa disponível.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* No leader option */}
                    <TouchableOpacity
                      className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${leaderId === null ? 'bg-blue-50' : 'bg-white'}`}
                      onPress={() => selectLeader(null, null)}
                    >
                      <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${leaderId === null ? 'border-blue-500' : 'border-gray-300'}`}>
                        {leaderId === null && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                      </View>
                      <Text className="text-sm text-gray-500">— Sem líder</Text>
                    </TouchableOpacity>

                    {leaderOptions.map((o) => {
                      const selected = leaderId === o.id && leaderType === o.type;
                      return (
                        <TouchableOpacity
                          key={`${o.type}-${o.id}`}
                          className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selected ? 'bg-blue-50' : 'bg-white'}`}
                          onPress={() => selectLeader(o.id, o.type)}
                        >
                          <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${selected ? 'border-blue-500' : 'border-gray-300'}`}>
                            {selected && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                          </View>
                          <Text className="flex-1 text-sm text-gray-900">{o.name}</Text>
                          <View className={`px-2 py-0.5 rounded ${o.type === 'STAFF' ? 'bg-blue-100' : 'bg-green-100'}`}>
                            <Text className={`text-xs font-medium ${o.type === 'STAFF' ? 'text-blue-700' : 'text-green-700'}`}>
                              {o.type === 'STAFF' ? 'Servo' : 'Filho'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Residents */}
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">
                  Filhos{residentIds.size > 0 ? ` (${residentIds.size} selecionados)` : ' (opcional)'}
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-2"
                  placeholder="Buscar filho..."
                  value={residentSearch}
                  onChangeText={setResidentSearch}
                />
                {filteredResidents.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhum filho encontrado.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {filteredResidents.map((r) => {
                      const selected = residentIds.has(r.id);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selected ? 'bg-blue-50' : 'bg-white'}`}
                          onPress={() => toggleResident(r.id)}
                        >
                          <View className={`w-4 h-4 rounded border-2 mr-3 items-center justify-center ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                            {selected && <Ionicons name="checkmark" size={10} color="#fff" />}
                          </View>
                          <Text className="text-sm text-gray-900">{r.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
                onPress={handleClose}
                disabled={createMutation.isPending}
              >
                <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                onPress={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-medium text-white">Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
