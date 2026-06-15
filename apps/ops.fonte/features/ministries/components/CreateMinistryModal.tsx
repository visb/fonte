import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateMinistry, useHouseStaffForMinistry, useHouseResidentsForMinistry } from '../hooks/useMinistries';
import { normalizeForSearch } from '@/lib/searchUtils';

type LeaderType = 'STAFF' | 'RESIDENT';
interface LeaderOption { id: string; name: string; type: LeaderType }

interface Props {
  visible: boolean;
  houseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMinistryModal({ visible, houseId, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [leaderType, setLeaderType] = useState<LeaderType | null>(null);
  const [residentIds, setResidentIds] = useState<Set<string>>(new Set());
  const [residentSearch, setResidentSearch] = useState('');

  const { data: allStaff = [] } = useHouseStaffForMinistry(visible ? houseId : undefined);
  const { data: allResidents = [] } = useHouseResidentsForMinistry(visible ? houseId : undefined);
  const createMutation = useCreateMinistry(houseId);

  const leaderOptions: LeaderOption[] = useMemo(() => [
    ...allStaff.map((s) => ({ id: s.id, name: s.name, type: 'STAFF' as const })),
    ...allResidents.map((r) => ({ id: r.id, name: r.name, type: 'RESIDENT' as const })),
  ], [allStaff, allResidents]);

  const filteredResidents = useMemo(
    () => allResidents.filter((r) => normalizeForSearch(r.name).includes(normalizeForSearch(residentSearch))),
    [allResidents, residentSearch],
  );

  function resetForm() {
    setName('');
    setLeaderId(null);
    setLeaderType(null);
    setResidentIds(new Set());
    setResidentSearch('');
  }

  function handleClose() {
    resetForm();
    onClose();
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
          resetForm();
          onSuccess();
          onClose();
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
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

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Líder (opcional)</Text>
              {leaderOptions.length === 0 ? (
                <Text className="text-sm text-gray-400">Nenhuma pessoa disponível.</Text>
              ) : (
                <View className="border border-gray-200 rounded-xl overflow-hidden">
                  <TouchableOpacity
                    className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${leaderId === null ? 'bg-blue-50' : 'bg-white'}`}
                    onPress={() => { setLeaderId(null); setLeaderType(null); }}
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
                        onPress={() => { setLeaderId(o.id); setLeaderType(o.type); }}
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
  );
}
