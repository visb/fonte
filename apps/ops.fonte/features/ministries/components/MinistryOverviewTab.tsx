import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryDetail } from '@fonte/api-client';
import {
  useAddStaff,
  useRemoveStaff,
  useHouseStaffForMinistry,
} from '../hooks/useMinistries';
import { normalizeForSearch } from '@/lib/searchUtils';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">
      {children}
    </Text>
  );
}

interface Props {
  ministryId: string;
  houseId: string;
  ministry: MinistryDetail;
  onEditLeader: () => void;
}

// Story 197: ministério é organização de trabalho de servo. Não há seção de
// filhos — nem para adicionar, nem para listar.
export function MinistryOverviewTab({ ministryId, houseId, ministry, onEditLeader }: Props) {
  const [staffSearch, setStaffSearch] = useState('');

  const { data: allStaff = [] } = useHouseStaffForMinistry(houseId);

  const addStaff = useAddStaff(ministryId);
  const removeStaff = useRemoveStaff(ministryId);

  const memberStaffIds = useMemo(
    () => new Set(ministry.members.map((m) => m.id)),
    [ministry.members],
  );

  const availableStaff = useMemo(
    () =>
      allStaff
        .filter((s) => !memberStaffIds.has(s.id))
        .filter((s) => normalizeForSearch(s.name).includes(normalizeForSearch(staffSearch))),
    [allStaff, memberStaffIds, staffSearch],
  );

  return (
    <ScrollView className="flex-1 px-4">
      <SectionLabel>Líder</SectionLabel>
      <View className="flex-row items-center py-3 border-b border-gray-100">
        <Ionicons name="person-circle-outline" size={36} color="#6b7280" />
        <Text className="flex-1 text-sm text-gray-900 ml-3">{ministry.leaderName ?? '—'}</Text>
        <TouchableOpacity onPress={onEditLeader}>
          <Text className="text-sm text-blue-600 font-medium">Editar</Text>
        </TouchableOpacity>
      </View>

      <SectionLabel>Adicionar Servo</SectionLabel>
      <TextInput
        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-2"
        placeholder="Buscar servo (staff)..."
        value={staffSearch}
        onChangeText={setStaffSearch}
      />
      {staffSearch.length > 0 && availableStaff.length > 0 && (
        <View className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
          {availableStaff.slice(0, 5).map((s) => (
            <TouchableOpacity
              key={s.id}
              className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
              onPress={() => addStaff.mutate(s.id, { onSuccess: () => setStaffSearch('') })}
            >
              <Text className="text-sm text-gray-900">{s.name}</Text>
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {staffSearch.length > 0 && availableStaff.length === 0 && (
        <Text className="text-sm text-gray-400 mb-2">Nenhum servo disponível.</Text>
      )}

      <SectionLabel>{`Servos (${ministry.members.length})`}</SectionLabel>
      {ministry.members.length === 0 ? (
        <Text className="text-sm text-gray-400 py-2">Nenhum servo adicionado.</Text>
      ) : (
        ministry.members.map((member) => (
          <View key={member.id} className="flex-row items-center py-3 border-b border-gray-100">
            <View className="flex-1 flex-row items-center">
              <Text className="text-sm text-gray-900">{member.name}</Text>
              <View className="ml-2 px-2 py-0.5 rounded-full bg-purple-100">
                <Text className="text-xs font-medium text-purple-700">Servo</Text>
              </View>
            </View>
            <TouchableOpacity className="ml-2 p-1" onPress={() => removeStaff.mutate(member.id)}>
              <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}
